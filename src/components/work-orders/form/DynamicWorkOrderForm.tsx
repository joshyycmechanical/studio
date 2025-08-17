'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Briefcase, Save, Loader2 } from 'lucide-react';
import { cn, formatEnum } from '@/lib/utils';
import { format } from 'date-fns';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { standardWorkOrderFields } from '@/lib/form-fields';
import type { FormFieldConfig } from '@/types/form-fields';
import type { Customer, Location } from '@/types/customer';
import type { Equipment } from '@/types/equipment';
import type { UserProfile } from '@/types/user';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { PlusCircle } from 'lucide-react';

// Draggable Form Field Component
const SortableFormField = ({ field, form, dropdownData, isSubmitting }: { field: FormFieldConfig; form: UseFormReturn<any>; dropdownData: any, isSubmitting: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.name });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return <Input id={field.name} type={field.type} {...form.register(field.name)} placeholder={field.placeholder} />;
      case 'textarea':
        return <Textarea id={field.name} {...form.register(field.name)} placeholder={field.placeholder} rows={field.rows || 4} />;
      case 'select':
        return (
          <Controller
            name={field.name}
            control={form.control}
            render={({ field: controllerField }) => (
              <Select onValueChange={controllerField.onChange} value={controllerField.value} disabled={isSubmitting || dropdownData[field.name]?.isLoading}>
                <SelectTrigger id={field.name}><SelectValue placeholder={dropdownData[field.name]?.isLoading ? "Loading..." : field.placeholder} /></SelectTrigger>
                <SelectContent>
                  {dropdownData[field.name]?.data.map((item: any) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        );
      case 'date':
        return (
          <Controller
            name={field.name}
            control={form.control}
            render={({ field: controllerField }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !controllerField.value && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{controllerField.value ? format(controllerField.value, 'PPP') : <span>{field.placeholder}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={controllerField.value} onSelect={controllerField.onChange} /></PopoverContent>
              </Popover>
            )}
          />
        );
      case 'customer-select': // Special case with quick-add
        return (
           <div className="flex items-center gap-2">
            <Controller
                name={field.name}
                control={form.control}
                render={({ field: controllerField }) => (
                    <Select onValueChange={controllerField.onChange} value={controllerField.value} disabled={isSubmitting || dropdownData.customers?.isLoading}>
                        <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                        <SelectContent>{dropdownData.customers?.data.map((c: Customer) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                )}
            />
            <Dialog onOpenChange={dropdownData.onCustomerDialogChange}>
                <DialogTrigger asChild><Button type="button" variant="outline" size="icon" className="shrink-0" title="Add New Customer"><PlusCircle className="h-4 w-4" /></Button></DialogTrigger>
                 <DialogContent>
                     {/* The form from the original quick-add logic would go here */}
                     <p>Quick add customer form placeholder.</p>
                     <Button onClick={dropdownData.handleCreateNewCustomer}>Create</Button>
                 </DialogContent>
            </Dialog>
           </div>
        );
      default:
        return <Input disabled placeholder="Unsupported field type" />;
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Label htmlFor={field.name} className="flex items-center gap-2 mb-2">
         <span className="cursor-grab" {...listeners}><GripVertical className="h-4 w-4 text-muted-foreground"/></span>
        {field.label} {field.required && <span className="text-destructive">*</span>}
      </Label>
      {renderField()}
      {form.formState.errors[field.name] && <p className="text-sm text-destructive mt-1">{form.formState.errors[field.name]?.message as string}</p>}
    </div>
  );
};


// Main Form Component
interface DynamicWorkOrderFormProps {
  fields: FormFieldConfig[];
  setFields: React.Dispatch<React.SetStateAction<FormFieldConfig[]>>;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  isSubmitting: boolean;
  isEditMode: boolean;
  dropdownData: {
    customers: { data: Customer[], isLoading: boolean };
    locations: { data: Location[], isLoading: boolean };
    equipment: { data: Equipment[], isLoading: boolean };
    technicians: { data: Partial<UserProfile>[], isLoading: boolean };
    onCustomerDialogChange: (isOpen: boolean) => void;
    handleCreateNewCustomer: () => void;
  };
}

export function DynamicWorkOrderForm({ fields, setFields, onSubmit, isLoading, isSubmitting, isEditMode, dropdownData }: DynamicWorkOrderFormProps) {
  const form = useFormContext();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.name === active.id);
        const newIndex = items.findIndex((item) => item.name === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Briefcase className="h-6 w-6" /> {isEditMode ? 'Edit Work Order' : 'Create New Work Order'}</CardTitle>
        <CardDescription>{isEditMode ? 'Update the details for this work order.' : 'Fill in the details below to create a new work order.'}</CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent>
            {isLoading ? (
                 <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={fields.map(f => f.name)} strategy={verticalListSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {fields.map(field => (
                                <div key={field.name} className={cn(field.fullWidth && 'md:col-span-2')}>
                                    <SortableFormField field={field} form={form} dropdownData={dropdownData} isSubmitting={isSubmitting} />
                                </div>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline">Cancel</Button>
          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Create Work Order'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
