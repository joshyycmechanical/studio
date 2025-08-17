
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Save, Construction, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, UserProfileWithRoles } from '@/context/AuthContext';
import type { Repair } from '@/types/repair';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
// Import REAL data service functions
import { fetchRepairById, updateRepair } from '@/services/repairs';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyEquipment } from '@/services/equipment';
import { fetchCompanyUsers } from '@/services/users';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Define the form schema using Zod (similar to new, potentially fewer fields are editable)
const repairSchema = z.object({
  // location_id, equipment_id, technician_id are usually not editable after creation
  repair_date: z.date({ required_error: "Repair date is required." }),
  description: z.string().min(1, { message: 'Description is required' }),
  labor_hours: z.number().positive("Labor hours must be positive").optional().nullable(),
  materials_cost: z.number().min(0, "Materials cost cannot be negative").optional().nullable(),
  notes: z.string().optional().nullable(),
  work_order_id: z.string().optional().nullable(),
  // attachments: z.array(z.string()).optional(), // Handle separately
});

type RepairFormData = z.infer<typeof repairSchema>;

export default function EditRepairPage() {
  const router = useRouter();
  const { repairId } = useParams() as { repairId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [repairData, setRepairData] = useState<Repair | null>(null);
  const [locationName, setLocationName] = useState<string>('Loading...'); // Display only
  const [equipmentName, setEquipmentName] = useState<string>('N/A'); // Display only
  const [technicianName, setTechnicianName] = useState<string>('Loading...'); // Display only
  const [error, setError] = useState<string | null>(null);

  const canEditRepairs = !authLoading && hasPermission(user, 'repairs', 'edit');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RepairFormData>({
    resolver: zodResolver(repairSchema),
    defaultValues: { /* Populated in useEffect */ },
  });

  // Fetch repair and related data
  const fetchData = useCallback(async () => {
    if (!canEditRepairs && !authLoading) {
      setError("Access Denied: You don't have permission to edit repair records.");
      setIsLoading(false); return;
    }
    if (!companyId) { setError("Company context missing."); setIsLoading(false); return; }
    if (!repairId) { setError("Repair ID missing."); setIsLoading(false); return; }

    setIsLoading(true); setError(null);
    try {
      const foundRepair = await fetchRepairById(companyId, repairId);
      if (!foundRepair) throw new Error("Repair record not found or access denied.");
      setRepairData(foundRepair);

      // Fetch related names for display
      const [locData, eqData, usersData] = await Promise.all([
         fetchCompanyLocations(companyId),
         fetchCompanyEquipment(companyId),
         fetchCompanyUsers(companyId),
      ]);

      setLocationName(locData.find(l => l.id === foundRepair.location_id)?.name ?? 'Unknown Location');
      setEquipmentName(eqData.find(e => e.id === foundRepair.equipment_id)?.name ?? 'N/A');
      setTechnicianName(usersData.find(u => u.id === foundRepair.technician_id)?.full_name ?? 'Unknown Technician');

      // Prepare form data
       // Convert Firestore Timestamp to JS Date for the form
       const repairDate = foundRepair.repair_date instanceof Timestamp
         ? foundRepair.repair_date.toDate()
         : new Date(foundRepair.repair_date); // Fallback if it's already a string/number


      const formData = {
        repair_date: repairDate,
        description: foundRepair.description,
        labor_hours: foundRepair.labor_hours ?? null,
        materials_cost: foundRepair.materials_cost ?? null,
        notes: foundRepair.notes ?? '',
        work_order_id: foundRepair.work_order_id ?? null,
      };
      reset(formData);

    } catch (err: any) {
      console.error("Error fetching repair data:", err);
      setError(err.message || "Failed to load repair data.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load repair record." });
    } finally {
      setIsLoading(false);
    }
  }, [repairId, companyId, reset, toast, canEditRepairs, authLoading]);

  useEffect(() => { fetchData(); }, [fetchData]);


  // Use the updateRepair service function
  const onSubmit = async (data: RepairFormData) => {
    if (!canEditRepairs) return;
    if (!companyId || !repairData || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "Missing context or data." });
      return;
    }
    setIsSubmitting(true);
    console.log("Updating Repair Data:", data);

    try {
        // Prepare update data, only including fields from the form schema
        const updateData: Partial<Omit<Repair, 'id' | 'company_id' | 'created_at' | 'location_id' | 'equipment_id' | 'technician_id'>> = {
            repair_date: data.repair_date, // Service function will handle Timestamp conversion
            description: data.description,
            labor_hours: data.labor_hours ? Number(data.labor_hours) : null,
            materials_cost: data.materials_cost ? Number(data.materials_cost) : null,
            notes: data.notes || null,
            work_order_id: data.work_order_id || null,
        };

      await updateRepair(companyId, repairData.id, updateData, user.id);

      toast({
        title: "Repair Record Updated",
        description: `Repair record "${data.description.substring(0, 30)}..." has been updated.`,
      });
      router.push('/repairs'); // Redirect back

    } catch (error: any) {
      console.error("Failed to update repair record:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update the repair record.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  // Render Checks
  if (isLoading || authLoading) {
    return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></main>;
  }
  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" /><AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Repair'}</AlertTitle><AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </main>
    );
  }
  if (!repairData) {
    return <main className="flex flex-1 items-center justify-center"><p>Repair data could not be loaded.</p></main>;
  }


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-6 w-6" /> Edit Repair Record
          </CardTitle>
           <CardDescription>Update details for the repair performed on {format(new Date(repairData.repair_date), 'PP')}.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Display Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border p-4 rounded-md bg-muted/30">
              <div><span className="font-medium">Location:</span> {locationName}</div>
              <div><span className="font-medium">Equipment:</span> {equipmentName}</div>
              <div><span className="font-medium">Technician:</span> {technicianName}</div>
               {repairData.work_order_id && (
                  <div className="md:col-span-3">
                    <span className="font-medium">Related WO:</span>{' '}
                    <Link href={`/work-orders/${repairData.work_order_id}`} className="text-primary hover:underline">
                      View Work Order #{/* TODO: Fetch and display WO number */}
                    </Link>
                  </div>
                )}
            </div>

             {/* Editable Fields */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Column 1 */}
               <div className="space-y-4">
                 {/* Repair Date */}
                 <div>
                   <Label htmlFor="repair_date">Repair Date <span className="text-destructive">*</span></Label>
                   <Controller name="repair_date" control={control} render={({ field }) => (
                       <Popover>
                         <PopoverTrigger asChild>
                           <Button id="repair_date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                             <CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                       </Popover>
                     )}
                   />
                   {errors.repair_date && <p className="text-sm text-destructive mt-1">{errors.repair_date.message}</p>}
                 </div>
                   {/* Labor Hours */}
                  <div>
                    <Label htmlFor="labor_hours">Labor Hours</Label>
                    <Controller name="labor_hours" control={control} render={({ field }) => (
                        <Input id="labor_hours" type="number" step="0.1" min="0" placeholder="e.g., 1.5" {...field}
                        value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />
                    )}
                    />
                    {errors.labor_hours && <p className="text-sm text-destructive mt-1">{errors.labor_hours.message}</p>}
                  </div>
                   {/* Materials Cost */}
                  <div>
                    <Label htmlFor="materials_cost">Materials Cost ($)</Label>
                    <Controller name="materials_cost" control={control} render={({ field }) => (
                        <Input id="materials_cost" type="number" step="0.01" min="0" placeholder="e.g., 125.50" {...field}
                        value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />
                    )}
                    />
                    {errors.materials_cost && <p className="text-sm text-destructive mt-1">{errors.materials_cost.message}</p>}
                  </div>
                   {/* Related Work Order (Optional) */}
                  <div>
                    <Label htmlFor="work_order_id">Related Work Order (Optional)</Label>
                    <Controller name="work_order_id" control={control} render={({ field }) => (
                         // TODO: Ideally replace with a searchable WO dropdown/lookup
                        <Input id="work_order_id" placeholder="Enter WO Number or ID" {...field} value={field.value ?? ''} />
                      )}
                    />
                  </div>
               </div>
                {/* Column 2 */}
               <div className="space-y-4">
                  {/* Description */}
                  <div className="h-full flex flex-col">
                    <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                    <Controller name="description" control={control} render={({ field }) => (
                        <Textarea id="description" placeholder="Describe the repair performed..." {...field} className="flex-grow" rows={5}/>
                      )}
                    />
                    {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                  </div>
                    {/* Notes */}
                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Controller name="notes" control={control} render={({ field }) => (
                        <Textarea id="notes" placeholder="Additional notes about the repair..." {...field} value={field.value ?? ''} rows={5} />
                      )}
                    />
                  </div>
               </div>
            </div>

             {/* Display Created/Updated Info */}
             <div className="space-y-1 mt-4 pt-4 border-t text-xs text-muted-foreground">
                 <p>Created At: {format(new Date(repairData.created_at), 'PPp')}</p>
                 {repairData.updated_at && repairData.updated_by && (
                     <p>Last Updated: {format(new Date(repairData.updated_at), 'PPp')} by {repairData.updated_by/* TODO: Fetch user name */}</p>
                 )}
             </div>

          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !canEditRepairs}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
