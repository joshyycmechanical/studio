
'use client';

import * as React from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Loader2, Save, ShoppingCart, AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

// For now, suppliers are just a string. In a real app, this would be a lookup.
const lineItemSchema = z.object({
  description: z.string().min(1, 'Item description is required.'),
  quantity: z.number().min(1, 'Quantity must be at least 1.'),
  unit_cost: z.number().nonnegative('Cost cannot be negative.'),
});

const poSchema = z.object({
  vendor_name: z.string().min(1, 'Supplier name is required.'),
  notes: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, 'At least one item is required.'),
});

type POFormData = z.infer<typeof poSchema>;

export default function NewPurchaseOrderPage() {
    const { user, companyId, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const canCreatePOs = !authLoading && hasPermission(user, 'purchase-orders', 'create');

    const { control, handleSubmit, formState: { errors } } = useForm<POFormData>({
        resolver: zodResolver(poSchema),
        defaultValues: {
            vendor_name: '',
            notes: '',
            line_items: [{ description: '', quantity: 1, unit_cost: 0 }],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "line_items"
    });

    const onSubmit = (data: POFormData) => {
        console.log("Creating Purchase Order:", data);
        toast({ title: "Work in Progress", description: "Creating purchase orders is not yet fully implemented." });
        // TODO: Implement API call to `createPurchaseOrder` service
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2/></div>;
    if (!canCreatePOs) return <main className="p-4"><Alert variant="destructive"><AlertCircle/><AlertTitle>Access Denied</AlertTitle></Alert></main>;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8">
            <Card>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ShoppingCart/> Create Purchase Order</CardTitle>
                        <CardDescription>Order parts from a supplier.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="vendor-name">Supplier Name</Label>
                            <Controller name="vendor_name" control={control} render={({ field }) => <Input {...field} id="vendor-name" />} />
                            {errors.vendor_name && <p className="text-destructive text-sm">{errors.vendor_name.message}</p>}
                        </div>
                        <div className="space-y-4">
                            <Label>Line Items</Label>
                            {fields.map((item, index) => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
                                    <div className="col-span-5"><Controller name={`line_items.${index}.description`} control={control} render={({ field }) => <Input {...field} placeholder="Part Description"/>} /></div>
                                    <div className="col-span-2"><Controller name={`line_items.${index}.quantity`} control={control} render={({ field }) => <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)}/>} /></div>
                                    <div className="col-span-2"><Controller name={`line_items.${index}.unit_cost`} control={control} render={({ field }) => <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/>} /></div>
                                    <div className="col-span-3 flex justify-end gap-2">
                                        {/* TODO: Implement logic to link to inventory items */}
                                        <Button type="button" variant="outline" size="sm" disabled>Link to Inventory</Button>
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}><Trash2/></Button>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unit_cost: 0 })}><PlusCircle className="mr-2 h-4"/> Add Item</Button>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Controller name="notes" control={control} render={({ field }) => <Textarea {...field} id="notes" />} />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit"><Save className="mr-2 h-4"/> Create PO</Button>
                    </CardFooter>
                </form>
            </Card>
        </main>
    );
}
