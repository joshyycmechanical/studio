'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { createEstimate } from '@/services/estimates';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyDeficiencies } from '@/services/deficiencies';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Deficiency } from '@/types/deficiency';
import type { Estimate } from '@/types/estimate';

const estimateSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  location_id: z.string().min(1, 'Location is required'),
  deficiency_id: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'approved', 'rejected']),
  summary: z.string().min(1, 'A brief summary is required'),
  notes: z.string().optional(),
});

type EstimateFormData = z.infer<typeof estimateSchema>;

export default function NewEstimatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, companyId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(searchParams.get('customer_id'));

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers', companyId],
    queryFn: () => fetchCompanyCustomers(companyId!),
    enabled: !!companyId,
  });

  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ['locations', companyId, selectedCustomer],
    queryFn: () => fetchCompanyLocations(companyId!),
    enabled: !!companyId && !!selectedCustomer,
  });

  const { data: deficiencies = [], isLoading: isLoadingDeficiencies } = useQuery<Deficiency[]>({
    queryKey: ['deficiencies', companyId, selectedCustomer],
    queryFn: () => fetchCompanyDeficiencies(companyId!),
    enabled: !!companyId && !!selectedCustomer,
  });

  const { handleSubmit, control, watch, setValue } = useForm<EstimateFormData>({
    resolver: zodResolver(estimateSchema),
    defaultValues: {
      customer_id: searchParams.get('customer_id') || '',
      location_id: searchParams.get('location_id') || '',
      deficiency_id: searchParams.get('deficiency_id') || '',
      status: 'draft',
      summary: '',
      notes: '',
    },
  });

  const selectedDeficiencyId = watch('deficiency_id');

  React.useEffect(() => {
    if (selectedDeficiencyId) {
      const selectedDeficiency = deficiencies.find(d => d.id === selectedDeficiencyId);
      if (selectedDeficiency) {
        setValue('summary', `Estimate for deficiency: ${selectedDeficiency.description}`);
        setValue('location_id', selectedDeficiency.location_id);
        if (selectedDeficiency.customer_id) {
          setValue('customer_id', selectedDeficiency.customer_id); 
        }
      }
    }
  }, [selectedDeficiencyId, deficiencies, setValue]);

  const mutation = useMutation({
    mutationFn: (data: EstimateFormData) => {
      if (!companyId || !user) throw new Error('No company ID or user found.');
      const estimateData: Omit<Estimate, 'id'> = {
        ...data,
        company_id: companyId,
        created_at: new Date(),
        created_by: user.id,
        line_items: [],
        estimate_number: `EST-${Date.now()}`,
        subtotal: 0,
        total_amount: 0,
      };
      return createEstimate(estimateData);
    },
    onSuccess: (data) => {
      toast({ title: 'Estimate Created', description: `Estimate ${data.estimate_number} has been successfully created.` });
      queryClient.invalidateQueries({ queryKey: ['estimates', companyId] });
      router.push(`/estimates/${data.id}`);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const onSubmit = (data: EstimateFormData) => {
    mutation.mutate(data);
  };

  const isLoading = isLoadingCustomers || isLoadingLocations || isLoadingDeficiencies;

  return (
    <main className="flex-1 p-6">
      <div className="flex items-center mb-6">
        <Link href="/estimates">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-semibold ml-4">New Estimate</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Estimate Details</CardTitle>
          <CardDescription>Fill out the form to create a new estimate.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Controller name="customer_id" control={control} render={({ field }) => (
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select onValueChange={(value) => { field.onChange(value); setSelectedCustomer(value); }} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )} />

              <Controller name="location_id" control={control} render={({ field }) => (
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCustomer}>
                    <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                    <SelectContent>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )} />
              
              <Controller name="deficiency_id" control={control} render={({ field }) => (
                 <div className="space-y-2">
                  <Label>Related Deficiency (Optional)</Label>
                  <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={!selectedCustomer}>
                    <SelectTrigger><SelectValue placeholder="Select a deficiency" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {deficiencies.map(d => <SelectItem key={d.id} value={d.id}>{d.description.substring(0, 50)}...</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )} />

              <Controller name="status" control={control} render={({ field }) => (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )} />

              <div className="md:col-span-2 space-y-2">
                <Controller name="summary" control={control} render={({ field }) => (
                  <div><Label>Summary</Label><Input {...field} placeholder="e.g., Estimate for HVAC repair" /></div>
                )} />
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <Controller name="notes" control={control} render={({ field }) => (
                   <div><Label>Notes (Optional)</Label><Textarea {...field} value={field.value ?? ''} placeholder="Any additional notes for the customer or internal team." /></div>
                )} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Link href="/estimates"><Button variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Estimate
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
