
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { equipmentCategories } from '@/lib/equipment-categories';
import type { Equipment, EquipmentStatus } from '@/types/equipment';
import { REFRIGERANT_TYPES } from '@/types/equipment'; // Corrected import path

const equipmentSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
  category: z.string().min(1, 'Category is required'),
  manufacturer: z.string().optional(),
  model_number: z.string().optional(),
  serial_number: z.string().optional(),
  status: z.enum(['operational', 'needs-repair', 'decommissioned']),
  refrigerant_type: z.string().optional(),
  voltage: z.enum(['120V', '208V/230V', '277V', '460V', '480V', 'Other']).optional(),
  tonnage: z.number().optional(),
  btu_rating: z.number().optional(),
  notes: z.string().optional(),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EquipmentFormData) => void;
  isLoading: boolean;
}

export function AddEquipmentModal({ isOpen, onClose, onSubmit, isLoading }: AddEquipmentModalProps) {
  const { control, handleSubmit, watch, formState: { errors } } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: '',
      category: '',
      manufacturer: '',
      model_number: '',
      serial_number: '',
      status: 'operational',
      refrigerant_type: '',
      voltage: undefined,
      tonnage: undefined,
      btu_rating: undefined,
      notes: '',
    },
  });

  const selectedCategory = watch('category');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Equipment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Equipment Name</Label>
              <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      {equipmentCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
            </div>

            {selectedCategory === 'refrigeration' || selectedCategory === 'hvac' ? (
              <>
                <div>
                  <Label htmlFor="refrigerant_type">Refrigerant Type</Label>
                  <Controller
                    name="refrigerant_type"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="refrigerant_type"><SelectValue placeholder="Select refrigerant type" /></SelectTrigger>
                        <SelectContent>
                          {REFRIGERANT_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="voltage">Voltage</Label>
                  <Controller
                    name="voltage"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="voltage"><SelectValue placeholder="Select voltage" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="120V">120V</SelectItem>
                          <SelectItem value="208V/230V">208V/230V</SelectItem>
                          <SelectItem value="277V">277V</SelectItem>
                          <SelectItem value="460V">460V</SelectItem>
                          <SelectItem value="480V">480V</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="tonnage">Tonnage</Label>
                  <Controller name="tonnage" control={control} render={({ field }) => <Input id="tonnage" type="number" {...field} />} />
                </div>
              </>
            ) : null}

            {selectedCategory === 'hvac' && (
              <div>
                <Label htmlFor="btu_rating">BTU Rating</Label>
                <Controller name="btu_rating" control={control} render={({ field }) => <Input id="btu_rating" type="number" {...field} />} />
              </div>
            )}

            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Controller name="manufacturer" control={control} render={({ field }) => <Input id="manufacturer" {...field} />} />
            </div>
            <div>
              <Label htmlFor="model_number">Model Number</Label>
              <Controller name="model_number" control={control} render={({ field }) => <Input id="model_number" {...field} />} />
            </div>
            <div>
              <Label htmlFor="serial_number">Serial Number</Label>
              <Controller name="serial_number" control={control} render={({ field }) => <Input id="serial_number" {...field} />} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="status"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="needs-repair">Needs Repair</SelectItem>
                      <SelectItem value="decommissioned">Decommissioned</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Controller name="notes" control={control} render={({ field }) => <Textarea id="notes" {...field} />} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Equipment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
