
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { CalendarIcon, Loader2, Briefcase, Save, AlertCircle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { UserProfileWithRoles } from '@/types/user';
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from '@/types/work-order';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { createWorkOrder } from '@/services/workOrders';
import { fetchCompanyCustomers, createCustomerWithLocation } from '@/services/customers';
import { fetchCompanyLocations, fetchLocationById } from '@/services/locations';
import { fetchCompanyUsers } from '@/services/users';
import { fetchDeficiencyById } from '@/services/deficiencies';
import type { Deficiency, DeficiencySeverity } from '@/types/deficiency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useQueryClient } from '@tanstack/react-query';

// Use the same type definitions from the list page
const workOrderStatuses: WorkOrderStatus[] = ['new', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled'];
const workOrderPriorities: WorkOrderPriority[] = ['low', 'medium', 'high', 'emergency'];

// Define the form schema for the work order
const workOrderSchema = z.object({
  summary: z.string().min(1, { message: 'Summary is required' }),
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  location_id: z.string().min(1, { message: 'Location is required' }),
  status: z.enum(workOrderStatuses),
  priority: z.enum(workOrderPriorities),
  description: z.string().optional(),
  scheduled_date: z.date().optional().nullable(),
  assigned_technician_id: z.string().optional().nullable(),
  equipment_id: z.string().optional().nullable(),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

// Define a schema for the quick-add customer and location dialog
const newCustomerWithLocationSchema = z.object({
    customerName: z.string().min(1, 'Customer name is required'),
    locationName: z.string().min(1, 'Location name is required'),
    addressLine1: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    province: z.string().min(1, 'Province/State is required'),
    postalCode: z.string().min(1, 'Postal/Zip Code is required'),
});
type NewCustomerFormData = z.infer<typeof newCustomerWithLocationSchema>;


function NewWorkOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [technicians, setTechnicians] = useState<Partial<UserProfileWithRoles>[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [linkedDeficiencyId, setLinkedDeficiencyId] = useState<string | null>(null);


  const canCreateWorkOrders = !authLoading && hasPermission(user, 'work-orders', 'create');

  // Form handling for the main work order form
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      summary: '',
      customer_id: '',
      location_id: '',
      equipment_id: null,
      status: 'new',
      priority: 'medium',
      description: '',
      scheduled_date: null,
      assigned_technician_id: null,
    },
  });

  // Form handling for the new customer dialog
  const customerForm = useForm<NewCustomerFormData>({
      resolver: zodResolver(newCustomerWithLocationSchema),
      defaultValues: {
            customerName: '',
            locationName: '',
            addressLine1: '',
            city: '',
            province: '',
            postalCode: '',
      },
  });


  const selectedCustomerId = watch('customer_id');

  // Fetch dropdown data using the REAL service
  const fetchDropdownData = useCallback(async () => {
    if (authLoading || !companyId) {
        setLoadingDropdowns(authLoading);
        return;
    }
    if (!canCreateWorkOrders && !authLoading) {
        console.warn("[NewWorkOrderPage] User does not have permission to create work orders.");
        setLoadingDropdowns(false);
        return;
    }
    setLoadingDropdowns(true);
    try {
        const [customerData, locationData, techData] = await Promise.all([
            fetchCompanyCustomers(companyId),
            fetchCompanyLocations(companyId),
            fetchCompanyUsers(companyId)
        ]);
        setCustomers(customerData);
        setLocations(locationData);
        setTechnicians(techData);
    } catch (error: any) {
        console.error("[NewWorkOrderPage] Error fetching dropdown data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load necessary data." });
    } finally {
        setLoadingDropdowns(false);
    }
  }, [companyId, authLoading, canCreateWorkOrders, toast]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  // Logic to pre-populate form from deficiency
  useEffect(() => {
    const deficiencyId = searchParams.get('deficiencyId');
    if (deficiencyId && companyId && locations.length > 0) { // ensure locations are loaded
      setLinkedDeficiencyId(deficiencyId);
      const prefillFromDeficiency = async () => {
        try {
          const deficiency = await fetchDeficiencyById(companyId, deficiencyId);
          if (deficiency) {
            const location = locations.find(l => l.id === deficiency.location_id);
            if (location) {
              // Map deficiency severity to WO priority
              const priorityMap: { [key in DeficiencySeverity]: WorkOrderPriority } = {
                critical: 'emergency',
                high: 'high',
                medium: 'medium',
                low: 'low',
              };
              
              setValue('customer_id', location.customer_id, { shouldValidate: true });
              setValue('location_id', deficiency.location_id, { shouldValidate: true });
              setValue('summary', `Address Deficiency: ${deficiency.description.substring(0, 50)}`);
              setValue('description', `This work order was created to address the following reported deficiency:

"${deficiency.description}"`);
              setValue('priority', priorityMap[deficiency.severity] || 'medium');
              if(deficiency.equipment_id) {
                setValue('equipment_id', deficiency.equipment_id);
              }
              toast({ title: "Deficiency Loaded", description: "Work order pre-filled with deficiency details." });
            }
          }
        } catch (error) {
          console.error("Failed to prefill from deficiency", error);
          toast({ variant: 'destructive', title: "Error", description: "Could not load deficiency details." });
        }
      };
      prefillFromDeficiency();
    }
  }, [searchParams, companyId, locations, setValue, toast]);


   // Filter locations when customer changes
   useEffect(() => {
    if (selectedCustomerId && locations.length > 0) {
      setFilteredLocations(locations.filter(loc => loc.customer_id === selectedCustomerId));
      const currentLocId = watch('location_id');
      if (currentLocId && !locations.some(l => l.id === currentLocId && l.customer_id === selectedCustomerId)) {
           setValue('location_id', ''); // Reset if current location doesn't match new customer
      }
    } else {
      setFilteredLocations([]);
      setValue('location_id', '');
    }
  }, [selectedCustomerId, locations, setValue, watch]);


  // Handler for creating a new customer from the dialog
  const handleCreateNewCustomer = async (data: NewCustomerFormData) => {
    if (!companyId || !user) {
        toast({ title: 'Error', description: 'Cannot create customer.', variant: 'destructive' });
        return;
    }
    setIsSubmittingCustomer(true);
    try {
        const { customer: newCustomer, location: newLocation } = await createCustomerWithLocation(
            companyId,
            { name: data.customerName, status: 'active' },
            { name: data.locationName, address_line1: data.addressLine1, city: data.city, province: data.province, postal_code: data.postalCode, country: 'USA', location_type: 'other' }
        );

        toast({ title: 'Customer Created', description: `"${newCustomer.name}" has been added.` });
        
        // Update local state instead of re-fetching everything
        setCustomers(prev => [...prev, newCustomer].sort((a,b) => a.name.localeCompare(b.name)));
        setLocations(prev => [...prev, newLocation]);
        
        // Automatically select the new customer AND location in the work order form
        setValue('customer_id', newCustomer.id, { shouldValidate: true });
        // Wait a moment for React to re-render the location dropdown with the new item
        setTimeout(() => {
            setValue('location_id', newLocation.id, { shouldValidate: true });
        }, 100);

        setIsCustomerDialogOpen(false); // Close dialog
        customerForm.reset(); // Reset dialog form
    } catch (error: any) {
        toast({ title: 'Error Creating Customer', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmittingCustomer(false);
    }
  };


  const onSubmit = async (data: WorkOrderFormData) => {
    if (!canCreateWorkOrders) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You cannot create work orders." });
        return;
    }
    if (!companyId || !user) {
       toast({ variant: "destructive", title: "Error", description: "Missing context." });
       return;
    }
    setIsSubmitting(true);
    console.log("Submitting New Work Order Data:", data);

    try {
        const createData: CreateWorkOrderData = {
            customer_id: data.customer_id,
            location_id: data.location_id,
            summary: data.summary,
            status: data.status,
            priority: data.priority,
            description: data.description ?? null,
            scheduled_date: data.scheduled_date ?? null,
            assigned_technician_id: data.assigned_technician_id ?? null,
            equipment_id: data.equipment_id ?? null,
            related_deficiency_ids: linkedDeficiencyId ? [linkedDeficiencyId] : [],
        };
       await createWorkOrder(companyId, user.id, createData);
       toast({
        title: "Work Order Created",
        description: `Work order "${data.summary}" has been successfully created.`,
       });
       queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
       router.push('/work-orders');
    } catch (error: any) {
       console.error("Failed to create work order:", error);
       toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the work order. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Checks ---
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateWorkOrders) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to create new work orders.</AlertDescription>
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
             <Briefcase className="h-6 w-6" /> Create New Work Order
          </CardTitle>
          <CardDescription>Fill in the details below to create a new work order.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              {/* Customer */}
              <div>
                <Label htmlFor="customer_id">Customer <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2">
                     <Controller
                        name="customer_id"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value} disabled={loadingDropdowns}>
                            <SelectTrigger id="customer_id">
                                <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Customer"} />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                </SelectItem>
                                ))}
                                {customers.length === 0 && !loadingDropdowns && <SelectItem value="no-customers-placeholder" disabled>No customers found</SelectItem>}
                            </SelectContent>
                            </Select>
                        )}
                        />
                     <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0" title="Add New Customer">
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[480px]">
                             <form onSubmit={customerForm.handleSubmit(handleCreateNewCustomer)}>
                                <DialogHeader>
                                <DialogTitle>Add New Customer & Location</DialogTitle>
                                <DialogDescription>
                                    Quickly add a new customer and their primary service location. More details can be added later.
                                </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="customer-name">Customer Name <span className="text-destructive">*</span></Label>
                                        <Controller name="customerName" control={customerForm.control} render={({ field }) => <Input id="customer-name" {...field} />} />
                                        {customerForm.formState.errors.customerName && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.customerName.message}</p>}
                                    </div>
                                    <hr className="my-2"/>
                                    <div className="space-y-2">
                                        <Label htmlFor="location-name">Location Name <span className="text-destructive">*</span></Label>
                                        <Controller name="locationName" control={customerForm.control} render={({ field }) => <Input id="location-name" placeholder="e.g., Main Office, Downtown Branch" {...field} />} />
                                        {customerForm.formState.errors.locationName && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.locationName.message}</p>}
                                    </div>
                                     <div className="space-y-2">
                                        <Label htmlFor="address-line1">Address <span className="text-destructive">*</span></Label>
                                        <Controller name="addressLine1" control={customerForm.control} render={({ field }) => <Input id="address-line1" placeholder="123 Main St" {...field} />} />
                                        {customerForm.formState.errors.addressLine1 && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.addressLine1.message}</p>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                         <div className="space-y-2 col-span-2">
                                            <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                                            <Controller name="city" control={customerForm.control} render={({ field }) => <Input id="city" {...field} />} />
                                            {customerForm.formState.errors.city && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.city.message}</p>}
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="province">State <span className="text-destructive">*</span></Label>
                                            <Controller name="province" control={customerForm.control} render={({ field }) => <Input id="province" placeholder="e.g., CA" {...field} />} />
                                            {customerForm.formState.errors.province && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.province.message}</p>}
                                        </div>
                                    </div>
                                     <div className="space-y-2">
                                        <Label htmlFor="postal-code">Postal/Zip Code <span className="text-destructive">*</span></Label>
                                        <Controller name="postalCode" control={customerForm.control} render={({ field }) => <Input id="postal-code" {...field} />} />
                                        {customerForm.formState.errors.postalCode && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.postalCode.message}</p>}
                                    </div>

                                </div>
                                <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingCustomer}>Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmittingCustomer}>
                                    {isSubmittingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create & Select
                                </Button>
                                </DialogFooter>
                             </form>
                        </DialogContent>
                    </Dialog>
                </div>
                {errors.customer_id && <p className="text-sm text-destructive mt-1">{errors.customer_id.message}</p>}
              </div>

               {/* Location */}
              <div>
                <Label htmlFor="location_id">Location <span className="text-destructive">*</span></Label>
                 <Controller
                    name="location_id"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCustomerId || loadingDropdowns || filteredLocations.length === 0}>
                        <SelectTrigger id="location_id">
                            <SelectValue placeholder={!selectedCustomerId ? "Select customer first" : (filteredLocations.length === 0 ? "No locations for customer" : "Select Location")} />
                        </SelectTrigger>
                        <SelectContent>
                             {filteredLocations.map(location => (
                            <SelectItem key={location.id} value={location.id}>
                                {location.name} ({location.address_line1})
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    )}
                    />
                {errors.location_id && <p className="text-sm text-destructive mt-1">{errors.location_id.message}</p>}
              </div>
                
                 {/* Equipment */}
                <div>
                <Label htmlFor="equipment_id">Related Equipment (Optional)</Label>
                <Controller name="equipment_id" control={control} render={({ field }) => (
                    <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={!selectedCustomerId}>
                        <SelectTrigger id="equipment_id"><SelectValue placeholder="Select Equipment" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">-- None --</SelectItem>
                            {/* In a real app, this would be filtered by location as well */}
                            {/* For now, just show all for the customer */}
                        </SelectContent>
                    </Select>
                    )}
                />
              </div>

               {/* Summary */}
              <div>
                 <Label htmlFor="summary">Summary <span className="text-destructive">*</span></Label>
                <Controller
                    name="summary"
                    control={control}
                    render={({ field }) => (
                        <Input id="summary" placeholder="e.g., Annual Maintenance Unit 1" {...field} />
                    )}
                />
                {errors.summary && <p className="text-sm text-destructive mt-1">{errors.summary.message}</p>}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                 <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                       <Textarea
                        id="description"
                        placeholder="Add detailed scope of work or notes..."
                        {...field}
                        value={field.value ?? ''}
                        rows={4}
                        />
                    )}
                />
              </div>
            </div>

             {/* Column 2 */}
            <div className="space-y-4">
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
                            {workOrderStatuses.map(status => (
                                <SelectItem key={status} value={status}>
                                    {formatEnum(status)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    )}
                />
              </div>

              {/* Priority */}
              <div>
                <Label htmlFor="priority">Priority</Label>
                 <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="priority">
                            <SelectValue placeholder="Select Priority" />
                        </SelectTrigger>
                        <SelectContent>
                             {workOrderPriorities.map(priority => (
                            <SelectItem key={priority} value={priority}>
                                {formatEnum(priority)}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    )}
                    />
              </div>

              {/* Assigned Technician */}
              <div>
                <Label htmlFor="assigned_technician_id">Assigned Technician</Label>
                 <Controller
                    name="assigned_technician_id"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={value => field.onChange(value === 'unassigned' ? null : value)} value={field.value ?? 'unassigned'} disabled={loadingDropdowns}>
                            <SelectTrigger id="assigned_technician_id">
                                <SelectValue placeholder={loadingDropdowns ? "Loading..." : "Assign Technician (Optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                                {technicians.map(tech => (
                                <SelectItem key={tech.id} value={tech.id!}>
                                    {tech.full_name ?? tech.email}
                                </SelectItem>
                                ))}
                                 {technicians.length === 0 && !loadingDropdowns && <SelectItem value="no-techs-placeholder" disabled>No technicians found</SelectItem>}
                            </SelectContent>
                        </Select>
                    )}
                />
              </div>

              {/* Scheduled Date */}
              <div>
                 <Label htmlFor="scheduled_date">Scheduled Date</Label>
                  <Controller
                    name="scheduled_date"
                    control={control}
                    render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="scheduled_date"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date (Optional)</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={field.value ?? undefined}
                                onSelect={field.onChange}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                    )}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
             </Button>
            <Button type="submit" disabled={isSubmitting || loadingDropdowns}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Creating...' : 'Create Work Order'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}


export default function NewWorkOrderPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <NewWorkOrderPageContent />
        </Suspense>
    );
}

type CreateWorkOrderData = Omit<WorkOrder, 'id' | 'company_id' | 'created_at' | 'created_by' | 'work_order_number' | 'updated_at' | 'updated_by' | 'completed_date' | 'line_items' | 'technician_notes' | 'internal_notes' | 'customer_signature_url' | 'related_estimate_id' | 'related_invoice_id' | 'custom_fields' | 'estimated_duration_hours' | 'generated_image_url'>
 & {
    customer_id: string;
    location_id: string;
    summary: string;
    status: WorkOrderStatus;
    priority: WorkOrderPriority;
    description?: string | null;
    scheduled_date?: Date | null;
    assigned_technician_id?: string | null;
    equipment_id?: string | null;
    related_deficiency_ids?: string[];
};
