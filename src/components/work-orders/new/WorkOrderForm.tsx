
'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Briefcase, Save, Loader2 } from 'lucide-react';
import { cn, formatEnum } from '@/lib/utils';
import { CustomerLocationForm } from './CustomerLocationForm';

export function WorkOrderForm({
    onSubmit,
    isSubmitting,
    isLoading,
    dropdownData,
    customerFormProps,
    router
}) {
    // FIX: Use useFormContext instead of prop drilling workOrderForm
    const { control, watch, formState: { errors } } = useFormContext(); 
    const selectedCustomerId = watch('customer_id');
    const workOrderStatuses = ['new', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled'];
    const workOrderPriorities = ['low', 'medium', 'high', 'emergency'];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-6 w-6" /> Create New Work Order
                </CardTitle>
                <CardDescription>Fill in the details below to create a new service call.</CardDescription>
            </CardHeader>
            <form onSubmit={onSubmit}>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1 */}
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="customer_id">Customer <span className="text-destructive">*</span></Label>
                            <div className="flex items-center gap-2">
                                <Controller
                                    name="customer_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                                            <SelectTrigger id="customer_id"><SelectValue placeholder={isLoading ? "Loading..." : "Select Customer"} /></SelectTrigger>
                                            <SelectContent>{dropdownData.customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )}
                                />
                                <CustomerLocationForm
                                    isSubmitting={customerFormProps.isSubmittingCustomer}
                                    onSubmit={customerFormProps.handleCreateNewCustomer}
                                    customerForm={customerFormProps.customerForm}
                                    isCustomerDialogOpen={customerFormProps.isCustomerDialogOpen}
                                    setIsCustomerDialogOpen={customerFormProps.setIsCustomerDialogOpen}
                                />
                            </div>
                            {errors.customer_id && <p className="text-sm text-destructive mt-1">{errors.customer_id.message as string}</p>}
                        </div>

                        <div>
                            <Label htmlFor="location_id">Location <span className="text-destructive">*</span></Label>
                            <Controller
                                name="location_id"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCustomerId || isLoading || dropdownData.locations.length === 0}>
                                        <SelectTrigger id="location_id"><SelectValue placeholder={!selectedCustomerId ? "Select customer first" : "Select Location"} /></SelectTrigger>
                                        <SelectContent>{dropdownData.locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.address_line1})</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.location_id && <p className="text-sm text-destructive mt-1">{errors.location_id.message as string}</p>}
                        </div>

                        <div>
                            <Label htmlFor="summary">Summary <span className="text-destructive">*</span></Label>
                            <Controller name="summary" control={control} render={({ field }) => <Input id="summary" placeholder="e.g., Walk-in freezer not cooling" {...field} />} />
                            {errors.summary && <p className="text-sm text-destructive mt-1">{errors.summary.message as string}</p>}
                        </div>

                        <div>
                            <Label htmlFor="description">Description (Scope of Work)</Label>
                            <Controller name="description" control={control} render={({ field }) => <Textarea id="description" placeholder="Customer reports alarm on unit #3. Suspect compressor failure." {...field} value={field.value ?? ''} rows={4}/>} />
                        </div>
                    </div>

                    {/* Column 2 */}
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="status">Status</Label>
                            <Controller name="status" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                    <SelectContent>{workOrderStatuses.map(s => <SelectItem key={s} value={s}>{formatEnum(s)}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                        </div>

                        <div>
                            <Label htmlFor="priority">Priority</Label>
                            <Controller name="priority" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                                    <SelectContent>{workOrderPriorities.map(p => <SelectItem key={p} value={p}>{formatEnum(p)}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                        </div>

                        <div>
                            <Label htmlFor="assigned_technician_id">Assigned Technician</Label>
                            <Controller name="assigned_technician_id" control={control} render={({ field }) => (
                                <Select onValueChange={v => field.onChange(v === 'unassigned' ? null : v)} value={field.value ?? 'unassigned'} disabled={isLoading}>
                                    <SelectTrigger id="assigned_technician_id"><SelectValue placeholder="Assign Technician" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                                        {dropdownData.technicians.map((t: any) => <SelectItem key={t.id} value={t.id!}>{t.full_name ?? t.email}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>

                        <div>
                            <Label htmlFor="scheduled_date">Scheduled Date</Label>
                            <Controller name="scheduled_date" control={control} render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="scheduled_date" variant="outline" className={cn(!field.value && "text-muted-foreground", "w-full justify-start text-left font-normal")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} /></PopoverContent>
                                </Popover>
                            )} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || isLoading}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Create Work Order
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
