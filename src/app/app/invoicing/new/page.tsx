
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { createInvoice } from '@/services/invoices';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyLocations } from '@/services/locations';

const invoiceStatuses: InvoiceStatus[] = ['draft', 'sent']; // Limit initial status

// Zod schema for Line Items (same as estimate)
const lineItemSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(0.01, 'Quantity must be positive'),
    unit_price: z.number().min(0, 'Unit price cannot be negative'),
    item_type: z.enum(['service', 'part', 'labor', 'other']),
});

// Define the form schema using Zod (similar to edit)
const invoiceSchema = z.object({
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  location_id: z.string().optional().nullable(),
  status: z.enum(invoiceStatuses).default('draft'),
  issue_date: z.date({ required_error: "Issue date is required." }),
  due_date: z.date({ required_error: "Due date is required." }),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required.'),
  payment_terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;


export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const canCreateInvoices = !authLoading && hasPermission(user, 'invoicing', 'create');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: '',
      location_id: null,
      status: 'draft',
      issue_date: new Date(),
      due_date: new Date(new Date().setDate(new Date().getDate() + 30)), // Default due date 30 days from now
      line_items: [{ description: '', quantity: 1, unit_price: 0, item_type: 'service' }],
      payment_terms: 'Net 30', // Default payment terms
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  });

  const selectedCustomerId = watch('customer_id');
  const lineItems = watch('line_items');

  // Fetch dropdown data
  useEffect(() => {
    if (authLoading || !companyId || !canCreateInvoices) {
      setLoadingDropdowns(false); return;
    }
    const fetchDropdownData = async () => {
      setLoadingDropdowns(true);
      try {
        const [customerData, locationData] = await Promise.all([
          fetchCompanyCustomers(companyId),
          fetchCompanyLocations(companyId),
        ]);
        setCustomers(customerData);
        setLocations(locationData);
      } catch (error: any) {
        console.error("[NewInvoicePage] Error fetching dropdown data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load customer or location data." });
      } finally {
        setLoadingDropdowns(false);
      }
    };
    fetchDropdownData();
  }, [companyId, authLoading, canCreateInvoices, toast]);

  // Filter locations
  useEffect(() => {
    if (selectedCustomerId && locations.length > 0) {
      setFilteredLocations(locations.filter(loc => loc.customer_id === selectedCustomerId));
      setValue('location_id', null);
    } else {
      setFilteredLocations([]);
       setValue('location_id', null);
    }
  }, [selectedCustomerId, locations, setValue]);

  // Calculate total amount
  const { subtotal, totalAmount, amountDue } = useMemo(() => {
    const sub = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax = 0; // Placeholder
    const discount = 0; // Placeholder
    const total = sub + tax - discount;
    const due = total; // For new invoice, amount due is total
    return { subtotal: sub, totalAmount: total, amountDue: due };
  }, [lineItems]);

  // Add line item
  const addLineItem = () => {
    append({ description: '', quantity: 1, unit_price: 0, item_type: 'service' });
  };

  // Submit using createInvoice service
  const onSubmit = async (data: InvoiceFormData) => {
    if (!canCreateInvoices) return;
    if (!companyId || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
      return;
    }
    setIsSubmitting(true);

    const invoiceData: Omit<Invoice, 'id' | 'company_id' | 'created_at' | 'created_by' | 'invoice_number' | 'amount_due' | 'amount_paid'> = {
        customer_id: data.customer_id,
        location_id: data.location_id || null,
        status: data.status,
        issue_date: data.issue_date,
        due_date: data.due_date,
        line_items: data.line_items.map(item => ({ ...item, id: `item-${Date.now()}-${Math.random()}` })),
        subtotal: subtotal,
        tax_amount: 0, // Replace with real calc
        discount_amount: 0, // Replace with real calc
        total_amount: totalAmount,
        payment_terms: data.payment_terms || null,
        notes: data.notes || null,
        // Initialize other fields
        related_work_order_ids: [],
        related_estimate_id: null,
        updated_at: null,
        updated_by: null,
        sent_at: data.status === 'sent' ? new Date() : null, // Set sent_at if status is sent
        last_payment_date: null,
    };

    console.log("Submitting New Invoice Data:", invoiceData);

    try {
      await createInvoice(companyId, user.id, invoiceData);
      toast({
        title: "Invoice Created",
        description: `Invoice has been successfully created.`,
      });
      router.push('/invoicing');
    } catch (error: any) {
      console.error("Failed to create invoice:", error);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the invoice.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Checks ---
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateInvoices) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to create new invoices.</AlertDescription>
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
             <FileText className="h-6 w-6" /> Create New Invoice
          </CardTitle>
          <CardDescription>Fill in the details below to create a new invoice.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Row 1: Customer, Location, Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Customer */}
              <div>
                <Label htmlFor="customer_id">Customer <span className="text-destructive">*</span></Label>
                <Controller name="customer_id" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={loadingDropdowns}>
                    <SelectTrigger id="customer_id"><SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Customer"} /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      {customers.length === 0 && !loadingDropdowns && <SelectItem value="" disabled>No customers found</SelectItem>}
                    </SelectContent>
                  </Select>
                )} />
                {errors.customer_id && <p className="text-sm text-destructive mt-1">{errors.customer_id.message}</p>}
              </div>
              {/* Location */}
              <div>
                <Label htmlFor="location_id">Location (Optional)</Label>
                <Controller name="location_id" control={control} render={({ field }) => (
                  <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={!selectedCustomerId || loadingDropdowns || filteredLocations.length === 0}>
                    <SelectTrigger id="location_id"><SelectValue placeholder={!selectedCustomerId ? "Select customer first" : (filteredLocations.length === 0 ? "No locations for customer" : "Select Location")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
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
                         <div className="sm:col-span-5 space-y-1">
                             {index === 0 && <Label htmlFor={`line_items.${index}.description`}>Description</Label>}
                              <Controller name={`line_items.${index}.description`} control={control} render={({ field }) => <Input id={`line_items.${index}.description`} placeholder="Service or Part Name" {...field} />} />
                              {errors.line_items?.[index]?.description && <p className="text-xs text-destructive">{errors.line_items[index].description.message}</p>}
                         </div>
                         <div className="sm:col-span-2 space-y-1">
                             {index === 0 && <Label htmlFor={`line_items.${index}.quantity`}>Quantity</Label>}
                             <Controller name={`line_items.${index}.quantity`} control={control} render={({ field }) => <Input id={`line_items.${index}.quantity`} type="number" step="0.01" min="0.01" placeholder="1" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />} />
                             {errors.line_items?.[index]?.quantity && <p className="text-xs text-destructive">{errors.line_items[index].quantity.message}</p>}
                         </div>
                         <div className="sm:col-span-2 space-y-1">
                             {index === 0 && <Label htmlFor={`line_items.${index}.unit_price`}>Unit Price</Label>}
                             <Controller name={`line_items.${index}.unit_price`} control={control} render={({ field }) => <Input id={`line_items.${index}.unit_price`} type="number" step="0.01" min="0" placeholder="0.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />} />
                              {errors.line_items?.[index]?.unit_price && <p className="text-xs text-destructive">{errors.line_items[index].unit_price.message}</p>}
                         </div>
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
                        {/* <div><span className="text-sm text-muted-foreground">Amount Paid:</span> <span className="font-medium">$0.00</span></div> */}
                        <div><span className="text-sm text-muted-foreground">Amount Due:</span> <span className="text-xl font-bold">{amountDue.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span></div>
                   </div>
             </div>


          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || loadingDropdowns}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Creating...' : 'Create Invoice'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
