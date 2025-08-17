
'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createDeficiency } from '@/services/deficiencies'; // We will need to create this service
import { useAuth } from '@/context/AuthContext';
import { PlusCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { Deficiency, DeficiencySeverity } from '@/types/deficiency';

const deficiencySchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

type DeficiencyFormData = z.infer<typeof deficiencySchema>;

interface LogDeficiencyFieldProps {
  workOrderId: string;
  locationId: string;
  equipmentId?: string | null;
  onDeficiencyLogged: (deficiencyId: string) => void;
}

export function LogDeficiencyField({ workOrderId, locationId, equipmentId, onDeficiencyLogged }: LogDeficiencyFieldProps) {
  const { toast } = useToast();
  const { user, companyId } = useAuth();
  const [open, setOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm<DeficiencyFormData>({
    resolver: zodResolver(deficiencySchema),
    defaultValues: { severity: 'medium' },
  });

  const mutation = useMutation({
    mutationFn: (data: Omit<Deficiency, 'id' | 'company_id' | 'created_at' | 'reported_by' | 'work_order_id' | 'status' | 'resolution_notes' | 'resolved_at' | 'resolved_by'>) => {
      if (!companyId || !user) throw new Error("User or company not found");
      return createDeficiency(companyId, user.id, data);
    },
    onSuccess: (newDeficiency) => {
      toast({ title: 'Deficiency Logged', description: 'The issue has been successfully logged.' });
      onDeficiencyLogged(newDeficiency.id);
      reset();
      setOpen(false);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const onSubmit = (data: DeficiencyFormData) => {
    const deficiencyData = {
      ...data,
      location_id: locationId,
      equipment_id: equipmentId,
      work_order_id: workOrderId,
      status: 'open' as const,
    };
    mutation.mutate(deficiencyData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><AlertTriangle className="mr-2 h-4 w-4" /> Log Deficiency</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log New Deficiency</DialogTitle>
          <DialogDescription>Describe the issue found during this checklist step.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <Controller name="description" control={control} render={({ field }) => <Textarea {...field} />} />
          </div>
          <div>
            <Label htmlFor="severity">Severity</Label>
            <Controller name="severity" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 animate-spin"/> : <PlusCircle className="mr-2 h-4"/>}
              Log Deficiency
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
