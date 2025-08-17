
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FormProvider, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Briefcase, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { fetchWorkOrderById, updateWorkOrder } from '@/services/workOrders';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyEquipment } from '@/services/equipment';
import { fetchCompanyUsers } from '@/services/users';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkOrder } from '@/types/work-order';
import { DynamicWorkOrderForm } from '@/components/work-orders/form/DynamicWorkOrderForm';
import { standardWorkOrderFields, generateSchema } from '@/lib/form-fields'; // Import generateSchema
import { FormFieldConfig } from '@/types/form-fields';
import { fetchCompanyCustomFields } from '@/services/customization';

export default function EditWorkOrderPage() {
    const router = useRouter();
    const { workOrderId } = useParams();
    const { toast } = useToast();
    const { user, companyId, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    
    // Manage dynamic field order
    const [fields, setFields] = useState<FormFieldConfig[]>(standardWorkOrderFields);
    
    const canEdit = !authLoading && hasPermission(user, 'work-orders', 'edit');
    const canView = !authLoading && hasPermission(user, 'work-orders', 'view');

     const { data: customFields = [], isLoading: isLoadingCustomFields } = useQuery({
        queryKey: ['customFields', companyId, 'work-order'],
        queryFn: () => fetchCompanyCustomFields(companyId!, 'work-order'),
        enabled: !!companyId && canView,
    });

    const combinedFields = React.useMemo(() => {
        const customFormFields = customFields.map(cf => ({ ...cf, is_custom: true, options: cf.options || [] }));
        return [...standardWorkOrderFields, ...customFormFields].sort((a, b) => a.sort_order - b.sort_order);
    }, [customFields]);

    const dynamicSchema = React.useMemo(() => generateSchema(combinedFields), [combinedFields]);

    const form = useForm({
        resolver: zodResolver(dynamicSchema),
        defaultValues: combinedFields.reduce((acc, field) => ({ ...acc, [field.name]: field.type === 'date' ? null : '' }), {}),
    });

    const { data: workOrder, isLoading: isLoadingWO, error: errorWO } = useQuery({
        queryKey: ['workOrder', workOrderId],
        queryFn: () => fetchWorkOrderById(companyId!, workOrderId as string),
        enabled: !!companyId && !!workOrderId && canView,
        onSuccess: (data) => {
            if (data) {
                const formData = {
                    ...data,
                    scheduled_date: data.scheduled_date ? new Date(data.scheduled_date) : null,
                };
                form.reset(formData);
            }
        },
    });
    
    // Data fetching for dropdowns
    const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => fetchCompanyCustomers(companyId!), enabled: !!companyId });
    const { data: locations = [], isLoading: isLoadingLocations } = useQuery({ queryKey: ['locations', companyId], queryFn: () => fetchCompanyLocations(companyId!), enabled: !!companyId });
    const { data: equipment = [], isLoading: isLoadingEquipment } = useQuery({ queryKey: ['equipment', companyId], queryFn: () => fetchCompanyEquipment(companyId!), enabled: !!companyId });
    const { data: technicians = [], isLoading: isLoadingTechs } = useQuery({ queryKey: ['users', companyId], queryFn: () => fetchCompanyUsers(companyId!), enabled: !!companyId });
    
    const loadingDropdowns = isLoadingCustomers || isLoadingLocations || isLoadingEquipment || isLoadingTechs;

    const dropdownData = {
        customers: customers,
        locations: locations,
        equipment: equipment,
        assigned_technician_id: technicians,
        status: ['new', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled'],
        priority: ['low', 'medium', 'high', 'emergency'],
    };

    const updateMutation = useMutation({
        mutationFn: (data: Partial<WorkOrder>) => {
            if (!canEdit || !workOrder) throw new Error("Permission denied or work order not found.");
            return updateWorkOrder(companyId!, workOrderId as string, data);
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Work order updated successfully." });
            queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
            router.push(`/work-orders/${workOrderId}`);
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        }
    });

    const onSubmit = (data: any) => {
        updateMutation.mutate(data);
    };

    if (authLoading || isLoadingWO || isLoadingCustomFields) {
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
             <FormProvider {...form}>
                <DynamicWorkOrderForm
                    fields={fields}
                    setFields={setFields}
                    onSubmit={onSubmit}
                    isLoading={isLoadingWO || loadingDropdowns}
                    isSubmitting={updateMutation.isPending}
                    isEditMode={true}
                    dropdownData={dropdownData}
                    // No customerFormProps needed for editing
                />
             </FormProvider>
        </main>
    );
}
