
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/context/AuthContext';
import type { Repair } from '@/types/repair';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import type { UserProfile } from '@/types/user';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
// Import REAL data service functions
import { createRepair } from '@/services/repairs';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyEquipment } from '@/services/equipment';
import { fetchCompanyUsers } from '@/services/users'; // Fetch all users for technician dropdown

// Define the form schema using Zod
const repairSchema = z.object({
  location_id: z.string().min(1, { message: 'Location is required' }),
  equipment_id: z.string().optional().nullable(),
  technician_id: z.string().min(1, { message: 'Technician is required' }),
  repair_date: z.date({ required_error: "Repair date is required." }),
  description: z.string().min(1, { message: 'Description is required' }),
  labor_hours: z.number().positive("Labor hours must be positive").optional().nullable(),
  materials_cost: z.number().min(0, "Materials cost cannot be negative").optional().nullable(),
  notes: z.string().optional().nullable(),
  work_order_id: z.string().optional().nullable(), // Optional link to WO
  // attachments: z.array(z.string()).optional(), // Handle attachments separately
});

type RepairFormData = z.infer<typeof repairSchema>;

export default function NewRepairPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]);
  const [technicians, setTechnicians] = useState<Partial<UserProfile>[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const canCreateRepairs = !authLoading && hasPermission(user, 'repairs', 'create');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RepairFormData>({
    resolver: zodResolver(repairSchema),
    defaultValues: {
      location_id: '',
      equipment_id: null,
      technician_id: '',
      repair_date: new Date(),
      description: '',
      labor_hours: null,
      materials_cost: null,
      notes: '',
      work_order_id: null,
    },
  });

  const selectedLocationId = watch('location_id');

  // Fetch locations, equipment, and technicians
  const fetchDropdownData = useCallback(async () => {
    if (!companyId || !canCreateRepairs) {
      setLoadingDropdowns(false);
      return;
    }
    setLoadingDropdowns(true);
    try {
      const [locData, equipData, techData] = await Promise.all([
        fetchCompanyLocations(companyId),
        fetchCompanyEquipment(companyId),
        fetchCompanyUsers(companyId), // Fetch all users initially
      ]);
      setLocations(locData);
      setAllEquipment(equipData);
      // Since roles are disabled, we can just use all active users as potential technicians.
      const activeUsers = techData.filter(u => u.status === 'active');
      setTechnicians(activeUsers.length > 0 ? activeUsers : techData);
    } catch (error: any) {
      console.error("Error fetching dropdown data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load locations, equipment, or technicians." });
    } finally {
      setLoadingDropdowns(false);
    }
  }, [companyId, canCreateRepairs, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchDropdownData();
    }
  }, [fetchDropdownData, authLoading]);

  // Filter equipment when location changes
  useEffect(() => {
    if (selectedLocationId && allEquipment.length > 0) {
      setFilteredEquipment(allEquipment.filter(eq => eq.location_id === selectedLocationId));
      setValue('equipment_id', null);
    } else {
      setFilteredEquipment([]);
      setValue('equipment_id', null);
    }
  }, [selectedLocationId, allEquipment, setValue]);


  // Use the createRepair service function
  const onSubmit = async (data: RepairFormData) => {
    if (!canCreateRepairs) {
      toast({ variant: "destructive", title: "Permission Denied" });
      return;
    }
    if (!companyId || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
      return;
    }
    setIsSubmitting(true);
    console.log("Submitting New Repair Data:", data);

    try {
      // Prepare data for the service function
      const repairData: Omit<Repair, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'updated_by'> = {
          location_id: data.location_id,
          equipment_id: data.equipment_id || null,
          technician_id: data.technician_id,
          repair_date: data.repair_date, // Service function will handle Timestamp conversion
          description: data.description,
          labor_hours: data.labor_hours ? Number(data.labor_hours) : null,
          materials_cost: data.materials_cost ? Number(data.materials_cost) : null,
          notes: data.notes || null,
          work_order_id: data.work_order_id || null,
          attachments: [], // Start with empty attachments
      };

      await createRepair(companyId, user.id, repairData);

      toast({
        title: "Repair Logged",
        description: `Repair record "${data.description.substring(0, 30)}..." has been created.`,
      });
      router.push('/repairs'); // Redirect back

    } catch (error: any) {
      console.error("Failed to log repair:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not log the repair record.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Checks
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateRepairs) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to log new repair records.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-6 w-6" /> Log New Repair Record
          </CardTitle>
          <CardDescription>Document details about a repair performed.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Context */}
            <div className="space-y-4">
              {/* Location */}
              <div>
                <Label htmlFor="location_id">Location <span className="text-destructive">*</span></Label>
                <Controller
                  name="location_id" control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingDropdowns}>
                      <SelectTrigger id="location_id"><SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Location"} /></SelectTrigger>
                      <SelectContent>
                        {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                        {locations.length === 0 && !loadingDropdowns && <SelectItem value="" disabled>No locations found</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.location_id && <p className="text-sm text-destructive mt-1">{errors.location_id.message}</p>}
              </div>
              {/* Equipment (Optional) */}
              <div>
                <Label htmlFor="equipment_id">Related Equipment (Optional)</Label>
                <Controller
                  name="equipment_id" control={control}
                  render={({ field }) => (
                    <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={!selectedLocationId || loadingDropdowns || filteredEquipment.length === 0}>
                      <SelectTrigger id="equipment_id"><SelectValue placeholder={!selectedLocationId ? "Select location first" : (filteredEquipment.length === 0 ? "No equipment at location" : "Select Equipment")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- None --</SelectItem>
                        {filteredEquipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.asset_tag || eq.serial_number || 'No ID'})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {/* Related Work Order (Optional) */}
              <div>
                <Label htmlFor="work_order_id">Related Work Order (Optional)</Label>
                <Controller
                  name="work_order_id" control={control}
                  render={({ field }) => (
                    // TODO: Replace with a WO search/select component
                    <Input id="work_order_id" placeholder="Enter WO Number or ID" {...field} value={field.value ?? ''} />
                  )}
                />
              </div>
               {/* Technician */}
               <div>
                <Label htmlFor="technician_id">Technician <span className="text-destructive">*</span></Label>
                <Controller
                  name="technician_id" control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingDropdowns}>
                      <SelectTrigger id="technician_id"><SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Technician"} /></SelectTrigger>
                      <SelectContent>
                        {technicians.map(tech => <SelectItem key={tech.id} value={tech.id!}>{tech.full_name ?? tech.email}</SelectItem>)}
                        {technicians.length === 0 && !loadingDropdowns && <SelectItem value="" disabled>No technicians found</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.technician_id && <p className="text-sm text-destructive mt-1">{errors.technician_id.message}</p>}
              </div>
                {/* Repair Date */}
              <div>
                <Label htmlFor="repair_date">Repair Date <span className="text-destructive">*</span></Label>
                <Controller
                  name="repair_date" control={control}
                  render={({ field }) => (
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
            </div>

            {/* Column 2: Details */}
            <div className="space-y-4">
               {/* Description */}
              <div>
                <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                <Controller name="description" control={control} render={({ field }) => (
                    <Textarea id="description" placeholder="Describe the repair performed..." {...field} rows={4} />
                  )}
                />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
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
              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Controller name="notes" control={control} render={({ field }) => (
                    <Textarea id="notes" placeholder="Additional notes about the repair..." {...field} value={field.value ?? ''} rows={3} />
                  )}
                />
              </div>
               {/* TODO: Add Attachment Upload */}
              {/* <div>
                <Label>Attachments (Optional)</Label>
                <Input type="file" multiple />
              </div> */}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || loadingDropdowns}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Log Repair'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
