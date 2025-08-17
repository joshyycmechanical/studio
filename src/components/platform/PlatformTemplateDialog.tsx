
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Save, PlusCircle, Trash2, GripVertical, ArrowUp, ArrowDown, ClipboardCheck, AlertCircle } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { SortableFieldItem } from '@/components/customization/SortableFieldItem';
import type { ChecklistTemplate, ChecklistFieldType, ChecklistTemplateField } from '@/types/checklist';
import { createPlatformChecklistTemplate, updatePlatformChecklistTemplate } from '@/services/checklists';

const fieldTypes: ChecklistFieldType[] = ['text', 'textarea', 'toggle', 'dropdown', 'multiselect', 'date', 'time', 'photo', 'signature', 'rating', 'barcode', 'location'];
const ratingScales = [5, 10] as const;

const fieldSchema = z.object({
  id: z.string().optional(),
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

interface PlatformTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  template: ChecklistTemplate | null;
}

export function PlatformTemplateDialog({ isOpen, onClose, onSave, template }: PlatformTemplateDialogProps) {
  const { toast } = useToast();
  const { firebaseUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { control, handleSubmit, register, watch, reset, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: '', description: '', fields: [] },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'fields',
    keyName: 'dndId' // Use a different key to avoid conflicts with field 'id'
  });
  
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  React.useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description ?? '',
        fields: (template.fields ?? []).map((f, index) => ({
          ...f,
          position: index,
          options: Array.isArray(f.options) ? f.options.join(', ') : '',
        })),
      });
    } else {
      reset({
        name: '', description: '', fields: [],
      });
    }
  }, [template, reset]);

  const addField = () => {
    append({
      id: `new-${Date.now()}`,
      label: '', field_type: 'text', is_required: false, position: fields.length,
      options: '', placeholder: '', description: '', supports_attachment: false, rating_scale: null,
    });
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = fields.findIndex((f) => f.dndId === active.id);
        const newIndex = fields.findIndex((f) => f.dndId === over.id);
        move(oldIndex, newIndex);
    }
  };


  const onSubmit = async (data: TemplateFormData) => {
    if (!firebaseUser) return;
    setIsSubmitting(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const payload: Partial<Omit<ChecklistTemplate, 'id'>> = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        fields: data.fields.map((field, index) => ({
          id: field.id?.startsWith('new-') ? `field_${Date.now()}_${index}` : field.id!,
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

      if (template) {
        await updatePlatformChecklistTemplate(idToken, template.id, payload);
        toast({ title: 'Template Updated' });
      } else {
        await createPlatformChecklistTemplate(idToken, payload as any);
        toast({ title: 'Template Created' });
      }
      onSave();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{template ? `Edit Template: ${template.name}` : 'Create New Platform Template'}</DialogTitle>
          <DialogDescription>Define the template's details and fields. Changes here affect all companies that use this template.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            <div className="md:col-span-1 space-y-4">
              <div>
                <Label htmlFor="name">Template Name*</Label>
                <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Controller name="description" control={control} render={({ field }) => <Textarea id="description" {...field} value={field.value ?? ''} placeholder="Optional description..." />} />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Fields</Label>
              <ScrollArea className="h-96 w-full rounded-md border p-4 mt-2">
                {fields.length === 0 && <p className="text-muted-foreground text-center py-4">No fields yet. Click "Add Field" to start.</p>}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={fields.map(f => f.dndId)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <SortableFieldItem
                                    key={field.dndId}
                                    field={field}
                                    index={index}
                                    control={control}
                                    errors={errors.fields?.[index]}
                                    remove={remove}
                                    watch={watch}
                                    fieldTypes={fieldTypes}
                                    ratingScales={ratingScales}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                <Button type="button" variant="outline" size="sm" onClick={addField} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Add Field</Button>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {template ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
