
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { PlusCircle, Loader2 } from 'lucide-react';

const newCustomerWithLocationSchema = z.object({
    customerName: z.string().min(1, 'Customer name is required'),
    locationName: z.string().min(1, 'Location name is required'),
    addressLine1: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    province: z.string().min(1, 'Province/State is required'),
    postalCode: z.string().min(1, 'Postal/Zip Code is required'),
});

type NewCustomerFormData = z.infer<typeof newCustomerWithLocationSchema>;

interface CustomerLocationFormProps {
    isSubmitting: boolean;
    onSubmit: (data: NewCustomerFormData) => void;
    customerForm: any; // React Hook Form's form object
    isCustomerDialogOpen: boolean;
    setIsCustomerDialogOpen: (isOpen: boolean) => void;
}

export function CustomerLocationForm({ isSubmitting, onSubmit, customerForm, isCustomerDialogOpen, setIsCustomerDialogOpen }: CustomerLocationFormProps) {
    return (
        <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0" title="Add New Customer">
                    <PlusCircle className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                 <form onSubmit={customerForm.handleSubmit(onSubmit)}>
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
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create & Select
                    </Button>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    )
}
