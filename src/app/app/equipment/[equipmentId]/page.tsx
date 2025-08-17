
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image'; // Import next/image
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Wrench, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Equipment, EquipmentStatus } from '@/types/equipment';
import type { WorkOrder } from '@/types/work-order';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions';
// Import REAL Firestore service functions
import {
    fetchEquipmentById,
    updateEquipment
} from '@/services/equipment'; // Use equipment service
import { fetchCustomerById } from '@/services/customers'; // Use customer service
import { fetchLocationById } from '@/services/locations'; // Use location service
import { fetchWorkOrdersByEquipmentId } from '@/services/workOrders';
import { Badge } from '@/components/ui/badge';


const equipmentStatuses: EquipmentStatus[] = ['operational', 'needs-repair', 'decommissioned'];

// Define the form schema using Zod (should match editable fields)
const equipmentSchema = z.object({
  name: z.string().min(1, { message: 'Equipment Name is required' }),
  // customer_id and location_id are usually not edited directly on the equipment form
  status: z.enum(equipmentStatuses.slice() as [string, ...string[]]),
  asset_tag: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model_number: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  equipment_type: z.string().optional().nullable(),
  installation_date: z.date().optional().nullable(),
  last_service_date: z.date().optional().nullable(),
  next_service_due_date: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;


export default function EditEquipmentPage() {
  const router = useRouter();
  const { equipmentId } = useParams() as { equipmentId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [equipmentData, setEquipmentData] = useState<Equipment | null>(null);
  const [customerName, setCustomerName] = useState<string>('Loading...'); // For display
  const [locationName, setLocationName] = useState<string>('Loading...'); // For display
  const [error, setError] = useState<string | null>(null);

  const canEditEquipment = !authLoading && hasPermission(user, 'equipment', 'edit');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { /* Initialized in useEffect */ },
  });

  // Fetch equipment data and related names using REAL services
  const fetchData = useCallback(async () => {
     if (!canEditEquipment && !authLoading) {
        setError("Access Denied: You don't have permission to edit equipment.");
        setIsLoading(false);
        return;
     }
      if (!companyId) {
        setError("Company context is missing.");
        setIsLoading(false);
        return;
      }
     if (!equipmentId) {
       setError("Equipment ID is missing.");
       setIsLoading(false);
       return;
     }

    setIsLoading(true);
    setError(null);
    try {
      // Use the real service function
      const foundEquipment = await fetchEquipmentById(equipmentId);

      if (!foundEquipment) {
        throw new Error("Equipment not found or you do not have access.");
      }
      setEquipmentData(foundEquipment);

      // Fetch related names using their respective services
      const [customer, location] = await Promise.all([
          fetchCustomerById(companyId, foundEquipment.customer_id),
          fetchLocationById(companyId, foundEquipment.location_id)
      ]);

      setCustomerName(customer?.name ?? 'Unknown Customer');
      setLocationName(location?.name ?? 'Unknown Location');

      // Convert Timestamps to Dates if necessary for the form
      const initialFormData = {
          ...foundEquipment,
          installation_date: foundEquipment.installation_date ? new Date(foundEquipment.installation_date) : null,
          last_service_date: foundEquipment.last_service_date ? new Date(foundEquipment.last_service_date) : null,
          next_service_due_date: foundEquipment.next_service_due_date ? new Date(foundEquipment.next_service_due_date) : null,
          asset_tag: foundEquipment.asset_tag ?? '',
          manufacturer: foundEquipment.manufacturer ?? '',
          model_number: foundEquipment.model_number ?? '',
          serial_number: foundEquipment.serial_number ?? '',
          notes: foundEquipment.notes ?? '',
      };
      reset(initialFormData as any); // Populate form

    } catch (err: any) {
      console.error("Error fetching equipment data:", err);
      setError(err.message || "Failed to load equipment data.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load equipment." });
    } finally {
      setIsLoading(false);
    }
  }, [equipmentId, companyId, reset, toast, canEditEquipment, authLoading]); // Added dependencies


  useEffect(() => {
      fetchData();
  }, [fetchData]);
  
  const { data: relatedWorkOrders = [], isLoading: isLoadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ['equipmentWorkOrders', equipmentId],
    queryFn: () => fetchWorkOrdersByEquipmentId(equipmentId),
    enabled: !!equipmentId,
  });


  // Use the REAL updateEquipment service function
  const onSubmit = async (data: EquipmentFormData) => {
    if (!canEditEquipment) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You cannot edit equipment." });
        return;
     }
    if (!companyId || !equipmentData) {
        toast({ variant: "destructive", title: "Error", description: "Missing context or equipment data." });
        return;
     }
     if (!user) { // Check for user existence
        toast({ variant: "destructive", title: "Error", description: "User information is missing." });
        return;
     }

    setIsSubmitting(true);

     // Prepare data for update, excluding non-editable fields like IDs, created_at
     const updateData: Partial<Omit<Equipment, 'id' | 'company_id' | 'location_id' | 'customer_id' | 'created_at'>> = {
         name: data.name.trim(),
         status: data.status as EquipmentStatus,
         asset_tag: data.asset_tag?.trim() || null,
         manufacturer: data.manufacturer?.trim() || null,
         model_number: data.model_number?.trim() || null,
         serial_number: data.serial_number?.trim() || null,
         installation_date: data.installation_date ?? null,
         last_service_date: data.last_service_date ?? null,
         next_service_due_date: data.next_service_due_date ?? null,
         notes: data.notes?.trim() || null,
     };

    try {
       await updateEquipment(equipmentData.id, updateData); // Pass user ID
       toast({
        title: "Equipment Updated",
        description: `Equipment "${data.name}" has been successfully updated.`,
       });
       router.push('/equipment'); // Redirect back to the list page

    } catch (error: any) {
       console.error("Failed to update equipment:", error);
       toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update the equipment. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error) {
     return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Equipment'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button variant="outline" size="sm" onClick={() => router.push('/equipment')} className="mt-4">
               Back to Equipment List
            </Button>
          </Alert>
      </main>
    );
  }

   if (!equipmentData) {
     return <main className="flex flex-1 items-center justify-center"><p>Equipment data could not be loaded.</p></main>;
   }

    // Ensure created_at is a Date object for formatting
   const createdAtDate = new Date(equipmentData.created_at);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Wrench className="h-6 w-6" /> Edit Equipment - {equipmentData?.name}
          </CardTitle>
           <CardDescription>Update the details for this piece of equipment.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Identification & Location */}
            <div className="space-y-4">
              {/* Customer (Display Only) */}
              <div>
                 <Label>Customer</Label>
                 <Input value={customerName} disabled className="mt-1" />
                 {/* Customer ID is handled internally, not editable here */}
              </div>

               {/* Location (Display Only) */}
              <div>
                 <Label>Location</Label>
                 <Input value={locationName} disabled className="mt-1" />
                  {/* Location ID is handled internally, not editable here */}
              </div>

              {/* Equipment Name */}
              <div>
                 <Label htmlFor="name">Equipment Name <span className="text-destructive">*</span></Label>
                <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <Input id="name" placeholder="e.g., Rooftop Unit 1" {...field} />
                    )}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

               {/* Asset Tag */}
              <div>
                <Label htmlFor="asset_tag">Asset Tag</Label>
                 <Controller
                    name="asset_tag"
                    control={control}
                    render={({ field }) => (
                        <Input id="asset_tag" placeholder="e.g., RTU-001A" {...field} value={field.value ?? ''} />
                    )}
                />
              </div>

              {/* Equipment Type */}
              <div>
                <Label htmlFor="equipment_type">Equipment Type</Label>
                <Controller
                    name="equipment_type"
                    control={control}
                    render={({ field }) => (
                         // TODO: Consider making this a dropdown based on company settings
                        <Input id="equipment_type" placeholder="e.g., HVAC, Refrigeration" {...field} value={field.value ?? ''} />
                    )}
                />
              </div>
             {/* Status */}
             <div>
                <Label htmlFor="status">Status</Label>
                <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="status">
                            <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {equipmentStatuses.map(status => (
                                <SelectItem key={status} value={status}>
                                    {formatEnum(status)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    )}
                />
              </div>
            </div>

            {/* Column 2: Details & Dates */}
            <div className="space-y-4">
               {/* Manufacturer */}
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Controller
                    name="manufacturer"
                    control={control}
                    render={({ field }) => (
                        <Input id="manufacturer" placeholder="e.g., Carrier" {...field} value={field.value ?? ''} />
                    )}
                />
              </div>

              {/* Model Number */}
              <div>
                <Label htmlFor="model_number">Model Number</Label>
                <Controller
                    name="model_number"
                    control={control}
                    render={({ field }) => (
                        <Input id="model_number" placeholder="e.g., CR-1000" {...field} value={field.value ?? ''} />
                    )}
                />
              </div>

               {/* Serial Number */}
              <div>
                <Label htmlFor="serial_number">Serial Number</Label>
                <Controller
                    name="serial_number"
                    control={control}
                    render={({ field }) => (
                        <Input id="serial_number" placeholder="e.g., SN12345" {...field} value={field.value ?? ''} />
                    )}
                />
              </div>

               {/* Installation Date */}
              <div>
                 <Label htmlFor="installation_date">Installation Date</Label>
                  <Controller
                    name="installation_date"
                    control={control}
                    render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="installation_date"
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date (Optional)</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                    )}
                />
              </div>
              {/* Last Service Date */}
                <div>
                 <Label htmlFor="last_service_date">Last Service Date</Label>
                  <Controller
                    name="last_service_date"
                    control={control}
                    render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="last_service_date"
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date (Optional)</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                    )}
                />
              </div>
               {/* Next Service Due Date */}
               <div>
                 <Label htmlFor="next_service_due_date">Next Service Due Date</Label>
                  <Controller
                    name="next_service_due_date"
                    control={control}
                    render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="next_service_due_date"
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date (Optional)</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                    )}
                />
              </div>
               {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes</Label>
                 <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                       <Textarea
                        id="notes"
                        placeholder="Add any relevant notes about the equipment..."
                        {...field}
                        value={field.value ?? ''} // Handle null/undefined
                        rows={4}
                        />
                    )}
                />
              </div>
               {/* Display Only Fields */}
                <div className="space-y-2 mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Created At: {format(createdAtDate, 'PPp')}</p>
                    {/* TODO: Add Updated At/By fields when implemented */}
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
             </Button>
            <Button type="submit" disabled={isSubmitting || !canEditEquipment}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

       {/* Updated section for Service History */}
       <Card className="mt-6">
            <CardHeader>
                <CardTitle>Service History</CardTitle>
                <CardDescription>Recent work orders associated with this equipment.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoadingWorkOrders ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : relatedWorkOrders.length > 0 ? (
                    <ul className="space-y-3">
                        {relatedWorkOrders.map(wo => (
                             <li key={wo.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <Link href={`/work-orders/${wo.id}`} className="font-medium text-primary hover:underline">
                                        {wo.work_order_number}: {wo.summary}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                        {format(new Date(wo.created_at), 'PP')}
                                    </p>
                                </div>
                                 <Badge variant={wo.status === 'completed' || wo.status === 'invoiced' ? 'default' : 'secondary'} className="capitalize">
                                     {wo.status.replace('-', ' ')}
                                 </Badge>
                             </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No work orders found for this equipment.</p>
                )}
            </CardContent>
        </Card>
    </main>
  );
}
