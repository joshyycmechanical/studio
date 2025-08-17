
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, PlusCircle, Trash2, GripVertical, ArrowUp, ArrowDown, ClipboardCheck, AlertCircle, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { ChecklistFieldType, ChecklistTemplateField, ChecklistTemplate } from '@/types/checklist';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions';
import { format } from 'date-fns';
import { fetchPlatformChecklistTemplateById, updatePlatformChecklistTemplate } from '@/services/checklists';

const fieldTypes: ChecklistFieldType[] = [
  'text', 'number', 'toggle', 'dropdown', 'multiselect', 'date', 'time', 'photo', 'signature', 'rating', 'barcode', 'location'
];
const ratingScales = [5, 10] as const;

// Define the form schema using Zod
const fieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Label is required'),
  field_type: z.enum(fieldTypes),
  is_required: z.boolean().default(false),
  position: z.number(),
  options: z.string().optional(),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  default_value: z.any().optional(),
  supports_attachment: z.boolean().default(false),
  rating_scale: z.number().optional().nullable(),
}).refine(data => data.field_type !== 'rating' || (data.field_type === 'rating' && data.rating_scale), {
    message: "Rating Scale is required for 'rating' field type.",
    path: ["rating_scale"],
});

const templateSchema = z.object({
  name: z.string().min(1, 'Template Name is required'),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1, 'At least one field is required.'),
});

type TemplateFormData = z.infer<typeof templateSchema>;

export default function EditPlatformChecklistTemplatePage() {
  const router = useRouter();
  const { templateId } = useParams() as { templateId: string };
  const { toast } = useToast();
  const { user, firebaseUser, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [templateData, setTemplateData] = useState<ChecklistTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageTemplates = !authLoading && hasPermission(user, 'platform-templates', 'manage');

  const { control, handleSubmit, register, watch, reset, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: '', description: '', fields: [] },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'fields',
    keyName: "fieldId"
  });

  const watchedFields = watch('fields');

  const fetchData = useCallback(async () => {
    if (!canManageTemplates || !firebaseUser) {
        if (!authLoading) setError("Access Denied.");
        setIsLoading(false);
        return;
    }
    if (!templateId) {
        setError("Template ID is missing.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const foundTemplate = await fetchPlatformChecklistTemplateById(idToken, templateId);
      if (!foundTemplate) throw new Error("Platform checklist template not found.");

      setTemplateData(foundTemplate);
      const formData = {
        ...foundTemplate,
        description: foundTemplate.description ?? '',
        fields: (foundTemplate.fields ?? []).map(f => ({
          ...f,
          options: Array.isArray(f.options) ? f.options.join(', ') : '',
          rating_scale: f.rating_scale ?? null,
          supports_attachment: f.supports_attachment ?? false,
          placeholder: f.placeholder ?? '',
          description: f.description ?? '',
        }))
      };
      reset(formData);
    } catch (err: any) {
      setError(err.message || "Failed to load template data.");
    } finally {
      setIsLoading(false);
    }
  }, [templateId, reset, canManageTemplates, authLoading, firebaseUser]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addField = () => {
    append({
      id: `new-${Date.now()}`,
      label: '',
      field_type: 'text',
      is_required: false,
      position: fields.length,
      options: '',
      placeholder: '',
      description: '',
      supports_attachment: false,
      rating_scale: null,
    });
  };

  const onSubmit = async (data: TemplateFormData) => {
    if (!canManageTemplates || !templateData || !firebaseUser) return;
    setIsSubmitting(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const updateData: Partial<Omit<ChecklistTemplate, 'id' | 'company_id' | 'is_platform_template'>> = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        fields: data.fields.map((field, index) => ({
          id: field.id.startsWith('new-') ? `field_${Date.now()}_${index}` : field.id,
          label: field.label.trim(),
          field_type: field.field_type,
          is_required: field.is_required,
          position: index,
          options: (field.field_type === 'dropdown' || field.field_type === 'multiselect') ? field.options?.split(',').map(opt => opt.trim()).filter(Boolean) ?? [] : null,
          placeholder: field.placeholder?.trim() || null,
          description: field.description?.trim() || null,
          default_value: field.default_value ?? null,
          supports_attachment: !!field.supports_attachment,
          rating_scale: field.field_type === 'rating' ? field.rating_scale : null,
        })),
      };
      await updatePlatformChecklistTemplate(idToken, templateData.id, updateData);
      toast({ title: "Template Updated", description: `Template "${data.name}" has been successfully updated.` });
      router.push('/platform/templates');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update the template." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;

  if (error) return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
      <Alert variant="destructive" className="m-4 max-w-md">
        <AlertCircle className="h-4 w-4" /><AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Template'}</AlertTitle><AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" onClick={() => router.push('/platform/templates')} className="mt-4">Back to Templates</Button>
      </Alert>
    </main>
  );

  if (!templateData) return <main className="flex flex-1 items-center justify-center"><p>Template data could not be loaded.</p></main>;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-6 w-6" /> Edit Platform Checklist Template</CardTitle>
            <CardDescription>Modify the platform-wide template "{templateData.name}".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name <span className="text-destructive">*</span></Label>
                <Input id="name" {...register("name")} placeholder="e.g., HVAC Quarterly PM" />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} placeholder="Optional: Briefly describe this checklist's purpose" />
              </div>
            </div>
            <hr/>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Checklist Fields</h3>
              {errors.fields?.root && <p className="text-sm text-destructive mt-1">{errors.fields.root.message}</p>}
              {fields.map((field, index) => (
                <Card key={field.fieldId} className="p-4 border bg-muted/50">
                  <div className="flex items-center gap-2 mb-4">
                     <Button type="button" variant="ghost" size="icon" className="cursor-grab" title="Drag to reorder"><GripVertical className="h-4 w-4" /></Button>
                    <Label className="flex-1">Field {index + 1}</Label>
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index - 1)} disabled={index === 0} title="Move Up"><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} title="Move Down"><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} title="Delete Field"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`fields.${index}.label`}>Label / Question <span className="text-destructive">*</span></Label>
                      <Input id={`fields.${index}.label`} {...register(`fields.${index}.label`)} placeholder="e.g., Check Filter Condition" />
                      {errors.fields?.[index]?.label && <p className="text-sm text-destructive mt-1">{errors.fields?.[index]?.label?.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor={`fields.${index}.field_type`}>Field Type <span className="text-destructive">*</span></Label>
                      <Controller name={`fields.${index}.field_type`} control={control} render={({ field: controllerField }) => (
                        <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                          <SelectTrigger id={`fields.${index}.field_type`}><SelectValue placeholder="Select Type" /></SelectTrigger>
                          <SelectContent>{fieldTypes.map(type => (<SelectItem key={type} value={type} className="capitalize">{type.replace('-', ' ')}</SelectItem>))}</SelectContent>
                        </Select>
                      )} />
                      {errors.fields?.[index]?.field_type && <p className="text-sm text-destructive mt-1">{errors.fields?.[index]?.field_type?.message}</p>}
                    </div>
                    {(watchedFields[index]?.field_type === 'dropdown' || watchedFields[index]?.field_type === 'multiselect') && (
                      <div className="md:col-span-2">
                        <Label htmlFor={`fields.${index}.options`}>Options (comma-separated)</Label>
                        <Input id={`fields.${index}.options`} {...register(`fields.${index}.options`)} placeholder="e.g., Good, Fair, Poor" />
                      </div>
                    )}
                    {watchedFields[index]?.field_type === 'rating' && (
                      <div>
                        <Label htmlFor={`fields.${index}.rating_scale`}>Rating Scale <span className="text-destructive">*</span></Label>
                        <Controller name={`fields.${index}.rating_scale`} control={control} render={({ field: controllerField }) => (
                          <Select onValueChange={(value) => controllerField.onChange(value ? parseInt(value) : null)} value={controllerField.value?.toString() ?? ''}>
                            <SelectTrigger id={`fields.${index}.rating_scale`}><SelectValue placeholder="Select Scale" /></SelectTrigger>
                            <SelectContent>{ratingScales.map(scale => (<SelectItem key={scale} value={scale.toString()}>1 - {scale}</SelectItem>))}</SelectContent>
                          </Select>
                        )} />
                        {errors.fields?.[index]?.rating_scale && <p className="text-sm text-destructive mt-1">{errors.fields?.[index]?.rating_scale?.message}</p>}
                      </div>
                    )}
                    <div>
                      <Label htmlFor={`fields.${index}.placeholder`}>Placeholder</Label>
                      <Input id={`fields.${index}.placeholder`} {...register(`fields.${index}.placeholder`)} placeholder="Optional: e.g., Enter reading" />
                    </div>
                    <div>
                      <Label htmlFor={`fields.${index}.description`}>Help Text / Description</Label>
                      <Input id={`fields.${index}.description`} {...register(`fields.${index}.description`)} placeholder="Optional: Instructions for the user" />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 items-center mt-2">
                      <div className="flex items-center space-x-2">
                        <Controller name={`fields.${index}.is_required`} control={control} render={({ field: controllerField }) => (<Checkbox id={`fields.${index}.is_required`} checked={controllerField.value} onCheckedChange={controllerField.onChange} className="form-checkbox" />)} />
                        <Label htmlFor={`fields.${index}.is_required`} className="font-normal">Required Field</Label>
                      </div>
                      {watchedFields[index]?.field_type !== 'photo' && (
                        <div className="flex items-center space-x-2">
                          <Controller name={`fields.${index}.supports_attachment`} control={control} render={({ field: controllerField }) => (<Checkbox id={`fields.${index}.supports_attachment`} checked={controllerField.value} onCheckedChange={controllerField.onChange} className="form-checkbox" />)} />
                          <Label htmlFor={`fields.${index}.supports_attachment`} className="font-normal">Allow Attachment</Label>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={addField} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Add Field</Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !canManageTemplates}><Loader2 className="mr-2 h-4 w-4 animate-spin" />Save Changes</Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
