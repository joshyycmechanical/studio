
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, ArrowLeft, Edit } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { fetchDeficiencyById, updateDeficiency } from '@/services/deficiencies';
import { fetchCompanyCustomFields } from '@/services/customization';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DynamicForm } from '@/components/common/DynamicForm';
import { FormFieldConfig } from '@/types/form-fields';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyEquipment } from '@/services/equipment';

// Standard fields for the Deficiency entity.
const standardDeficiencyFields: FormFieldConfig[] = [
    { name: 'description', label: 'Description', type: 'textarea', required: true, sort_order: 10, fullWidth: true, placeholder: 'Describe the issue...', rows: 4, is_custom: false },
    { name: 'severity', label: 'Severity', type: 'select', required: true, sort_order: 20, options: ['low', 'medium', 'high', 'critical'], is_custom: false },
    { name: 'status', label: 'Status', type: 'select', required: true, sort_order: 30, options: ['open', 'in-progress', 'resolved', 'cancelled'], is_custom: false },
    { name: 'resolution_notes', label: 'Resolution Notes', type: 'textarea', required: false, sort_order: 40, fullWidth: true, placeholder: 'Describe how the issue was resolved...', rows: 3, is_custom: false },
];

// Generates a Zod schema from field configurations for form validation.
const generateSchema = (fields: FormFieldConfig[]) => {
    const schemaObject = fields.reduce((acc, field) => {
        let zodType: z.ZodType<any, any> = z.any();
        switch (field.type) {
            case 'text':
            case 'textarea':
            case 'select':
                zodType = z.string().optional().nullable();
                if(field.required) zodType = z.string().min(1, `${field.label} is required.`);
                break;
            case 'number':
            case 'currency':
                zodType = z.coerce.number().optional().nullable();
                if(field.required) zodType = z.coerce.number();
                break;
        }
        acc[field.name] = zodType;
        return acc;
    }, {} as Record<string, z.ZodType<any, any>>);

    return z.object(schemaObject);
};

export default function DeficiencyDetailPage() {
    const { deficiencyId } = useParams() as { deficiencyId: string };
    const { user, companyId, loading: authLoading } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const canView = !authLoading && hasPermission(user, 'deficiencies', 'view');
    const canEdit = !authLoading && hasPermission(user, 'deficiencies', 'edit');
    
    // Fetch custom field definitions for deficiencies
    const { data: customFields = [], isLoading: isLoadingCustomFields } = useQuery({
        queryKey: ['customFields', companyId, 'deficiency'],
        queryFn: () => fetchCompanyCustomFields(companyId!, 'deficiency'),
        enabled: !!companyId && canView,
    });

    // Combine standard and custom fields into one configuration array
    const combinedFields = React.useMemo(() => {
        const customFormFields = customFields.map(cf => ({ ...cf, is_custom: true, options: cf.options || [] }));
        return [...standardDeficiencyFields, ...customFormFields].sort((a, b) => a.sort_order - b.sort_order);
    }, [customFields]);

    const dynamicSchema = React.useMemo(() => generateSchema(combinedFields), [combinedFields]);
    const form = useForm({
        resolver: zodResolver(dynamicSchema),
    });

    // Fetch the specific deficiency record
    const { data: deficiency, isLoading: isLoadingDeficiency, error: errorDeficiency } = useQuery({
        queryKey: ['deficiency', deficiencyId],
        queryFn: () => fetchDeficiencyById(companyId!, deficiencyId),
        enabled: !!companyId && !!deficiencyId && canView,
        onSuccess: (data) => {
            if (data) {
                // Populate the form with both standard and custom field data
                const formData = { ...data.custom_fields, ...data };
                form.reset(formData);
            }
        },
    });

    const { data: locations, isLoading: isLoadingLocations } = useQuery({
        queryKey: ['locations', companyId],
        queryFn: () => fetchCompanyLocations(companyId!),
        enabled: !!companyId && canView
    });

    const { data: equipment, isLoading: isLoadingEquipment } = useQuery({
        queryKey: ['equipment', companyId],
        queryFn: () => fetchCompanyEquipment(companyId!),
        enabled: !!companyId && canView
    });


    // Mutation for updating the deficiency
    const updateMutation = useMutation({
        mutationFn: async (formData: any) => {
            if (!canEdit || !deficiencyId) throw new Error("Permission denied or deficiency not found.");
            // Separate standard fields from custom fields before sending to the backend
            const standardData: { [key: string]: any } = {};
            const customFieldData: { [key: string]: any } = {};
            
            Object.keys(formData).forEach(key => {
                if (customFields.some(cf => cf.name === key)) {
                    customFieldData[key] = formData[key];
                } else if (standardDeficiencyFields.some(sf => sf.name === key)) {
                    standardData[key] = formData[key];
                }
            });
            
            const updatePayload = { ...standardData, custom_fields: customFieldData };
            return updateDeficiency(companyId!, deficiencyId, updatePayload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deficiency', deficiencyId] });
            router.push('/deficiencies');
        }
    });

    const onSubmit = (data: any) => updateMutation.mutate(data);

    const isLoading = authLoading || isLoadingDeficiency || isLoadingCustomFields || isLoadingLocations || isLoadingEquipment;
    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
    
    if (errorDeficiency) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(errorDeficiency as Error).message}</AlertDescription></Alert>;
    if (!canView) return <Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle></Alert>;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8">
            <FormProvider {...form}>
                 <DynamicForm
                    title={`Edit Deficiency`}
                    description="Update the details for this deficiency record."
                    fields={combinedFields}
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    isSubmitting={updateMutation.isPending}
                    isEditMode={true}
                    dropdownData={{
                        location_id: locations || [],
                        equipment_id: equipment || [],
                    }}
                />
            </FormProvider>
        </main>
    );
}
