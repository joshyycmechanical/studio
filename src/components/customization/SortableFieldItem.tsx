
'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Controller } from 'react-hook-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

export const SortableFieldItem = ({ field, index, control, register, errors, remove, move, watch, fieldTypes, ratingScales }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.dndId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 'auto',
        opacity: isDragging ? 0.7 : 1,
    };
    
    const watchedFieldType = watch(`fields.${index}.field_type`);

    return (
        <Card ref={setNodeRef} style={style} {...attributes} className="p-4 border bg-muted/50">
            <div className="flex items-center gap-2 mb-4">
                <Button type="button" variant="ghost" size="icon" className="cursor-grab" title="Drag to reorder" {...listeners}>
                    <GripVertical className="h-4 w-4" />
                </Button>
                <Label className="flex-1">Field {index + 1}</Label>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index - 1)} disabled={index === 0} title="Move Up"><ArrowUp className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(index, index + 1)} disabled={index === move.length - 1} title="Move Down"><ArrowDown className="h-4 w-4" /></Button>
                <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} title="Delete Field"><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor={`fields.${index}.label`}>Label / Question*</Label>
                    <Input id={`fields.${index}.label`} {...register(`fields.${index}.label`)} placeholder="e.g., Check Filter Condition" />
                    {errors?.label && <p className="text-sm text-destructive mt-1">{errors.label.message}</p>}
                </div>
                <div>
                    <Label htmlFor={`fields.${index}.field_type`}>Field Type*</Label>
                    <Controller
                        name={`fields.${index}.field_type`}
                        control={control}
                        render={({ field: controllerField }) => (
                            <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                <SelectTrigger id={`fields.${index}.field_type`}><SelectValue placeholder="Select Type" /></SelectTrigger>
                                <SelectContent>{fieldTypes.map((type: any) => <SelectItem key={type} value={type} className="capitalize">{type.replace('-', ' ')}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                    />
                    {errors?.field_type && <p className="text-sm text-destructive mt-1">{errors.field_type.message}</p>}
                </div>
                {(watchedFieldType === 'dropdown' || watchedFieldType === 'multiselect') && (
                    <div className="md:col-span-2">
                        <Label htmlFor={`fields.${index}.options`}>Options (comma-separated)</Label>
                        <Input id={`fields.${index}.options`} {...register(`fields.${index}.options`)} placeholder="e.g., Good, Fair, Poor" />
                    </div>
                )}
                {watchedFieldType === 'rating' && (
                    <div>
                        <Label htmlFor={`fields.${index}.rating_scale`}>Rating Scale*</Label>
                        <Controller
                            name={`fields.${index}.rating_scale`}
                            control={control}
                            render={({ field: controllerField }) => (
                                <Select onValueChange={(value) => controllerField.onChange(value ? parseInt(value) : null)} value={controllerField.value?.toString() ?? ''}>
                                    <SelectTrigger id={`fields.${index}.rating_scale`}><SelectValue placeholder="Select Scale" /></SelectTrigger>
                                    <SelectContent>{ratingScales.map((scale: any) => <SelectItem key={scale} value={scale.toString()}>1 - {scale}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                        />
                        {errors?.rating_scale && <p className="text-sm text-destructive mt-1">{errors.rating_scale.message}</p>}
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
                        <Controller name={`fields.${index}.is_required`} control={control} render={({ field: controllerField }) => <Checkbox id={`fields.${index}.is_required`} checked={controllerField.value} onCheckedChange={controllerField.onChange} className="form-checkbox" />} />
                        <Label htmlFor={`fields.${index}.is_required`} className="font-normal">Required Field</Label>
                    </div>
                    {watchedFieldType !== 'photo' && (
                        <div className="flex items-center space-x-2">
                            <Controller name={`fields.${index}.supports_attachment`} control={control} render={({ field: controllerField }) => <Checkbox id={`fields.${index}.supports_attachment`} checked={controllerField.value} onCheckedChange={controllerField.onChange} className="form-checkbox" />} />
                            <Label htmlFor={`fields.${index}.supports_attachment`} className="font-normal">Allow Attachment</Label>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};
