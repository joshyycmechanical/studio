
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { ChecklistInstance, ChecklistTemplate, ChecklistInstanceAnswer, ChecklistTemplateField } from '@/types/checklist';
import { fetchChecklistInstanceById, updateChecklistInstanceAnswers, fetchChecklistTemplateById } from '@/services/checklists';
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ImageUploadField } from '@/components/common/ImageUploadField';
import { LogDeficiencyField } from '@/components/common/LogDeficiencyField';

// This component will render the correct input based on field type
const renderField = (field: ChecklistTemplateField, answer: ChecklistInstanceAnswer | undefined, onChange: (value: any, attachmentUrl?: string | null, deficiencyId?: string | null) => void, companyId: string, instance: ChecklistInstance) => {
    switch(field.field_type) {
        case 'checkbox':
            return <Checkbox checked={!!answer?.value} onCheckedChange={(checked) => onChange(checked, null, null)} />;
        case 'text':
            return <Input value={answer?.value || ''} onChange={(e) => onChange(e.target.value, null, null)} />;
        case 'textarea':
             return <Textarea value={answer?.value || ''} onChange={(e) => onChange(e.target.value, null, null)} />;
        case 'radio':
            return (
                <RadioGroup onValueChange={(value) => onChange(value, null, null)} value={answer?.value}>
                    {field.options?.map((opt: string) => <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} id={`${field.id}-${opt}`} /><Label htmlFor={`${field.id}-${opt}`}>{opt}</Label></div>)}
                </RadioGroup>
            );
        case 'photo':
            return <ImageUploadField
                        value={answer?.attachment_url || null}
                        onChange={(url) => onChange(answer?.value || 'Photo taken', url, null)}
                        storagePath={`companies/${companyId}/checklist_instances/${instance.id}`}
                   />
        case 'deficiency':
            return <LogDeficiencyField
                        workOrderId={instance.work_order_id}
                        locationId={instance.location_id} // Assuming location_id is on the instance
                        equipmentId={instance.equipment_id} // Assuming equipment_id is on the instance
                        onDeficiencyLogged={(deficiencyId) => onChange('Deficiency Logged', null, deficiencyId)}
                   />
        default:
            return <p className="text-sm text-muted-foreground">Unsupported field type: {field.field_type}</p>;
    }
}

export default function FillChecklistPage() {
    const router = useRouter();
    const { checklistId: instanceId } = useParams() as { checklistId: string };
    const { user, companyId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const [answers, setAnswers] = React.useState<Map<string, ChecklistInstanceAnswer>>(new Map());

    const canFill = !authLoading && hasPermission(user, 'checklists', 'fill');

    const { data: instance, isLoading: isLoadingInstance, error: errorInstance } = useQuery<ChecklistInstance | null>({
        queryKey: ['checklistInstance', instanceId],
        queryFn: () => fetchChecklistInstanceById(instanceId),
        enabled: !!instanceId && canFill,
    });
    
    React.useEffect(() => {
        if (instance) {
            const initialAnswers = new Map<string, ChecklistInstanceAnswer>();
            instance.answers.forEach((ans: ChecklistInstanceAnswer) => {
                initialAnswers.set(ans.field_id, ans);
            });
            setAnswers(initialAnswers);
        }
    }, [instance]);


    const { data: template, isLoading: isLoadingTemplate, error: errorTemplate } = useQuery<ChecklistTemplate | null>({
        queryKey: ['checklistTemplate', instance?.template_id],
        queryFn: () => fetchChecklistTemplateById(companyId!, instance!.template_id),
        enabled: !!companyId && !!instance?.template_id,
    });

    const mutation = useMutation({
        mutationFn: (newAnswers: ChecklistInstanceAnswer[]) => {
            return updateChecklistInstanceAnswers(instanceId, newAnswers, 'in-progress');
        },
        onSuccess: () => {
            toast({ title: "Checklist Saved", description: "Your progress has been saved." });
            queryClient.invalidateQueries({ queryKey: ['checklistInstance', instanceId] });
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Save Failed", description: error.message });
        }
    });

    const handleAnswerChange = (field_id: string, value: any, attachment_url?: string | null, related_deficiency_id?: string | null) => {
        setAnswers(prev => {
            const newAnswers = new Map(prev);
            const existingAnswer = prev.get(field_id) || { field_id };
            newAnswers.set(field_id, { 
                ...existingAnswer, 
                value, 
                attachment_url: attachment_url !== undefined ? attachment_url : existingAnswer.attachment_url,
                related_deficiency_id: related_deficiency_id !== undefined ? related_deficiency_id : existingAnswer.related_deficiency_id
            });
            return newAnswers;
        });
    };
    
    const handleSave = () => {
        mutation.mutate(Array.from(answers.values()));
    };
    
    const isLoading = isLoadingInstance || isLoadingTemplate || authLoading;
    const error = errorInstance || errorTemplate;

    if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
    if (!canFill) return <Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle></Alert>;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>{template?.name}</CardTitle>
                    <CardDescription>{template?.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {template?.fields.sort((a, b) => a.position - b.position).map((field: ChecklistTemplateField) => (
                        <div key={field.id} className="p-4 border rounded-lg">
                            <Label className="font-semibold text-base">{field.label}</Label>
                            {field.description && <p className="text-sm text-muted-foreground mb-2">{field.description}</p>}
                            {renderField(field, answers.get(field.id), (value, url, defId) => handleAnswerChange(field.id, value, url, defId), companyId!, instance!)}
                        </div>
                    ))}
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={handleSave} disabled={mutation.isPending}>
                        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save Progress
                    </Button>
                </CardFooter>
            </Card>
        </main>
    )
}
