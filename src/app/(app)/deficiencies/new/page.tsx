
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, ShieldAlert, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createDeficiency } from '@/services/deficiencies';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyEquipment } from '@/services/equipment';
import { DynamicForm } from '@/components/common/DynamicForm';
import { FormFieldConfig } from '@/types/form-fields';
import { fetchCompanyCustomFields } from '@/services/customization';

const standardDeficiencyFields: FormFieldConfig[] = [
    { name: 'description', label: 'Description', type: 'textarea', required: true, sort_order: 10, fullWidth: true, placeholder: 'Describe the issue...', rows: 4, is_custom: false },
    { name: 'severity', label: 'Severity', type: 'select', required: true, sort_order: 20, options: ['low', 'medium', 'high', 'critical'], is_custom: false },
    { name: 'location_id', label: 'Location', type: 'select', required: true, sort_order: 30, is_custom: false },
    { name: 'equipment_id', label: 'Related Equipment (Optional)', type: 'select', required: false, sort_order: 40, is_custom: false },
    { name: 'notes', label: 'Notes (Optional)', type: 'textarea', required: false, sort_order: 50, fullWidth: true, placeholder: 'Add any extra notes...', rows: 3, is_custom: false },
];

const generateSchema = (fields: FormFieldConfig[]) => {
    const schemaObject = fields.reduce((acc, field) => {
        let zodType: z.ZodType<any, any> = z.any(); // Default to any
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
            // Add other types as needed
        }
        acc[field.name] = zodType;
        return acc;
    }, {} as Record<string, z.ZodType<any, any>>);

    return z.object(schemaObject);
};

export default function NewDeficiencyPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, companyId, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();

    const canCreateDeficiencies = !authLoading && hasPermission(user, 'deficiencies', 'create');

    const { data: locations, isLoading: loadingLocations } = useQuery({
        queryKey: ['locations', companyId],
        queryFn: () => fetchCompanyLocations(companyId!),
        enabled: !!companyId && canCreateDeficiencies,
    });
    
    const { data: equipment, isLoading: isLoadingEquipment } = useQuery({
        queryKey: ['equipment', companyId],
        queryFn: () => fetchCompanyEquipment(companyId!),
        enabled: !!companyId && canCreateDeficiencies,
    });
    
    const { data: customFields = [], isLoading: isLoadingCustomFields } = useQuery({
        queryKey: ['customFields', companyId, 'deficiency'],
        queryFn: () => fetchCompanyCustomFields(companyId!, 'deficiency'),
        enabled: !!companyId && canCreateDeficiencies,
    });
    
    const combinedFields = React.useMemo(() => {
        const customFormFields = customFields.map(cf => ({ ...cf, is_custom: true, options: cf.options || [] }));
        return [...standardDeficiencyFields, ...customFormFields].sort((a, b) => a.sort_order - b.sort_order);
    }, [customFields]);

    const dynamicSchema = React.useMemo(() => generateSchema(combinedFields), [combinedFields]);
    const form = useForm({
        resolver: zodResolver(dynamicSchema),
        defaultValues: combinedFields.reduce((acc, field) => ({ ...acc, [field.name]: field.type === 'date' ? null : '' }), {}),
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!companyId || !user) throw new Error("Missing context.");
            const standardData = {
                description: data.description,
                severity: data.severity,
                location_id: data.location_id,
                equipment_id: data.equipment_id,
                notes: data.notes,
            };
            const customFieldData = Object.keys(data)
                .filter(key => customFields.some(cf => cf.name === key))
                .reduce((obj, key) => ({ ...obj, [key]: data[key] }), {});
            
            return createDeficiency(companyId, user.id, { ...standardData, custom_fields: customFieldData });
        },
        onSuccess: (data) => {
            toast({ title: "Deficiency Reported", description: `"${data.description.substring(0, 30)}..." has been logged.` });
            queryClient.invalidateQueries({ queryKey: ['deficiencies', companyId] });
            router.push('/deficiencies');
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Report Failed", description: error.message });
        },
    });

    const onSubmit = (data: any) => createMutation.mutate(data);
    
    const isLoading = authLoading || loadingLocations || isLoadingEquipment || isLoadingCustomFields;
    
    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!canCreateDeficiencies) return <main className="p-4"><Alert variant="destructive"><AlertCircle /> <AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to report new deficiencies.</AlertDescription></Alert></main>;
    
    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8">
            <FormProvider {...form}>
                 <DynamicForm
                    title="Report New Deficiency"
                    description="Log a new issue or problem found at a location or with equipment."
                    fields={combinedFields}
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    isSubmitting={createMutation.isPending}
                    isEditMode={false}
                    dropdownData={{
                        location_id: locations || [],
                        equipment_id: equipment || [],
                    }}
                />
            </FormProvider>
        </main>
    );
}
