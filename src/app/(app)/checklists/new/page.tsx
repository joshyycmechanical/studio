'use client';

import * as React from 'react';
import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, PlusCircle, Trash2, GripVertical, ArrowUp, ArrowDown, ClipboardCheck, Star, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions'; // Import permission checker
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Import Alert
import type { ChecklistFieldType, ChecklistTemplateField, ChecklistTemplate } from '@/types/checklist';
// Import real data service function
import { createChecklistTemplate } from '@/services/checklists';

const fieldTypes: ChecklistFieldType[] = [
  'text', 'number', 'toggle', 'dropdown', 'multiselect', 'date', 'time', 'photo', 'signature', 'rating', 'barcode', 'location'
];
const ratingScales = [5, 10] as const;

// Define the form schema using Zod
const fieldSchema = z.object({
  id: z.string().optional(), // Allow optional ID for consistency, but it's not sent to backend on create
  label: z.string().min(1, 'Label is required'),
  field_type: z.enum(fieldTypes),
  is_required: z.boolean().default(false),
  position: z.number(), // Will be set based on array index
  options: z.string().optional(), // Comma-separated for editing
  placeholder: z.string().optional(),
  description: z.string().optional(),
  default_value: z.any().optional(), // More specific validation needed based on field_type
  supports_attachment: z.boolean().default(false),
  rating_scale: z.number().optional().nullable(),
}).refine(data => data.field_type !== 'rating' || (data.field_type === 'rating' && data.rating_scale), {
    message: "Rating Scale is required when field type is 'rating'.",
    path: ["rating_scale"],
});


const templateSchema = z.object({
  name: z.string().min(1, 'Template Name is required'),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1, 'At least one field is required.'), // Require at least one field
});

type TemplateFormData = z.infer<typeof templateSchema>;

export default function NewChecklistTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth(); // Added authLoading
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageChecklists = !authLoading && hasPermission(user, 'checklists', 'manage');

  const {
    control,
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      fields: [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'fields',
     keyName: "fieldId" // Use a different name to avoid conflict with field.id from data
  });

  const addField = () => {
    append({
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

  const watchedFields = watch('fields');

  // Use the createChecklistTemplate service function
  const onSubmit = async (data: TemplateFormData) => {
    if (!canManageChecklists) {
       toast({ variant: "destructive", title: "Permission Denied", description: "You cannot create checklist templates." });
       return;
    }
    if (!companyId || !user?.id) { // Check for user ID as well
      toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
      return;
    }
    setIsSubmitting(true);

    // Prepare data for the service function
     const templateData: Omit<ChecklistTemplate, 'id' | 'company_id' | 'created_at' | 'created_by'> = {
         name: data.name.trim(),
         description: data.description?.trim() || null,
         fields: data.fields.map((field, index) => ({
            // Map form data to ChecklistTemplateField structure
            id: `field-${Date.now()}-${index}`, // Generate ID for storage (or let backend handle)
            label: field.label.trim(),
            field_type: field.field_type,
            is_required: field.is_required,
            position: index, // Set position based on array order
            options: (field.field_type === 'dropdown' || field.field_type === 'multiselect')
                ? field.options?.split(',').map(opt => opt.trim()).filter(Boolean) ?? []
                : null,
            placeholder: field.placeholder?.trim() || null,
            description: field.description?.trim() || null,
            default_value: field.default_value ?? null,
            supports_attachment: !!field.supports_attachment,
            rating_scale: field.field_type === 'rating' ? field.rating_scale : null,
         })),
         is_platform_template: false, // Always false for company-created templates
     };

    console.log("Submitting New Template Data:", templateData);

    try {
      await createChecklistTemplate(companyId, user.id, templateData);

      toast({
        title: "Template Created",
        description: `Template "${data.name}" has been successfully created.`,
      });
      router.push('/checklists'); // Redirect back to the list page

    } catch (error: any) {
      console.error("Failed to create template:", error);
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the template. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Checks ---
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canManageChecklists) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to create checklist templates.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </main>
    );
  }
   // --- End Render Checks ---


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <ClipboardCheck className="h-6 w-6" /> Create New Checklist Template
            </CardTitle>
            <CardDescription>Design a new checklist template for your team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Template Info */}
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

            {/* Fields Builder */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Checklist Fields</h3>
               {errors.fields?.root && <p className="text-sm text-destructive mt-1">{errors.fields.root.message}</p>} {/* Display root error for min length */}
              {fields.map((field, index) => (
                <Card key={field.fieldId} className="p-4 border bg-muted/50"> {/* Use fieldId from useFieldArray */}
                  <div className="flex items-center gap-2 mb-4">
                     <Button type="button" variant="ghost" size="icon" className="cursor-grab" title="Drag to reorder">
                        <GripVertical className="h-4 w-4" />
                     </Button>
                    <Label className="flex-1">Field {index + 1}</Label>
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index - 1)} disabled={index === 0} title="Move Up">
                       <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} title="Move Down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} title="Delete Field">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Field Label */}
                    <div>
                      <Label htmlFor={`fields.${index}.label`}>Label / Question <span className="text-destructive">*</span></Label>
                      <Input id={`fields.${index}.label`} {...register(`fields.${index}.label`)} placeholder="e.g., Check Filter Condition" />
                      {errors.fields?.[index]?.label && <p className="text-sm text-destructive mt-1">{errors.fields?.[index]?.label?.message}</p>}
                    </div>
                    {/* Field Type */}
                    <div>
                      <Label htmlFor={`fields.${index}.field_type`}>Field Type <span className="text-destructive">*</span></Label>
                      <Controller
                        name={`fields.${index}.field_type`}
                        control={control}
                        render={({ field: controllerField }) => (
                          <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                            <SelectTrigger id={`fields.${index}.field_type`}>
                              <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {fieldTypes.map(type => (
                                <SelectItem key={type} value={type} className="capitalize">{type.replace('-', ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                       {errors.fields?.[index]?.field_type && <p className="text-sm text-destructive mt-1">{errors.fields?.[index]?.field_type?.message}</p>}
                    </div>
                      {/* Options (for dropdown/multiselect) */}
                    {(watchedFields[index]?.field_type === 'dropdown' || watchedFields[index]?.field_type === 'multiselect') && (
                      <div className="md:col-span-2">
                        <Label htmlFor={`fields.${index}.options`}>Options (comma-separated)</Label>
                        <Input id={`fields.${index}.options`} {...register(`fields.${index}.options`)} placeholder="e.g., Good, Fair, Poor" />
                      </div>
                    )}
                    {/* Rating Scale (for rating) */}
                    {watchedFields[index]?.field_type === 'rating' && (
                       <div>
                         <Label htmlFor={`fields.${index}.rating_scale`}>Rating Scale <span className="text-destructive">*</span></Label>
                         <Controller
                            name={`fields.${index}.rating_scale`}
                            control={control}
                            render={({ field: controllerField }) => (
                                <Select
                                    onValueChange={(value) => controllerField.onChange(value ? parseInt(value) : null)}
                                    value={controllerField.value?.toString() ?? ''}
                                >
                                <SelectTrigger id={`fields.${index}.rating_scale`}>
                                    <SelectValue placeholder="Select Scale" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ratingScales.map(scale => (
                                        <SelectItem key={scale} value={scale.toString()}>1 - {scale}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                            )}
                            />
                         {errors.fields?.[index]?.rating_scale && <p className="text-sm text-destructive mt-1">{errors.fields?.[index]?.rating_scale?.message}</p>}
                      </div>
                    )}
                    {/* Placeholder */}
                     <div>
                        <Label htmlFor={`fields.${index}.placeholder`}>Placeholder</Label>
                        <Input id={`fields.${index}.placeholder`} {...register(`fields.${index}.placeholder`)} placeholder="Optional: e.g., Enter reading" />
                      </div>
                     {/* Description/Help Text */}
                      <div>
                        <Label htmlFor={`fields.${index}.description`}>Help Text / Description</Label>
                        <Input id={`fields.${index}.description`} {...register(`fields.${index}.description`)} placeholder="Optional: Instructions for the user" />
                      </div>
                     {/* Options Toggles */}
                      <div className="md:col-span-2 grid grid-cols-2 gap-4 items-center mt-2">
                          {/* Required Toggle */}
                          <div className="flex items-center space-x-2">
                              <Controller
                                  name={`fields.${index}.is_required`}
                                  control={control}
                                  render={({ field: controllerField }) => (
                                      <Checkbox
                                          id={`fields.${index}.is_required`}
                                          checked={controllerField.value}
                                          onCheckedChange={controllerField.onChange}
                                          className="form-checkbox"
                                      />
                                  )}
                              />
                              <Label htmlFor={`fields.${index}.is_required`} className="font-normal">Required Field</Label>
                          </div>
                          {/* Attachment Toggle (exclude photo type) */}
                          {watchedFields[index]?.field_type !== 'photo' && (
                              <div className="flex items-center space-x-2">
                                  <Controller
                                      name={`fields.${index}.supports_attachment`}
                                      control={control}
                                      render={({ field: controllerField }) => (
                                          <Checkbox
                                              id={`fields.${index}.supports_attachment`}
                                              checked={controllerField.value}
                                              onCheckedChange={controllerField.onChange}
                                              className="form-checkbox"
                                          />
                                      )}
                                  />
                                  <Label htmlFor={`fields.${index}.supports_attachment`} className="font-normal">Allow Attachment</Label>
                              </div>
                          )}
                      </div>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" onClick={addField} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Field
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Template'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
