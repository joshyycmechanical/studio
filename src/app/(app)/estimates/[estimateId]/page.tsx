
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
import { CalendarIcon, Loader2, Save, DollarSign, AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Estimate, EstimateStatus, EstimateLineItem } from '@/types/estimate';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions';
// Import REAL Firestore service functions
import { fetchEstimateById, updateEstimate } from '@/services/estimates';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyLocations } from '@/services/locations';


const estimateStatuses: EstimateStatus[] = ['draft', 'sent', 'approved', 'rejected', 'expired', 'invoiced']; // Include invoiced for edit

// Zod schema for Line Items (same as new)
const lineItemSchema = z.object({
    id: z.string().optional(), // Keep optional ID for existing items
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(0.01, 'Quantity must be positive'),
    unit_price: z.number().min(0, 'Unit price cannot be negative'),
    item_type: z.enum(['service', 'part', 'labor', 'other']),
});

// Define the form schema using Zod (same as new)
const estimateSchema = z.object({
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  location_id: z.string().optional().nullable(),
  status: z.enum(estimateStatuses).default('draft'),
  summary: z.string().min(1, { message: 'Summary is required' }),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
  valid_until: z.date().optional().nullable(),
});

type EstimateFormData = z.infer<typeof estimateSchema>;

export default function EditEstimatePage() {
  const router = useRouter();
  const { estimateId } = useParams() as { estimateId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [estimateData, setEstimateData] = useState<Estimate | null>(null); // Store original data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEditEstimates = !authLoading && hasPermission(user, 'estimates', 'edit');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset, // Add reset
    formState: { errors },
  } = useForm<EstimateFormData>({
    resolver: zodResolver(estimateSchema),
    defaultValues: { /* Populated in useEffect */ },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  });

  const selectedCustomerId = watch('customer_id');
  const lineItems = watch('line_items');

  // Fetch estimate data and dropdown data
  const fetchData = useCallback(async () => {
    if (!canEditEstimates && !authLoading) {
      setError("Access Denied: You don't have permission to edit estimates.");
      setIsLoading(false);
      setLoadingDropdowns(false);
      return;
    }
     if (!companyId) {
       setError("Company context missing.");
       setIsLoading(false);
       setLoadingDropdowns(false);
       return;
     }
    if (!estimateId) {
      setError("Estimate ID missing.");
      setIsLoading(false);
       setLoadingDropdowns(false);
      return;
    }

    setIsLoading(true);
    setLoadingDropdowns(true);
    setError(null);
    try {
      // Fetch estimate, customers, and locations concurrently
      const [fetchedEstimate, customerData, locationData] = await Promise.all([
        fetchEstimateById(companyId, estimateId),
        fetchCompanyCustomers(companyId),
        fetchCompanyLocations(companyId)
      ]);

      if (!fetchedEstimate) {
        throw new Error("Estimate not found or access denied.");
      }

      setEstimateData(fetchedEstimate);
      setCustomers(customerData);
      setLocations(locationData);

      // Prepare form data, handling date conversions and line item structure
      const formData = {
        customer_id: fetchedEstimate.customer_id,
        location_id: fetchedEstimate.location_id ?? null,
        status: fetchedEstimate.status,
        summary: fetchedEstimate.summary,
        terms: fetchedEstimate.terms ?? '',
        notes: fetchedEstimate.notes ?? '',
        line_items: (fetchedEstimate.line_items ?? []).map(item => ({ // Ensure line items structure matches form
             id: item.id, // Keep ID if needed by useFieldArray, though schema doesn't have it
             description: item.description,
             quantity: item.quantity,
             unit_price: item.unit_price,
             item_type: item.item_type,
        })),
        valid_until: fetchedEstimate.valid_until ? new Date(fetchedEstimate.valid_until) : null,
      };
      reset(formData); // Populate form

    } catch (err: any) {
      console.error("Error fetching estimate data:", err);
      setError(err.message || "Failed to load estimate data.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load estimate." });
    } finally {
      setIsLoading(false);
      setLoadingDropdowns(false);
    }
  }, [estimateId, companyId, reset, toast, canEditEstimates, authLoading]);

  useEffect(() => {
      fetchData();
  }, [fetchData]);

  // Filter locations when customer changes or data loads
  useEffect(() => {
     const currentCustId = getValues('customer_id'); // Get current form value
     if (currentCustId && locations.length > 0) {
         setFilteredLocations(locations.filter(loc => loc.customer_id === currentCustId));
     } else {
         setFilteredLocations([]);
     }
 }, [getValues('customer_id'), locations]); // React to customer_id changes in form


  // Calculate total amount
  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [lineItems]);

  // Function to add a new line item
  const addLineItem = () => {
    append({ description: '', quantity: 1, unit_price: 0, item_type: 'service' });
  };

  // Use the updateEstimate service function
  const onSubmit = async (data: EstimateFormData) => {
    if (!canEditEstimates) return;
    if (!companyId || !estimateData || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "Missing context or estimate data." });
      return;
    }
    setIsSubmitting(true);

    // Prepare data for update, converting dates and line items
    const updateData: Partial<Omit<Estimate, 'id' | 'company_id' | 'created_at' | 'created_by' | 'estimate_number'>> = {
        customer_id: data.customer_id, // Customer change might need more complex handling if allowed
        location_id: data.location_id || null,
        status: data.status,
        summary: data.summary,
        terms: data.terms || null,
        notes: data.notes || null,
        line_items: data.line_items.map(item => ({
            id: item.id || `new-${Date.now()}-${Math.random()}`, // Keep existing ID or generate temp
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_type: item.item_type,
        })),
        total_amount: totalAmount, // Send updated total
        valid_until: data.valid_until || null,
        // Fields like sent_at, approved_at are usually updated via specific actions, not direct edit
    };

    console.log("Updating Estimate Data:", updateData);

    try {
      await updateEstimate(companyId, estimateData.id, updateData, user.id);
      toast({
        title: "Estimate Updated",
        description: `Estimate "${data.summary}" has been successfully updated.`,
      });
      router.push('/estimates'); // Redirect back to the list page
    } catch (error: any) {
      console.error("Failed to update estimate:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update the estimate.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  // --- Render Checks ---
  if (isLoading || authLoading || loadingDropdowns) {
    return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></main>;
  }

  if (error) {
     return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Estimate'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
          </Alert>
      </main>
    );
  }

   if (!estimateData) {
     return <main className="flex flex-1 items-center justify-center"><p>Estimate data could not be loaded.</p></main>;
   }
  // --- End Render Checks ---

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <DollarSign className="h-6 w-6" /> Edit Estimate - {estimateData.estimate_number}
          </CardTitle>
          <CardDescription>Update the details for this estimate or quote.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
             {/* Row 1: Customer, Location, Summary */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Customer (Display Only - Typically not changed after creation) */}
               <div>
                 <Label htmlFor="customer_id_display">Customer</Label>
                  <Controller name="customer_id" control={control} render={({ field }) => (
                        <Select value={field.value} disabled>
                            <SelectTrigger id="customer_id_display">
                                <SelectValue placeholder="Select Customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                {/* Ensure current customer is shown even if not in the general list (edge case) */}
                                {!customers.some(c => c.id === field.value) && (
                                    <SelectItem key={estimateData.customer_id} value={estimateData.customer_id}>
                                        {customers.find(c => c.id === estimateData.customer_id)?.name ?? estimateData.customer_id} (Current)
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                  )} />
               </div>
               {/* Location */}
               <div>
                 <Label htmlFor="location_id">Location (Optional)</Label>
                 <Controller name="location_id" control={control} render={({ field }) => (
                   <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={!selectedCustomerId || filteredLocations.length === 0}>
                     <SelectTrigger id="location_id"><SelectValue placeholder={!selectedCustomerId ? "Select customer first" : (filteredLocations.length === 0 ? "No locations for customer" : "Select Location")} /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="none">-- None --</SelectItem>
                       {filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                       {/* Ensure current location is shown if it belongs to the customer */}
                        {field.value && !filteredLocations.some(l => l.id === field.value) && locations.find(l => l.id === field.value && l.customer_id === selectedCustomerId) && (
                             <SelectItem key={field.value} value={field.value}>
                                 {locations.find(l => l.id === field.value)?.name} (Current)
                             </SelectItem>
                         )}
                     </SelectContent>
                   </Select>
                 )} />
               </div>
               {/* Summary */}
               <div>
                  <Label htmlFor="summary">Summary <span className="text-destructive">*</span></Label>
                  <Controller name="summary" control={control} render={({ field }) => <Input id="summary" placeholder="e.g., HVAC Unit Replacement" {...field} />} />
                  {errors.summary && <p className="text-sm text-destructive mt-1">{errors.summary.message}</p>}
               </div>
             </div>

              {/* Row 2: Status, Valid Until */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {/* Status */}
                 <div>
                     <Label htmlFor="status">Status</Label>
                     <Controller name="status" control={control} render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                             <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                             <SelectContent>
                                 {estimateStatuses.map(s => <SelectItem key={s} value={s}>{formatEnum(s)}</SelectItem>)}
                             </SelectContent>
                         </Select>
                     )} />
                 </div>
                 {/* Valid Until */}
                 <div>
                     <Label htmlFor="valid_until">Valid Until (Optional)</Label>
                     <Controller name="valid_until" control={control} render={({ field }) => (
                         <Popover>
                             <PopoverTrigger asChild>
                             <Button id="valid_until" variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                 <CalendarIcon className="mr-2 h-4 w-4" />
                                 {field.value ? format(field.value, "PPP") : <span>Pick an expiration date</span>}
                             </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} /></PopoverContent>
                         </Popover>
                     )} />
                 </div>
             </div>

             <hr />

              {/* Line Items Section */}
             <div className="space-y-4">
               <h3 className="text-lg font-semibold">Line Items</h3>
                {errors.line_items?.root && <p className="text-sm text-destructive mt-1 mb-2">{errors.line_items.root.message}</p>}
               {fields.map((item, index) => (
                 <Card key={item.id} className="p-4 border bg-muted/50 relative">
                    <Button
                       type="button"
                       variant="ghost"
                       size="icon"
                       className="absolute top-1 right-1 h-7 w-7 text-destructive hover:bg-destructive/10"
                       onClick={() => remove(index)}
                       title="Delete Line Item"
                       disabled={fields.length <= 1}
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                     <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                         {/* Description */}
                         <div className="sm:col-span-5 space-y-1">
                             {index === 0 && <Label htmlFor={`line_items.${index}.description`}>Description</Label>}
                              <Controller name={`line_items.${index}.description`} control={control} render={({ field }) => <Input id={`line_items.${index}.description`} placeholder="Service or Part Name" {...field} />} />
                              {errors.line_items?.[index]?.description && <p className="text-xs text-destructive">{errors.line_items[index].description.message}</p>}
                         </div>
                         {/* Quantity */}
                         <div className="sm:col-span-2 space-y-1">
                             {index === 0 && <Label htmlFor={`line_items.${index}.quantity`}>Quantity</Label>}
                             <Controller name={`line_items.${index}.quantity`} control={control} render={({ field }) => <Input id={`line_items.${index}.quantity`} type="number" step="0.01" min="0.01" placeholder="1" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />} />
                             {errors.line_items?.[index]?.quantity && <p className="text-xs text-destructive">{errors.line_items[index].quantity.message}</p>}
                         </div>
                         {/* Unit Price */}
                         <div className="sm:col-span-2 space-y-1">
                             {index === 0 && <Label htmlFor={`line_items.${index}.unit_price`}>Unit Price</Label>}
                             <Controller name={`line_items.${index}.unit_price`} control={control} render={({ field }) => <Input id={`line_items.${index}.unit_price`} type="number" step="0.01" min="0" placeholder="0.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />} />
                              {errors.line_items?.[index]?.unit_price && <p className="text-xs text-destructive">{errors.line_items[index].unit_price.message}</p>}
                         </div>
                          {/* Item Type */}
                         <div className="sm:col-span-3 space-y-1">
                              {index === 0 && <Label htmlFor={`line_items.${index}.item_type`}>Type</Label>}
                             <Controller name={`line_items.${index}.item_type`} control={control} render={({ field }) => (
                                 <Select onValueChange={field.onChange} value={field.value}>
                                     <SelectTrigger id={`line_items.${index}.item_type`}><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="service">Service</SelectItem>
                                         <SelectItem value="part">Part</SelectItem>
                                         <SelectItem value="labor">Labor</SelectItem>
                                         <SelectItem value="other">Other</SelectItem>
                                     </SelectContent>
                                 </Select>
                             )} />
                         </div>
                     </div>
                 </Card>
               ))}
               <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                 <PlusCircle className="mr-2 h-4 w-4" /> Add Line Item
               </Button>
             </div>

             <hr />
             {/* Totals & Notes */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Notes */}
                  <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" placeholder="Internal or customer-facing notes..." {...field} value={field.value ?? ''} rows={4} />} />
                  </div>
                  {/* Summary & Terms */}
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <Label htmlFor="terms">Terms (Optional)</Label>
                          <Controller name="terms" control={control} render={({ field }) => <Textarea id="terms" placeholder="e.g., 50% deposit required, valid for 30 days..." {...field} value={field.value ?? ''} rows={4} />} />
                      </div>
                       {/* Total Amount Display */}
                     <div className="text-right space-y-1">
                          <p className="text-sm text-muted-foreground">Total Amount</p>
                          <p className="text-2xl font-semibold">
                             {totalAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                         </p>
                      </div>
                  </div>
             </div>
              {/* Display Only Fields */}
                <div className="space-y-2 mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Created At: {format(new Date(estimateData.created_at), 'PPp')}</p>
                    {/* TODO: Display creator name */}
                    <p className="text-sm text-muted-foreground">Created By: {estimateData.created_by}</p>
                    {/* TODO: Add Updated At/By fields if tracked */}
                </div>


          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !canEditEstimates}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
