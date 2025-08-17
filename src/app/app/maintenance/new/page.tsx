'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Save, CalendarCheck, ChevronDown, AlertCircle } from 'lucide-react';
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
    createMaintenanceContract,
    fetchMaintenanceCustomers,
    fetchMaintenanceCustomerLocations,
    fetchMaintenanceChecklistTemplates
} from '@/services/maintenance';

const maintenanceFrequencies: MaintenanceFrequency[] = ['monthly', 'quarterly', 'semi-annually', 'annually', 'custom'];

// Define the form schema using Zod
const contractSchema = z.object({
  name: z.string().min(1, { message: 'Contract Name is required' }),
  customer_id: z.string().min(1, { message: 'Customer is required' }),
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


export default function NewMaintenanceContractPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]); // Locations for the selected customer
  const [checklistTemplates, setChecklistTemplates] = useState<Pick<ChecklistTemplate, 'id' | 'name'>[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const canManageMaintenance = !authLoading && hasPermission(user, 'maintenance', 'manage');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      name: '',
      customer_id: '',
      location_ids: [],
      frequency: 'annually',
      start_date: new Date(),
      is_active: true,
      notes: '',
      custom_frequency_details: '',
      checklist_template_id: null,
      estimated_duration_hours: null,
    },
  });

  const selectedFrequency = watch('frequency');
  const selectedCustomerId = watch('customer_id');
  const selectedLocationIds = watch('location_ids') || []; // Ensure it's an array

  // Fetch customers and templates on initial load using services
  useEffect(() => {
    if (authLoading || !companyId || !canManageMaintenance) {
        setLoadingDropdowns(false);
        return;
    }
    const fetchInitialData = async () => {
      setLoadingDropdowns(true);
      try {
        const [customersData, templatesData] = await Promise.all([
            fetchMaintenanceCustomers(companyId),
            fetchMaintenanceChecklistTemplates(companyId)
        ]);
        setCustomers(customersData);
        setChecklistTemplates(templatesData);
      } catch (error: any) {
        console.error("Error fetching initial dropdown data:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "Could not load customers or templates." });
      } finally {
        setLoadingDropdowns(false);
      }
    };
    fetchInitialData();
  }, [companyId, authLoading, canManageMaintenance, toast]);

  // Fetch locations when customer changes using services
  useEffect(() => {
    const fetchLocations = async () => {
      if (!companyId || !selectedCustomerId) {
        setLocations([]);
        setValue('location_ids', []);
        return;
      }
      // Consider adding a loading indicator specific to locations if needed
      try {
        const customerLocations = await fetchMaintenanceCustomerLocations(companyId, selectedCustomerId);
        setLocations(customerLocations);
        setValue('location_ids', []); // Reset selected locations on customer change
      } catch (error: any) {
        console.error("Error fetching locations:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "Could not load locations for the selected customer." });
        setLocations([]);
        setValue('location_ids', []);
      }
    };
    fetchLocations();
  }, [selectedCustomerId, companyId, toast, setValue]);


  // Use the createMaintenanceContract service function
  const onSubmit = async (data: ContractFormData) => {
    if (!canManageMaintenance) {
        toast({ variant: "destructive", title: "Permission Denied" });
        return;
    }
    if (!companyId || !user?.id) {
       toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
       return;
    }
    setIsSubmitting(true);
    console.log("Submitting New Contract Data:", data);

    // Prepare data, ensuring correct types (Dates are handled by service now)
     const contractData: Omit<MaintenanceContract, 'id' | 'company_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'> = {
         ...data,
         // Convert potentially null/undefined numeric fields correctly
         estimated_duration_hours: data.estimated_duration_hours ? Number(data.estimated_duration_hours) : null,
         // Clean up optional string fields
         custom_frequency_details: data.custom_frequency_details?.trim() || null,
         checklist_template_id: data.checklist_template_id || null,
         notes: data.notes?.trim() || null,
     };

    try {
       await createMaintenanceContract(companyId, user.id, contractData);

       toast({
        title: "Contract Created",
        description: `Maintenance contract "${data.name}" has been created.`,
       });
       router.push('/maintenance'); // Redirect back

    } catch (error: any) {
       console.error("Failed to create contract:", error);
       toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the contract.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Checks ---
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canManageMaintenance) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to create maintenance contracts.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </main>
    );
  }
  // --- End Render Checks ---

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <CalendarCheck className="h-6 w-6" /> Create New Maintenance Contract
          </CardTitle>
          <CardDescription>Set up a recurring maintenance schedule.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
               {/* Contract Name */}
              <div>
                 <Label htmlFor="name">Contract Name <span className="text-destructive">*</span></Label>
                <Controller name="name" control={control} render={({ field }) => <Input id="name" placeholder="e.g., Annual HVAC PM" {...field} />} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
               {/* Customer */}
              <div>
                <Label htmlFor="customer_id">Customer <span className="text-destructive">*</span></Label>
                <Controller
                  name="customer_id" control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingDropdowns}>
                      <SelectTrigger id="customer_id"><SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Customer"} /></SelectTrigger>
                      <SelectContent>
                        {customers.map(c => (
                            c.id ? <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem> : null
                        ))}
                         {customers.length === 0 && !loadingDropdowns && <SelectItem value="no-customers-placeholder" disabled>No active customers found</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.customer_id && <p className="text-sm text-destructive mt-1">{errors.customer_id.message}</p>}
              </div>
              {/* Location Multi-Select Dropdown */}
               <div>
                 <Label htmlFor="locations-dropdown-new">Locations <span className="text-destructive">*</span></Label>
                 <Controller
                   name="location_ids"
                   control={control}
                   render={({ field }) => (
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button
                           id="locations-dropdown-new"
                           variant="outline"
                           className="w-full justify-between font-normal"
                           disabled={!selectedCustomerId || locations.length === 0}
                         >
                           <span>
                             {selectedLocationIds.length > 0
                               ? `${selectedLocationIds.length} location(s) selected`
                               : (locations.length > 0 ? "Select Locations" : (selectedCustomerId ? "No locations for customer" : "Select customer first"))}
                           </span>
                           <ChevronDown className="h-4 w-4 opacity-50" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                         <DropdownMenuLabel>Select Locations</DropdownMenuLabel>
                         <DropdownMenuSeparator />
                         <ScrollArea className="h-48">
                           {locations.map((location) => (
                             location.id ? ( // Check if location.id is valid
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
                               onSelect={(e) => e.preventDefault()} // Prevent closing dropdown on item select
                             >
                               {location.name}
                             </DropdownMenuCheckboxItem>
                             ): null
                           ))}
                            {locations.length === 0 && selectedCustomerId && (
                               <div className="px-2 py-1.5 text-sm text-muted-foreground">No locations found.</div>
                            )}
                            {!selectedCustomerId && (
                               <div className="px-2 py-1.5 text-sm text-muted-foreground">Select a customer first.</div>
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
                    <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={loadingDropdowns}>
                      <SelectTrigger id="checklist_template_id"><SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Checklist"} /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="none">-- None --</SelectItem>
                          {checklistTemplates.map(template => (
                              // Ensure template.id is not an empty string before rendering
                              template.id ? <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem> : null
                          ))}
                           {checklistTemplates.length === 0 && !loadingDropdowns && <SelectItem value="no-templates-placeholder" disabled>No checklist templates found</SelectItem>}
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
                <Label htmlFor="frequency">Frequency <span className="text-destructive">*</span></Label>
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
                            // Convert input string to number or null
                            onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                            value={field.value ?? ''}
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
            <Button type="submit" disabled={isSubmitting || loadingDropdowns}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Creating...' : 'Create Contract'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
