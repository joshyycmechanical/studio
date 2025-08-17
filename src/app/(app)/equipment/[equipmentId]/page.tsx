
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Wrench, Save, AlertCircle, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Equipment, EquipmentStatus } from '@/types/equipment';
import type { WorkOrder } from '@/types/work-order';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions';
import {
    fetchEquipmentById,
    updateEquipment
} from '@/services/equipment';
import { fetchCustomerById } from '@/services/customers';
import { fetchLocationById } from '@/services/locations';
import { fetchWorkOrdersByEquipmentId } from '@/services/workOrders';
import { Badge } from '@/components/ui/badge';

const equipmentStatuses: EquipmentStatus[] = ['operational', 'needs-repair', 'decommissioned'];

const equipmentSchema = z.object({
  name: z.string().min(1, { message: 'Equipment Name is required' }),
  status: z.enum(equipmentStatuses.slice() as [string, ...string[]]),
  asset_tag: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model_number: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  equipment_type: z.string().optional().nullable(),
  installation_date: z.date().optional().nullable(),
  last_service_date: z.date().optional().nullable(),
  next_service_due_date: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

export default function EditEquipmentPage() {
  const router = useRouter();
  const { equipmentId } = useParams() as { equipmentId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [equipmentData, setEquipmentData] = useState<Equipment | null>(null);
  const [customerName, setCustomerName] = useState<string>('Loading...');
  const [locationName, setLocationName] = useState<string>('Loading...');
  const [error, setError] = useState<string | null>(null);

  const canEditEquipment = !authLoading && hasPermission(user, 'equipment', 'edit');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { /* Initialized in useEffect */ },
  });

  const fetchData = useCallback(async () => {
     if (!canEditEquipment && !authLoading) {
        setError("Access Denied: You don't have permission to edit equipment.");
        setIsLoading(false);
        return;
     }
      if (!companyId) {
        setError("Company context is missing.");
        setIsLoading(false);
        return;
      }
     if (!equipmentId) {
       setError("Equipment ID is missing.");
       setIsLoading(false);
       return;
     }

    setIsLoading(true);
    setError(null);
    try {
      const foundEquipment = await fetchEquipmentById(equipmentId);
      if (!foundEquipment) throw new Error("Equipment not found or you do not have access.");
      setEquipmentData(foundEquipment);

      const [customer, location] = await Promise.all([
          fetchCustomerById(companyId, foundEquipment.customer_id),
          fetchLocationById(companyId, foundEquipment.location_id)
      ]);
      setCustomerName(customer?.name ?? 'Unknown Customer');
      setLocationName(location?.name ?? 'Unknown Location');

      const initialFormData = {
          ...foundEquipment,
          installation_date: foundEquipment.installation_date ? new Date(foundEquipment.installation_date) : null,
          last_service_date: foundEquipment.last_service_date ? new Date(foundEquipment.last_service_date) : null,
          next_service_due_date: foundEquipment.next_service_due_date ? new Date(foundEquipment.next_service_due_date) : null,
          asset_tag: foundEquipment.asset_tag ?? '',
          manufacturer: foundEquipment.manufacturer ?? '',
          model_number: foundEquipment.model_number ?? '',
          serial_number: foundEquipment.serial_number ?? '',
          equipment_type: foundEquipment.equipment_type ?? '',
          notes: foundEquipment.notes ?? '',
      };
      reset(initialFormData as any);
    } catch (err: any) {
      console.error("Error fetching equipment data:", err);
      setError(err.message || "Failed to load equipment data.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load equipment." });
    } finally {
      setIsLoading(false);
    }
  }, [equipmentId, companyId, reset, toast, canEditEquipment, authLoading]);


  useEffect(() => { fetchData(); }, [fetchData]);
  
  const { data: relatedWorkOrders = [], isLoading: isLoadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ['equipmentWorkOrders', equipmentId],
    queryFn: () => fetchWorkOrdersByEquipmentId(equipmentId),
    enabled: !!equipmentId,
  });

  const onSubmit = async (data: EquipmentFormData) => {
    if (!canEditEquipment || !equipmentData) return;
    setIsSubmitting(true);
    const updateData: Partial<Omit<Equipment, 'id' | 'company_id' | 'location_id' | 'customer_id' | 'created_at'>> = {
         name: data.name.trim(),
         status: data.status as EquipmentStatus,
         asset_tag: data.asset_tag?.trim() || null,
         manufacturer: data.manufacturer?.trim() || null,
         model_number: data.model_number?.trim() || null,
         serial_number: data.serial_number?.trim() || null,
         equipment_type: data.equipment_type?.trim() || null,
         installation_date: data.installation_date ?? null,
         last_service_date: data.last_service_date ?? null,
         next_service_due_date: data.next_service_due_date ?? null,
         notes: data.notes?.trim() || null,
     };
    try {
       await updateEquipment(equipmentData.id, updateData);
       toast({ title: "Equipment Updated", description: `Equipment "${data.name}" has been successfully updated.` });
       router.push('/equipment');
    } catch (error: any) {
       console.error("Failed to update equipment:", error);
       toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not update the equipment." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) {
    return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  }
  if (error) {
     return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Equipment'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
      </main>
    );
  }
   if (!equipmentData) {
     return <main className="flex flex-1 items-center justify-center"><p>Equipment data could not be loaded.</p></main>;
   }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wrench /> Edit Equipment - {equipmentData.name}</CardTitle>
              <CardDescription>Update the details for this piece of equipment.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ... form fields ... */}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !canEditEquipment}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </CardFooter>
            </form>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle>Service History</CardTitle>
            </CardHeader>
            <CardContent>
                 {isLoadingWorkOrders ? (
                    <div className="flex justify-center items-center h-24"><Loader2 /></div>
                ) : relatedWorkOrders.length > 0 ? (
                    <ul className="space-y-3">
                        {relatedWorkOrders.map(wo => (
                             <li key={wo.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <Link href={`/work-orders/${wo.id}`} className="font-medium text-primary hover:underline">{wo.work_order_number}: {wo.summary}</Link>
                                    <p className="text-sm text-muted-foreground">{format(new Date(wo.created_at), 'PP')}</p>
                                </div>
                                 <Badge variant={wo.status === 'completed' || wo.status === 'invoiced' ? 'default' : 'secondary'} className="capitalize">{wo.status.replace('-', ' ')}</Badge>
                             </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No work orders found for this equipment.</p>
                )}
            </CardContent>
        </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><QrCode/> QR Code Service Request</CardTitle>
                <CardDescription>Use this QR code on equipment labels to allow customers to request service easily.</CardDescription>
            </CardHeader>
             <CardContent className="flex flex-col items-center gap-4">
                 <div className="p-4 bg-white rounded-md">
                    <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/request-service/${equipmentId}`)}`} alt="QR Code" width={150} height={150} />
                </div>
                 <Input 
                    readOnly 
                    value={`${window.location.origin}/request-service/${equipmentId}`}
                    className="text-center text-xs"
                />
                 <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/request-service/${equipmentId}`).then(() => toast({title: "Copied to clipboard!"}))}>
                    Copy Link
                </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
