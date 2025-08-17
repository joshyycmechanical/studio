
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Wrench, Save, AlertCircle, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import type { UserProfileWithRoles } from '@/types/user';
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from '@/types/work-order';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions';
// Import REAL Firestore service functions
import { fetchWorkOrderById, updateWorkOrder } from '@/services/workOrders';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyEquipment } from '@/services/equipment';
import { fetchCompanyUsers } from '@/services/users';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';


const workOrderStatuses: WorkOrderStatus[] = ['new', 'scheduled', 'in-progress', 'on-hold', 'completed', 'invoiced', 'cancelled'];
const workOrderPriorities: WorkOrderPriority[] = ['low', 'medium', 'high', 'emergency'];

const workOrderSchema = z.object({
  summary: z.string().min(1, "Summary is required."),
  description: z.string().optional().nullable(),
  status: z.enum(workOrderStatuses),
  priority: z.enum(workOrderPriorities),
  customer_id: z.string().min(1, "Customer is required."),
  location_id: z.string().min(1, "Location is required."),
  equipment_id: z.string().optional().nullable(),
  assigned_technician_id: z.string().optional().nullable(),
  scheduled_date: z.date().optional().nullable(),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;

export default function EditWorkOrderPage() {
    const router = useRouter();
    const { workOrderId } = useParams();
    const { toast } = useToast();
    const { user, companyId, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [technicians, setTechnicians] = useState<Partial<UserProfileWithRoles>[]>([]);
    const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
    const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const canEdit = !authLoading && hasPermission(user, 'work-orders', 'edit');
    const canView = !authLoading && hasPermission(user, 'work-orders', 'view');

    const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<WorkOrderFormData>({
        resolver: zodResolver(workOrderSchema),
        // Initialize all fields to a defined value to prevent uncontrolled -> controlled error
        defaultValues: {
            summary: '',
            description: '',
            status: 'new',
            priority: 'medium',
            customer_id: '',
            location_id: '',
            equipment_id: null,
            assigned_technician_id: null,
            scheduled_date: null,
        },
    });
    
    const selectedCustomerId = watch('customer_id');
    const selectedLocationId = watch('location_id');

    const { data: workOrder, isLoading: isLoadingWO, error: errorWO } = useQuery<WorkOrder | null>({
        queryKey: ['workOrder', workOrderId],
        queryFn: () => fetchWorkOrderById(companyId!, workOrderId as string),
        enabled: !!companyId && !!workOrderId && canView,
        onSuccess: (data) => {
            if (data) {
                reset({
                    ...data,
                    description: data.description ?? '', // Ensure description is a string
                    scheduled_date: data.scheduled_date ? new Date(data.scheduled_date) : null
                });
            }
        },
    });
    
    const fetchDropdownData = useCallback(async () => {
        if (!companyId) return;
        try {
            const [customerData, locationData, equipmentData, techData] = await Promise.all([
                fetchCompanyCustomers(companyId),
                fetchCompanyLocations(companyId),
                fetchCompanyEquipment(companyId),
                fetchCompanyUsers(companyId),
            ]);
            setCustomers(customerData);
            setLocations(locationData);
            setEquipment(equipmentData);
            setTechnicians(techData);
            setIsDataLoaded(true);
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load necessary data.' });
        }
    }, [companyId, toast]);

    useEffect(() => {
        if (!authLoading && canEdit) fetchDropdownData();
    }, [authLoading, canEdit, fetchDropdownData]);
    
    useEffect(() => {
        if (selectedCustomerId && locations.length) {
            setFilteredLocations(locations.filter(l => l.customer_id === selectedCustomerId));
        }
    }, [selectedCustomerId, locations]);
    
    useEffect(() => {
        if (selectedLocationId && equipment.length) {
             setFilteredEquipment(equipment.filter(e => e.location_id === selectedLocationId));
        }
    }, [selectedLocationId, equipment]);
    
    const updateMutation = useMutation({
        mutationFn: (data: WorkOrderFormData) => {
            if (!canEdit || !workOrder) throw new Error("Permission denied or work order not found.");
            // The service function now expects the full form data for easier mapping.
            return updateWorkOrder(companyId!, workOrderId as string, data);
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Work order updated successfully." });
            queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
            queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
            router.push(`/work-orders/${workOrderId}`);
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        }
    });

    const onSubmit = (data: WorkOrderFormData) => {
        updateMutation.mutate(data);
    };

    if (authLoading || isLoadingWO) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!canEdit) {
        return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /> <AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to edit this work order.</AlertDescription></Alert>;
    }

    if (errorWO) {
        return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle><AlertDescription>{(errorWO as Error).message}</AlertDescription></Alert>;
    }

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-6 w-6" /> Edit Work Order #{workOrder?.work_order_number}
                    </CardTitle>
                    <CardDescription>Update the details for this work order.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Column 1 */}
                        <div className="space-y-4">
                            <Controller name="summary" control={control} render={({ field }) => (<div><Label htmlFor="summary">Summary <span className="text-destructive">*</span></Label><Input id="summary" {...field} />{errors.summary && <p className="text-sm text-destructive">{errors.summary.message}</p>}</div>)} />
                            <Controller name="description" control={control} render={({ field }) => (<div><Label htmlFor="description">Description</Label><Textarea id="description" {...field} value={field.value ?? ''} rows={5}/></div>)} />
                        </div>
                         {/* Column 2 */}
                        <div className="space-y-4">
                            <Controller name="status" control={control} render={({ field }) => (<div><Label htmlFor="status">Status</Label><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{workOrderStatuses.map(s => <SelectItem key={s} value={s}>{formatEnum(s)}</SelectItem>)}</SelectContent></Select></div>)} />
                            <Controller name="priority" control={control} render={({ field }) => (<div><Label htmlFor="priority">Priority</Label><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{workOrderPriorities.map(p => <SelectItem key={p} value={p}>{formatEnum(p)}</SelectItem>)}</SelectContent></Select></div>)} />
                            <Controller name="customer_id" control={control} render={({ field }) => (<div><Label htmlFor="customer_id">Customer</Label><Select onValueChange={field.onChange} value={field.value} disabled={!isDataLoaded}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>{errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}</div>)} />
                            <Controller name="location_id" control={control} render={({ field }) => (<div><Label htmlFor="location_id">Location</Label><Select onValueChange={field.onChange} value={field.value} disabled={!selectedCustomerId || !isDataLoaded}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>{errors.location_id && <p className="text-sm text-destructive">{errors.location_id.message}</p>}</div>)} />
                            <Controller name="equipment_id" control={control} render={({ field }) => (<div><Label htmlFor="equipment_id">Equipment</Label><Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={!selectedLocationId || !isDataLoaded}><SelectTrigger><SelectValue placeholder="None"/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{filteredEquipment.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>)} />
                            <Controller name="assigned_technician_id" control={control} render={({ field }) => (<div><Label htmlFor="assigned_technician_id">Assigned Technician</Label><Select onValueChange={(value) => field.onChange(value === 'unassigned' ? null : value)} value={field.value ?? 'unassigned'} disabled={!isDataLoaded}><SelectTrigger><SelectValue placeholder="Unassigned"/></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{technicians.map(t => <SelectItem key={t.id!} value={t.id!}>{t.full_name}</SelectItem>)}</SelectContent></Select></div>)} />
                            <Controller name="scheduled_date" control={control} render={({ field }) => (<div><Label htmlFor="scheduled_date">Scheduled Date</Label><Popover><PopoverTrigger asChild><Button id="scheduled_date" variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : 'Select date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} /></PopoverContent></Popover></div>)} />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" disabled={updateMutation.isPending || !isDataLoaded}>
                            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </main>
    );
}
