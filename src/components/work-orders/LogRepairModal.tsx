
'use client';

import * as React from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import type { Deficiency } from '@/types/deficiency';
import type { Repair } from '@/types/repair';

// Schema for a single part/material used
const partSchema = z.object({
  name: z.string().min(1, "Part name is required"),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  cost: z.number().min(0),
});

// Main schema for the repair form
const repairSchema = z.object({
  description: z.string().min(1, 'Description of work performed is required'),
  linked_deficiency_id: z.string().optional().nullable(),
  labor_hours: z.coerce.number().min(0, 'Labor hours cannot be negative').optional().nullable(),
  parts: z.array(partSchema).optional(),
  notes: z.string().optional().nullable(),
});

type RepairFormData = z.infer<typeof repairSchema>;

interface LogRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RepairFormData) => void;
  isLoading: boolean;
  deficiencies: Deficiency[]; // Open deficiencies to link to
  initialDeficiencyId?: string; // Pre-select a deficiency
}

export function LogRepairModal({ isOpen, onClose, onSubmit, isLoading, deficiencies, initialDeficiencyId }: LogRepairModalProps) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm<RepairFormData>({
    resolver: zodResolver(repairSchema),
    defaultValues: {
      description: '',
      linked_deficiency_id: initialDeficiencyId || null,
      labor_hours: 0,
      parts: [],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "parts",
  });

  // When the modal opens, reset the form with the initial deficiency ID
  React.useEffect(() => {
    if (isOpen) {
      reset({
        linked_deficiency_id: initialDeficiencyId || null,
        description: '',
        labor_hours: 0,
        parts: [],
        notes: '',
      });
    }
  }, [isOpen, initialDeficiencyId, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Repair Details</DialogTitle>
          <DialogDescription>
            Document the work performed, labor hours, and any parts used.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            
            {/* Deficiency Linking */}
            <div>
              <Label htmlFor="linked_deficiency_id">Link to Open Deficiency (Optional)</Label>
              <Controller
                name="linked_deficiency_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'}>
                    <SelectTrigger id="linked_deficiency_id"><SelectValue placeholder="Select a deficiency to resolve" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {deficiencies.filter(d => d.status === 'open').map(def => (
                        <SelectItem key={def.id} value={def.id}>{def.description.substring(0, 70)}...</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            
            {/* Description */}
            <div>
              <Label htmlFor="description">Work Performed <span className="text-destructive">*</span></Label>
              <Controller name="description" control={control} render={({ field }) => <Textarea id="description" placeholder="e.g., Replaced compressor, cleared drain line..." {...field} />} />
              {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
            </div>

            {/* Labor Hours */}
            <div>
              <Label htmlFor="labor_hours">Labor (Hours)</Label>
              <Controller name="labor_hours" control={control} render={({ field }) => <Input id="labor_hours" type="number" step="0.25" {...field} value={field.value ?? ''} />} />
               {errors.labor_hours && <p className="text-sm text-destructive mt-1">{errors.labor_hours.message}</p>}
            </div>

            {/* Parts / Materials */}
            <div>
                <Label>Parts & Materials Used</Label>
                <div className="space-y-2">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2 p-2 border rounded-md">
                             <div className="flex-1 grid grid-cols-5 gap-2">
                                <Controller name={`parts.${index}.name`} control={control} render={({ field }) => <Input placeholder="Part Name/SKU" {...field}/>} />
                                <Controller name={`parts.${index}.quantity`} control={control} render={({ field }) => <Input type="number" placeholder="Qty" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>} />
                                <Controller name={`parts.${index}.cost`} control={control} render={({ field }) => <Input type="number" placeholder="Cost" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/>} />
                             </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ name: '', quantity: 1, cost: 0 })}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add Part
                </Button>
            </div>
            
             {/* Internal Notes */}
            <div>
              <Label htmlFor="notes">Internal Notes (Optional)</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" placeholder="Add any internal notes about the repair..." {...field} value={field.value ?? ''} />} />
            </div>

          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Repair
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
