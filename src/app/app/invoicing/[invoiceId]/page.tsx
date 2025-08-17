
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
import { CalendarIcon, Loader2, Save, FileText, AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Invoice, InvoiceStatus, InvoiceLineItem } from '@/types/invoice';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions';
// Import REAL Firestore service functions
import { fetchInvoiceById, updateInvoice } from '@/services/invoices';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyLocations } from '@/services/locations';


const invoiceStatuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'partially-paid', 'overdue', 'void', 'write-off'];

// Zod schema for Line Items (similar to estimate)
const lineItemSchema = z.object({
    id: z.string().optional(),
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(0.01, 'Quantity must be positive'),
    unit_price: z.number().min(0, 'Unit price cannot be negative'),
    item_type: z.enum(['service', 'part', 'labor', 'other']),
});

// Define the form schema using Zod
const invoiceSchema = z.object({
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  location_id: z.string().optional().nullable(),
  status: z.enum(invoiceStatuses).default('draft'),
  issue_date: z.date({ required_error: "Issue date is required." }),
  due_date: z.date({ required_error: "Due date is required." }),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
  payment_terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Amounts (subtotal, tax, discount, paid) are usually calculated or handled separately
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;


export default function EditInvoicePage() {
  const router = useRouter();
  const { invoiceId } = useParams() as { invoiceId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<Invoice | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEditInvoices = !authLoading && hasPermission(user, 'invoicing', 'edit');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { /* Populated in useEffect */ },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  });

  const selectedCustomerId = watch('customer_id');
  const lineItems = watch('line_items');

  // Fetch invoice data and dropdown data
  const fetchData = useCallback(async () => {
    if (!canEditInvoices && !authLoading) {
      setError("Access Denied: You don't have permission to edit invoices.");
      setIsLoading(false); setLoadingDropdowns(false); return;
    }
    if (!companyId) { setError("Company context missing."); setIsLoading(false); setLoadingDropdowns(false); return; }
    if (!invoiceId) { setError("Invoice ID missing."); setIsLoading(false); setLoadingDropdowns(false); return; }

    setIsLoading(true); setLoadingDropdowns(true); setError(null);
    try {
      const [fetchedInvoice, customerData, locationData] = await Promise.all([
        fetchInvoiceById(companyId, invoiceId),
        fetchCompanyCustomers(companyId),
        fetchCompanyLocations(companyId)
      ]);

      if (!fetchedInvoice) throw new Error("Invoice not found or access denied.");

      setInvoiceData(fetchedInvoice);
      setCustomers(customerData);
      setLocations(locationData);

      const formData = {
        customer_id: fetchedInvoice.customer_id,
        location_id: fetchedInvoice.location_id ?? null,
        status: fetchedInvoice.status,
        issue_date: new Date(fetchedInvoice.issue_date),
        due_date: new Date(fetchedInvoice.due_date),
        line_items: (fetchedInvoice.line_items ?? []).map(item => ({ ...item })), // Simple map for now
        payment_terms: fetchedInvoice.payment_terms ?? '',
        notes: fetchedInvoice.notes ?? '',
      };
      reset(formData);

    } catch (err: any) {
      console.error("Error fetching invoice data:", err);
      setError(err.message || "Failed to load invoice data.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load invoice." });
    } finally {
      setIsLoading(false); setLoadingDropdowns(false);
    }
  }, [invoiceId, companyId, reset, toast, canEditInvoices, authLoading]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter locations when customer changes or data loads
  useEffect(() => {
     const currentCustId = getValues('customer_id');
     if (currentCustId && locations.length > 0) {
         setFilteredLocations(locations.filter(loc => loc.customer_id === currentCustId));
     } else {
         setFilteredLocations([]);
     }
 }, [getValues('customer_id'), locations]);


  // Calculate total amount and amount due
  const { subtotal, totalAmount, amountDue } = useMemo(() => {
    const sub = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    // TODO: Add logic for tax and discounts if implemented
    const tax = 0; // Placeholder
    const discount = 0; // Placeholder
    const total = sub + tax - discount;
    const paid = invoiceData?.amount_paid ?? 0;
    const due = Math.max(0, total - paid);
    return { subtotal: sub, totalAmount: total, amountDue: due };
  }, [lineItems, invoiceData?.amount_paid]);

  // Function to add a new line item
  const addLineItem = () => {
    append({ description: '', quantity: 1, unit_price: 0, item_type: 'service' });
  };

  // Use the updateInvoice service function
  const onSubmit = async (data: InvoiceFormData) => {
    if (!canEditInvoices) return;
    if (!companyId || !invoiceData || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "Missing context or invoice data." });
      return;
    }
    setIsSubmitting(true);

    // Prepare data for update
    const updateData: Partial<Omit<Invoice, 'id' | 'company_id' | 'created_at' | 'created_by' | 'invoice_number'>> = {
        customer_id: data.customer_id,
        location_id: data.location_id || null,
        status: data.status,
        issue_date: data.issue_date,
        due_date: data.due_date,
        line_items: data.line_items.map(item => ({ // Map line items, keeping existing IDs if possible
            id: item.id || `item-${Date.now()}-${Math.random()}`,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            item_type: item.item_type,
        })),
        payment_terms: data.payment_terms || null,
        notes: data.notes || null,
        // Recalculate financial fields based on current form data
        subtotal: subtotal,
        tax_amount: 0, // Replace with actual tax calculation
        discount_amount: 0, // Replace with actual discount logic
        total_amount: totalAmount,
        // amount_paid is managed separately via payments, but we need to recalculate amount_due
        amount_due: totalAmount - (invoiceData.amount_paid ?? 0), // Recalculate based on existing paid amount
    };

    console.log("Updating Invoice Data:", updateData);

    try {
      await updateInvoice(companyId, invoiceData.id, updateData, user.id);
      toast({
        title: "Invoice Updated",
        description: `Invoice ${invoiceData.invoice_number} has been successfully updated.`,
      });
      router.push('/invoicing'); // Redirect back
    } catch (error: any) {
      console.error("Failed to update invoice:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update the invoice.",
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
            <AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Invoice'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
          </Alert>
      </main>
    );
  }

   if (!invoiceData) {
     return <main className="flex flex-1 items-center justify-center"><p>Invoice data could not be loaded.</p></main>;
   }
  // --- End Render Checks ---

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <FileText className="h-6 w-6" /> Edit Invoice - {invoiceData.invoice_number}
          </CardTitle>
          <CardDescription>Update the details for this invoice.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Row 1: Customer, Location, Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Customer (Display Only) */}
               <div>
                 <Label htmlFor="customer_id_display">Customer</Label>
                  <Controller name="customer_id" control={control} render={({ field }) => (
                        <Select value={field.value} disabled>
                            <SelectTrigger id="customer_id_display"><SelectValue placeholder="Select Customer" /></SelectTrigger>
                            <SelectContent>
                                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                {!customers.some(c => c.id === field.value) && (<SelectItem key={invoiceData.customer_id} value={invoiceData.customer_id}>{customers.find(c=>c.id === invoiceData.customer_id)?.name ?? invoiceData.customer_id } (Current)</SelectItem>)}
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
                        {field.value && !filteredLocations.some(l => l.id === field.value) && locations.find(l => l.id === field.value && l.customer_id === selectedCustomerId) && (<SelectItem key={field.value} value={field.value}>{locations.find(l => l.id === field.value)?.name} (Current)</SelectItem>)}
                     </SelectContent>
                   </Select>
                 )} />
               </div>
                {/* Status */}
                <div>
                    <Label htmlFor="status">Status</Label>
                    <Controller name="status" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {invoiceStatuses.map(s => <SelectItem key={s} value={s}>{formatEnum(s)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                </div>
            </div>

            {/* Row 2: Issue Date, Due Date, Payment Terms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Issue Date */}
                <div>
                     <Label htmlFor="issue_date">Issue Date <span className="text-destructive">*</span></Label>
                     <Controller name="issue_date" control={control} render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild><Button id="issue_date" variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                        </Popover>
                     )} />
                     {errors.issue_date && <p className="text-sm text-destructive mt-1">{errors.issue_date.message}</p>}
                </div>
                 {/* Due Date */}
                 <div>
                     <Label htmlFor="due_date">Due Date <span className="text-destructive">*</span></Label>
                     <Controller name="due_date" control={control} render={({ field }) => (
                        <Popover>
                            <PopoverTrigger asChild><Button id="due_date" variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                        </Popover>
                     )} />
                      {errors.due_date && <p className="text-sm text-destructive mt-1">{errors.due_date.message}</p>}
                 </div>
                 {/* Payment Terms */}
                <div>
                     <Label htmlFor="payment_terms">Payment Terms (Optional)</Label>
                     <Controller name="payment_terms" control={control} render={({ field }) => <Input id="payment_terms" placeholder="e.g., Net 30" {...field} value={field.value ?? ''} />} />
                 </div>
            </div>

            <hr />

             {/* Line Items Section */}
             <div className="space-y-4">
               <h3 className="text-lg font-semibold">Line Items</h3>
                {errors.line_items?.root && <p className="text-sm text-destructive mt-1 mb-2">{errors.line_items.root.message}</p>}
               {fields.map((item, index) => (
                 <Card key={item.id} className="p-4 border bg-muted/50 relative">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => remove(index)} title="Delete Line Item" disabled={fields.length <= 1} ><Trash2 className="h-4 w-4" /></Button>
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
               <Button type="button" variant="outline" size="sm" onClick={addLineItem}><PlusCircle className="mr-2 h-4 w-4" /> Add Line Item</Button>
             </div>

             <hr />
             {/* Totals & Notes */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Notes */}
                  <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" placeholder="Internal or customer-facing notes..." {...field} value={field.value ?? ''} rows={4} />} />
                  </div>
                  {/* Financial Summary */}
                  <div className="space-y-4 text-right">
                        <div><span className="text-sm text-muted-foreground">Subtotal:</span> <span className="font-medium">{subtotal.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span></div>
                        {/* TODO: Display Tax/Discount if implemented */}
                        <div><span className="text-sm text-muted-foreground">Total:</span> <span className="text-lg font-semibold">{totalAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span></div>
                        <div><span className="text-sm text-muted-foreground">Amount Paid:</span> <span className="font-medium">{invoiceData.amount_paid.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span></div>
                        <div><span className="text-sm text-muted-foreground">Amount Due:</span> <span className="text-xl font-bold">{amountDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span></div>
                   </div>
             </div>
               {/* Display Only Fields */}
                <div className="space-y-2 mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Created At: {format(new Date(invoiceData.created_at), 'PPp')}</p>
                    <p className="text-sm text-muted-foreground">Created By: {invoiceData.created_by}</p>
                    {invoiceData.updated_at && invoiceData.updated_by && (
                     <p className="text-sm text-muted-foreground">Last Updated: {format(new Date(invoiceData.updated_at), 'PPp')} by {invoiceData.updated_by ?? 'System'}</p>
                 )}
                </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !canEditInvoices}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
