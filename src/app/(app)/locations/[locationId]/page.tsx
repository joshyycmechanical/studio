
'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, AlertCircle, MapPin as MapPinIcon, Briefcase, Wrench, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import type { WorkOrder } from '@/types/work-order';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { hasPermission } from '@/lib/permissions';
import { fetchLocationById, updateLocation } from '@/services/locations';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchEquipmentByLocationId } from '@/services/equipment';
import { fetchWorkOrdersByLocationId } from '@/services/workOrders';
import { formatEnum } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

const locationTypes = ['restaurant', 'warehouse', 'office', 'residential', 'other'] as const;

const locationSchema = z.object({
  name: z.string().min(1, { message: 'Location Name is required' }),
  address_line1: z.string().min(1, { message: 'Address Line 1 is required' }),
  address_line2: z.string().optional(),
  city: z.string().min(1, { message: 'City is required' }),
  province: z.string().min(1, { message: 'Province/State is required' }),
  postal_code: z.string().min(1, { message: 'Postal/Zip Code is required' }),
  country: z.string().min(1, { message: 'Country is required' }),
  location_type: z.enum(locationTypes),
});

type LocationFormData = z.infer<typeof locationSchema>;


export default function EditLocationPage() {
  const router = useRouter();
  const { locationId } = useParams() as { locationId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const canView = !authLoading && hasPermission(user, 'locations', 'view');
  const canEdit = !authLoading && hasPermission(user, 'locations', 'edit');
  const canCreateEquipment = !authLoading && hasPermission(user, 'equipment', 'create');

  const { control, handleSubmit, reset, formState: { errors } } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
  });

    const { data: locationData, isLoading: isLoadingLocation, error: errorLocation } = useQuery<Location | null>({
        queryKey: ['location', locationId],
        queryFn: () => {
            if (!companyId) throw new Error("Company ID is missing.");
            return fetchLocationById(companyId, locationId);
        },
        enabled: !!companyId && !!locationId && canView,
        onSuccess: (data) => {
            if (data) {
                reset(data);
            }
        },
    });

    const { data: customer, isLoading: isLoadingCustomer } = useQuery<Customer | null>({
        queryKey: ['customer', locationData?.customer_id],
        queryFn: () => {
             if (!companyId || !locationData?.customer_id) return null;
            return fetchCompanyCustomers(companyId).then(customers => customers.find(c => c.id === locationData!.customer_id) || null)
        },
        enabled: !!companyId && !!locationData?.customer_id,
    });
    
    const { data: equipment = [], isLoading: isLoadingEquipment, error: errorEquipment } = useQuery<Equipment[]>({
        queryKey: ['equipment', 'location', locationId],
        queryFn: () => {
             if (!companyId) throw new Error("Company ID is missing.");
            return fetchEquipmentByLocationId(companyId, locationId);
        },
        enabled: !!companyId && !!locationId && canView,
    });

    const { data: workOrders = [], isLoading: isLoadingWorkOrders, error: errorWorkOrders } = useQuery<WorkOrder[]>({
        queryKey: ['workOrders', 'location', locationId],
        queryFn: () => {
             if (!companyId) throw new Error("Company ID is missing.");
            return fetchWorkOrdersByLocationId(companyId, locationId);
        },
        enabled: !!companyId && !!locationId && canView,
    });


  const updateMutation = useMutation({
      mutationFn: (data: LocationFormData) => {
          if (!canEdit || !locationData || !companyId) throw new Error("Missing data or permission.");
          return updateLocation(companyId, locationData.id, data);
      },
      onSuccess: () => {
          toast({ title: "Location Updated", description: "Location details saved successfully." });
          queryClient.invalidateQueries({ queryKey: ['location', locationId] });
          queryClient.invalidateQueries({ queryKey: ['locations', companyId] });
      },
      onError: (error: any) => {
           toast({ variant: "destructive", title: "Update Failed", description: error.message });
      }
  });


  const onSubmit = (data: LocationFormData) => {
      updateMutation.mutate(data);
  };

  const isLoading = authLoading || isLoadingLocation || isLoadingCustomer;
  const error = errorLocation || errorEquipment || errorWorkOrders;

  if (isLoading) {
    return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  }

  if (error) {
     return (
      <main className="flex flex-1 items-center justify-center p-4">
         <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
      </main>
    );
  }

  if (!canView || !locationData) {
     return (
        <main className="flex flex-1 items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Access Denied or Not Found</AlertTitle>
                <AlertDescription>You do not have permission to view this location or it does not exist.</AlertDescription>
            </Alert>
        </main>
     );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPinIcon /> Edit Location - {locationData?.name}</CardTitle>
           <CardDescription>Update the details for this service location.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div><Label>Customer</Label><Input value={customer?.name ?? 'Loading...'} disabled /></div>
                 <div><Label htmlFor="name">Location Name</Label><Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} /></div>
              </div>
              <Separator/>
              <h3 className="text-lg font-semibold">Address</h3>
              <div className="space-y-4">
                <div className="md:col-span-2"><Label htmlFor="address_line1">Address Line 1</Label><Controller name="address_line1" control={control} render={({ field }) => <Input id="address_line1" {...field} />} /></div>
                <div className="md:col-span-2"><Label htmlFor="address_line2">Address Line 2</Label><Controller name="address_line2" control={control} render={({ field }) => <Input id="address_line2" {...field} value={field.value ?? ''}/>} /></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div><Label htmlFor="city">City</Label><Controller name="city" control={control} render={({ field }) => <Input id="city" {...field} />} /></div>
                     <div><Label htmlFor="province">Province/State</Label><Controller name="province" control={control} render={({ field }) => <Input id="province" {...field} />} /></div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label htmlFor="postal_code">Postal Code</Label><Controller name="postal_code" control={control} render={({ field }) => <Input id="postal_code" {...field} />} /></div>
                    <div><Label htmlFor="country">Country</Label><Controller name="country" control={control} render={({ field }) => <Input id="country" {...field} />} /></div>
                 </div>
              </div>
              <div><Label htmlFor="location_type">Location Type</Label><Controller name="location_type" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{locationTypes.map(type => <SelectItem key={type} value={type}>{formatEnum(type)}</SelectItem>)}</SelectContent></Select>)} /></div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending || !canEdit}>
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle id="equipment" className="flex items-center gap-2"><Wrench /> Equipment at this Location</CardTitle>
                    <CardDescription>Total Equipment Count: {equipment?.length ?? 0}</CardDescription>
                </div>
                 {canCreateEquipment && (
                    <Link href={`/equipment/new?locationId=${locationId}&customerId=${locationData.customer_id}`}>
                        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add Equipment</Button>
                    </Link>
                 )}
            </CardHeader>
            <CardContent>
                {isLoadingEquipment ? (
                    <div className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                ) : equipment && equipment.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Service</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {equipment.map(eq => (
                                <TableRow key={eq.id}>
                                    <TableCell className="font-medium">
                                        <Link href={`/equipment/${eq.id}`} className="text-primary hover:underline">
                                            {eq.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{eq.equipment_type ?? 'N/A'}</TableCell>
                                    <TableCell>{formatEnum(eq.status)}</TableCell>
                                    <TableCell>{eq.last_service_date ? format(new Date(eq.last_service_date), 'PP') : 'N/A'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-center text-muted-foreground py-4">No equipment found at this location.</p>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase /> Work Order History</CardTitle>
                <CardDescription>Recent service history for this location.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoadingWorkOrders ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : workOrders.length > 0 ? (
                    <ul className="space-y-3">
                        {workOrders.slice(0, 10).map(wo => (
                             <li key={wo.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <Link href={`/work-orders/${wo.id}`} className="text-primary hover:underline">
                                        #{wo.work_order_number}: {wo.summary}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                        {format(new Date(wo.created_at), 'PP')}
                                    </p>
                                </div>
                                 <Badge variant={wo.status === 'completed' || wo.status === 'invoiced' ? 'default' : 'secondary'} className="capitalize">
                                     {wo.status.replace('-', ' ')}
                                 </Badge>
                             </li>
                        ))}
                         {workOrders.length > 10 && <li className="text-sm text-muted-foreground mt-2">...and {workOrders.length - 10} more.</li>}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No work orders found for this location.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
