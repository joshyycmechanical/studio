
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { Equipment } from '@/types/equipment';
import type { Deficiency, DeficiencySeverity, DeficiencyStatus } from '@/types/deficiency';

const deficiencySchema = z.object({
  description: z.string().min(1, 'Description is required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'resolved', 'deferred']),
  equipment_id: z.string().optional().nullable(),
});

type DeficiencyFormData = z.infer<typeof deficiencySchema>;

interface LogDeficiencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DeficiencyFormData) => void;
  isLoading: boolean;
  equipment: Equipment[];
}

export function LogDeficiencyModal({ isOpen, onClose, onSubmit, isLoading, equipment }: LogDeficiencyModalProps) {
  const { control, handleSubmit, formState: { errors } } = useForm<DeficiencyFormData>({
    resolver: zodResolver(deficiencySchema),
    defaultValues: {
      description: '',
      severity: 'medium',
      status: 'open',
      equipment_id: null,
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log New Deficiency</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Controller name="description" control={control} render={({ field }) => <Textarea id="description" {...field} />} />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            <div>
              <Label htmlFor="severity">Severity</Label>
              <Controller
                name="severity"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="severity"><SelectValue placeholder="Select severity" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="deferred">Deferred</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label htmlFor="equipment_id">Related Equipment</Label>
              <Controller
                name="equipment_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'}>
                    <SelectTrigger id="equipment_id"><SelectValue placeholder="Select equipment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {equipment.map(item => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Deficiency
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
