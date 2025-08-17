
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Save, CalendarCheck, AlertCircle, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { MaintenanceFrequency, MaintenanceContract } from '@/types/maintenance';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { ChecklistTemplate } from '@/types/checklist'; // Import ChecklistTemplate
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions';
// Import real data service functions
import {
    fetchMaintenanceContractById,
    updateMaintenanceContract,
    fetchMaintenanceCustomers,
    fetchMaintenanceCustomerLocations,
    fetchMaintenanceChecklistTemplates
} from '@/services/maintenance';


const maintenanceFrequencies: MaintenanceFrequency[] = ['monthly', 'quarterly', 'semi-annually', 'annually', 'custom'];

// Define the form schema using Zod (same as new page)
const contractSchema = z.object({
  name: z.string().min(1, { message: 'Contract Name is required' }),
  customer_id: z.string().min(1, { message: 'Customer is required' }), // Keep for consistency, usually not edited
  location_ids: z.array(z.string()).min(1, { message: 'At least one location is required' }),
  frequency: z.enum(maintenanceFrequencies),
  custom_frequency_details: z.string().optional(),
  start_date: z.date({ required_error: "Start date is required." }),
  end_date: z.date().optional().nullable(),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
  checklist_template_id: z.string().optional().nullable(),
  estimated_duration_hours: z.number().positive("Duration must be positive").optional().nullable(),
}).refine(data => data.frequency !== 'custom' || (data.frequency === 'custom' && data.custom_frequency_details?.trim()), {
    message: "Custom frequency details are required when 'custom' is selected.",
    path: ["custom_frequency_details"],
});

type ContractFormData = z.infer<typeof contractSchema>;

export default function EditMaintenanceContractPage() {
  const router = useRouter();
  const { contractId } = useParams() as { contractId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contractData, setContractData] = useState<MaintenanceContract | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]); // Available locations for the customer
  const [checklistTemplates, setChecklistTemplates] = useState<Pick<ChecklistTemplate, 'id' | 'name'>[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canManageMaintenance = !authLoading && hasPermission(user, 'maintenance', 'manage');

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue, // Add setValue
    formState: { errors },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: { /* Populated in useEffect */ },
  });

  const selectedFrequency = watch('frequency');
  const selectedCustomerId = watch('customer_id'); // Watch customer ID
  const selectedLocationIds = watch('location_ids') || []; // Watch selected location IDs, ensure array


  // Fetch contract data and related dropdown data using services
  const fetchData = useCallback(async () => {
    if (!canManageMaintenance && !authLoading) {
      setError("Access Denied: You don't have permission to manage maintenance contracts.");
      setIsLoading(false);
      return;
    }
     if (!companyId) {
       setError("Company context missing.");
       setIsLoading(false);
       return;
     }
    if (!contractId) {
      setError("Contract ID missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [foundContract, companyCustomers, templatesData] = await Promise.all([
         fetchMaintenanceContractById(companyId, contractId),
         fetchMaintenanceCustomers(companyId),
         fetchMaintenanceChecklistTemplates(companyId)
      ]);

      if (!foundContract) {
        throw new Error("Maintenance contract not found or access denied.");
      }
      setContractData(foundContract);
      setCustomers(companyCustomers);
      setChecklistTemplates(templatesData);

      // Fetch locations for the specific customer of this contract
      const customerLocations = await fetchMaintenanceCustomerLocations(companyId, foundContract.customer_id);
      setLocations(customerLocations);

      // Prepare form data, handling date conversions and optional fields
      const formData = {
        ...foundContract,
        start_date: new Date(foundContract.start_date instanceof Date ? foundContract.start_date : foundContract.start_date.toDate()),
        end_date: foundContract.end_date ? new Date(foundContract.end_date instanceof Date ? foundContract.end_date : foundContract.end_date.toDate()) : null,
        notes: foundContract.notes ?? '',
        custom_frequency_details: foundContract.custom_frequency_details ?? '',
        checklist_template_id: foundContract.checklist_template_id ?? null,
        estimated_duration_hours: foundContract.estimated_duration_hours ?? null,
        location_ids: Array.isArray(foundContract.location_ids) ? foundContract.location_ids : [],
        customer_id: foundContract.customer_id, // Make sure customer_id is included
      };
      reset(formData);

    } catch (err: any) {
      console.error("Error fetching contract data:", err);
      setError(err.message || "Failed to load contract data.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load contract." });
    } finally {
      setIsLoading(false);
    }
  }, [contractId, companyId, reset, toast, canManageMaintenance, authLoading]);

  useEffect(() => {
      fetchData();
  }, [fetchData]); // Fetch data on mount and when dependencies change

   // Refetch locations when customer_id changes in the form (though it's disabled)
   // This might be redundant if customer_id isn't editable, but safe to keep for consistency
   useEffect(() => {
        const fetchLocationsForSelectedCustomer = async () => {
            if (!companyId || !selectedCustomerId) {
                setLocations([]);
                return;
            }
            try {
                const customerLocations = await fetchMaintenanceCustomerLocations(companyId, selectedCustomerId);
                setLocations(customerLocations);
            } catch (error: any) {
                 console.error("Error fetching locations on customer change:", error);
                 setLocations([]); // Clear locations on error
            }
        };
        fetchLocationsForSelectedCustomer();
    }, [selectedCustomerId, companyId]);



  // Use the updateMaintenanceContract service function
  const onSubmit = async (data: ContractFormData) => {
    if (!canManageMaintenance) return;
    if (!companyId || !contractData || !user?.id) { // Check for user ID
      toast({ variant: "destructive", title: "Error", description: "Missing context or contract data." });
      return;
    }
    setIsSubmitting(true);
    console.log("Updating Contract Data:", data);

    // Prepare update data, converting numeric strings and handling nulls
     const updateData: Partial<Omit<MaintenanceContract, 'id' | 'company_id' | 'created_at' | 'created_by'>> = {
        ...data,
        estimated_duration_hours: data.estimated_duration_hours ? Number(data.estimated_duration_hours) : null,
        custom_frequency_details: data.custom_frequency_details?.trim() || null,
        checklist_template_id: data.checklist_template_id || null,
        notes: data.notes?.trim() || null,
     };
     // Remove customer_id if it's not supposed to be updated
     delete updateData.customer_id;


    try {
      await updateMaintenanceContract(companyId, contractData.id, updateData, user.id);
      toast({
        title: "Contract Updated",
        description: `Maintenance contract "${data.name}" has been updated.`,
      });
      router.push('/maintenance'); // Redirect back

    } catch (error: any) {
      console.error("Failed to update contract:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update the contract.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

   if (isLoading || authLoading) {
    return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></main>;
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Contract'}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.push('/maintenance')} className="mt-4">Back to Maintenance</Button>
        </Alert>
      </main>
    );
  }

   if (!contractData) {
     return <main className="flex flex-1 items-center justify-center"><p>Contract data could not be loaded.</p></main>;
   }


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <CalendarCheck className="h-6 w-6" /> Edit Maintenance Contract - {contractData.name}
          </CardTitle>
          <CardDescription>Update the details for this recurring maintenance schedule.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
               {/* Contract Name */}
              <div>
                 <Label htmlFor="name">Contract Name <span className="text-destructive">*</span></Label>
                <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
               {/* Customer (Display/Disabled) */}
              <div>
                <Label htmlFor="customer_id_display">Customer</Label>
                 <Controller
                   name="customer_id" // Keep controller for hidden input
                   control={control}
                   render={({ field }) => (
                    <>
                        <Select value={field.value} disabled>
                            <SelectTrigger id="customer_id_display">
                                <SelectValue placeholder="Select Customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                {/* Ensure the originally selected customer is in the list */}
                                {!customers.some(c => c.id === field.value) && contractData && (
                                    <SelectItem key={contractData.customer_id} value={contractData.customer_id}>
                                        {customers.find(c => c.id === contractData.customer_id)?.name ?? contractData.customer_id} (Current)
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        <input type="hidden" {...field} />
                     </>
                   )}
                 />
              </div>
              {/* Location Multi-Select Dropdown */}
               <div>
                 <Label htmlFor="locations-dropdown-edit">Locations <span className="text-destructive">*</span></Label>
                  <Controller
                   name="location_ids"
                   control={control}
                   render={({ field }) => (
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button
                           id="locations-dropdown-edit"
                           variant="outline"
                           className="w-full justify-between font-normal"
                           disabled={locations.length === 0}
                         >
                           <span>
                             {selectedLocationIds.length > 0
                               ? `${selectedLocationIds.length} location(s) selected`
                               : (locations.length > 0 ? "Select Locations" : "No locations for this customer")}
                           </span>
                           <ChevronDown className="h-4 w-4 opacity-50" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                         <DropdownMenuLabel>Select Locations</DropdownMenuLabel>
                         <DropdownMenuSeparator />
                         <ScrollArea className="h-48">
                           {locations.map((location) => (
                             <DropdownMenuCheckboxItem
                               key={location.id}
                               checked={field.value?.includes(location.id)}
                               onCheckedChange={(checked) => {
                                 const currentIds = field.value || [];
                                 const newIds = checked
                                   ? [...currentIds, location.id]
                                   : currentIds.filter(id => id !== location.id);
                                 field.onChange(newIds);
                               }}
                               onSelect={(e) => e.preventDefault()}
                             >
                               {location.name}
                             </DropdownMenuCheckboxItem>
                           ))}
                           {locations.length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">No locations found.</div>
                           )}
                         </ScrollArea>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   )}
                 />
                 {errors.location_ids && <p className="text-sm text-destructive mt-1">{errors.location_ids.message}</p>}
               </div>
               {/* Checklist Template (Optional) */}
              <div>
                <Label htmlFor="checklist_template_id">Checklist Template (Optional)</Label>
                <Controller name="checklist_template_id" control={control}
                  render={({ field }) => (
                    <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'}>
                      <SelectTrigger id="checklist_template_id"><SelectValue placeholder="Select Checklist" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                           {checklistTemplates.map(template => (
                              <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                          ))}
                            {checklistTemplates.length === 0 && <SelectItem value="" disabled>No templates found</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

            </div>
            {/* Column 2 */}
            <div className="space-y-4">
              {/* Frequency */}
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Controller name="frequency" control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="frequency"><SelectValue placeholder="Select Frequency" /></SelectTrigger>
                      <SelectContent>
                        {maintenanceFrequencies.map(f => <SelectItem key={f} value={f}>{formatEnum(f)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                 {errors.frequency && <p className="text-sm text-destructive mt-1">{errors.frequency.message}</p>}
              </div>
              {/* Custom Frequency Details (Conditional) */}
              {selectedFrequency === 'custom' && (
                 <div>
                    <Label htmlFor="custom_frequency_details">Custom Frequency Details <span className="text-destructive">*</span></Label>
                    <Controller name="custom_frequency_details" control={control}
                    render={({ field }) => <Input id="custom_frequency_details" placeholder="e.g., Every 3rd Tuesday" {...field} value={field.value ?? ''} />}
                    />
                     {errors.custom_frequency_details && <p className="text-sm text-destructive mt-1">{errors.custom_frequency_details.message}</p>}
                 </div>
              )}
               {/* Start Date */}
              <div>
                 <Label htmlFor="start_date">Start Date <span className="text-destructive">*</span></Label>
                 <Controller name="start_date" control={control}
                    render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="start_date" variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                        </Popover>
                    )}
                 />
                 {errors.start_date && <p className="text-sm text-destructive mt-1">{errors.start_date.message}</p>}
              </div>
               {/* End Date (Optional) */}
                <div>
                 <Label htmlFor="end_date">End Date (Optional)</Label>
                 <Controller name="end_date" control={control}
                    render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="end_date" variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick an end date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} /></PopoverContent>
                        </Popover>
                    )}
                 />
              </div>
                 {/* Estimated Duration (Optional) */}
               <div>
                 <Label htmlFor="estimated_duration_hours">Est. Duration (Hours)</Label>
                 <Controller name="estimated_duration_hours" control={control}
                    render={({ field }) => (
                        <Input
                            id="estimated_duration_hours"
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="e.g., 2.5"
                            {...field}
                            value={field.value ?? ''}
                             onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                         />
                     )}
                 />
                  {errors.estimated_duration_hours && <p className="text-sm text-destructive mt-1">{errors.estimated_duration_hours.message}</p>}
              </div>
               {/* Status Toggle (Active/Inactive) */}
               <div className="flex items-center space-x-2 pt-2">
                   <Controller
                       name="is_active"
                       control={control}
                       render={({ field }) => (
                           <Checkbox
                               id="is_active"
                               checked={field.value}
                               onCheckedChange={field.onChange}
                               className="form-checkbox h-4 w-4 text-primary rounded focus:ring-primary border-border"
                           />
                       )}
                   />
                   <Label htmlFor="is_active">Active Contract</Label>
               </div>
                {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Controller name="notes" control={control}
                  render={({ field }) => <Textarea id="notes" placeholder="Internal notes about the contract..." {...field} value={field.value ?? ''} rows={3}/>}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !canManageMaintenance}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* TODO: Add section to view/manage upcoming scheduled visits */}
       <Card className="mt-6">
            <CardHeader>
                <CardTitle>Scheduled Visits</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">List of upcoming and past scheduled visits generated by this contract will go here...</p>
                {/* Needs logic to generate/fetch visit schedule based on frequency/start date */}
            </CardContent>
        </Card>
    </main>
  );
}
