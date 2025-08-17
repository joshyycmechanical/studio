
'use client';

import * as React from 'react';
import { useFormContext, Controller, FormProvider, UseFormReturn } from 'react-hook-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Save, Loader2, GripVertical, Briefcase, PlusCircle } from 'lucide-react';
import { cn, formatEnum } from '@/lib/utils';
import { format } from 'date-fns';
import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormFieldConfig } from '@/types/form-fields';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

// Draggable Form Field Component
const SortableFormField = ({ field, form, dropdownData, customerFormProps }: { field: FormFieldConfig; form: UseFormReturn<any>; dropdownData: any; customerFormProps?: any }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.name });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'currency':
        return <Input id={field.name} type={field.type === 'currency' ? 'number' : field.type} {...form.register(field.name)} placeholder={field.placeholder} />;
      case 'textarea':
        return <Textarea id={field.name} {...form.register(field.name)} placeholder={field.placeholder} rows={field.rows || 4} />;
      case 'select':
        return (
          <Controller
            name={field.name}
            control={form.control}
            render={({ field: controllerField }) => (
              <Select onValueChange={controllerField.onChange} value={controllerField.value} disabled={dropdownData[field.name]?.isLoading}>
                <SelectTrigger id={field.name}><SelectValue placeholder={dropdownData[field.name]?.isLoading ? "Loading..." : field.placeholder} /></SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt: any) => <SelectItem key={typeof opt === 'string' ? opt : opt.id} value={typeof opt === 'string' ? opt : opt.id}>{typeof opt === 'string' ? formatEnum(opt) : opt.name}</SelectItem>)}
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
                    <CalendarIcon className="mr-2 h-4 w-4" />{controllerField.value ? format(new Date(controllerField.value), 'PPP') : <span>{field.placeholder}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={controllerField.value ? new Date(controllerField.value) : undefined} onSelect={controllerField.onChange} /></PopoverContent>
              </Popover>
            )}
          />
        );
      case 'customer-select':
        return (
           <div className="flex items-center gap-2">
            <Controller
                name={field.name}
                control={form.control}
                render={({ field: controllerField }) => (
                    <Select onValueChange={controllerField.onChange} value={controllerField.value} disabled={dropdownData.customers?.isLoading}>
                        <SelectTrigger><SelectValue placeholder="Select Customer" /></SelectTrigger>
                        <SelectContent>{dropdownData.customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                )}
            />
             {customerFormProps && (
                <Dialog open={customerFormProps.isCustomerDialogOpen} onOpenChange={customerFormProps.setIsCustomerDialogOpen}>
                    <DialogTrigger asChild><Button type="button" variant="outline" size="icon" className="shrink-0" title="Add New Customer"><PlusCircle className="h-4 w-4" /></Button></DialogTrigger>
                    <DialogContent>
                        <form onSubmit={customerFormProps.customerForm.handleSubmit(customerFormProps.handleCreateNewCustomer)}>
                           <DialogHeader>
                               <DialogTitle>Add New Customer & Location</DialogTitle>
                               <DialogDescription>Quickly add a new customer and their primary service location.</DialogDescription>
                           </DialogHeader>
                           <div className="grid gap-4 py-4">
                               {/* Form fields for new customer */}
                           </div>
                           <DialogFooter>
                               <DialogClose asChild><Button type="button" variant="outline" disabled={customerFormProps.isSubmittingCustomer}>Cancel</Button></DialogClose>
                               <Button type="submit" disabled={customerFormProps.isSubmittingCustomer}>{customerFormProps.isSubmittingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create & Select</Button>
                           </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
             )}
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


interface DynamicFormProps {
  title: string;
  description: string;
  fields: FormFieldConfig[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
  isSubmitting: boolean;
  dropdownData: any;
  customerFormProps?: any;
}

export function DynamicForm({ title, description, fields, onSubmit, isLoading, isSubmitting, dropdownData, customerFormProps }: DynamicFormProps) {
  const form = useFormContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Briefcase className="h-6 w-6" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent>
            {isLoading ? (
                 <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {fields.map(field => (
                        <div key={field.name} className={cn(field.fullWidth && 'md:col-span-2')}>
                            {/* We are not using drag-and-drop on the form itself, so we render a simplified version */}
                             <Label htmlFor={field.name} className="mb-2">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
                            {/* Simplified renderField logic */}
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline">Cancel</Button>
          <Button type="submit" disabled={isSubmitting || isLoading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

