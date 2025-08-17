
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Users, AlertCircle, MapPin as MapPinIcon, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { WorkOrder } from '@/types/work-order';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { hasPermission } from '@/lib/permissions';
import { fetchCustomerById, updateCustomer } from '@/services/customers';
import { fetchLocationsByCustomerId } from '@/services/locations';
import { fetchWorkOrdersByCustomerId } from '@/services/workOrders';
import { formatEnum } from '@/lib/utils';

// Define the form schema using Zod (ensure it matches Customer type fields being edited)
const customerSchema = z.object({
  name: z.string().min(1, { message: 'Customer Name is required' }),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')).nullable(),
  contact_phone: z.string().optional().nullable(),
  billing_notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function EditCustomerPage() {
  const router = useRouter();
  const { customerId } = useParams() as { customerId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEditCustomers = !authLoading && hasPermission(user, 'customers', 'edit');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      billing_notes: '',
      status: 'active',
    },
  });

  // Fetch customer data using the service function
  useEffect(() => {
     if (!canEditCustomers && !authLoading) {
        setError("Access Denied: You don't have permission to edit customers.");
        setIsLoading(false);
        return;
     }
     if (!companyId) {
        setError("Company context is missing.");
        setIsLoading(false);
        return;
     }
     if (!customerId) {
       setError("Customer ID is missing.");
       setIsLoading(false);
       return;
     }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const foundCustomer = await fetchCustomerById(companyId, customerId);

        if (!foundCustomer) {
           throw new Error("Customer not found or you do not have access.");
        }

        setCustomerData(foundCustomer);
        const formData = {
            ...foundCustomer,
             contact_name: foundCustomer.contact_name ?? '',
             contact_email: foundCustomer.contact_email ?? '',
             contact_phone: foundCustomer.contact_phone ?? '',
             billing_notes: foundCustomer.billing_notes ?? '',
        };
        reset(formData);

      } catch (err: any) {
        console.error("Error fetching customer data:", err);
        setError(err.message || "Failed to load customer data.");
        toast({ variant: "destructive", title: "Error", description: err.message || "Could not load customer." });
      } finally {
        setIsLoading(false);
      }
    };
     fetchData();

  }, [customerId, companyId, reset, toast, canEditCustomers, authLoading]);

  // Fetch related data
  const { data: relatedLocations = [], isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ['customerLocations', customerId],
    queryFn: () => fetchLocationsByCustomerId(companyId!, customerId),
    enabled: !!companyId && !!customerId,
  });

  const { data: relatedWorkOrders = [], isLoading: isLoadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ['customerWorkOrders', customerId],
    queryFn: () => fetchWorkOrdersByCustomerId(companyId!, customerId),
    enabled: !!companyId && !!customerId,
  });


  // Update customer data using the service function
  const onSubmit = async (data: CustomerFormData) => {
     if (!canEditCustomers) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You cannot edit customers." });
        return;
     }
     if (!companyId || !customerData) {
        toast({ variant: "destructive", title: "Error", description: "Missing context or customer data." });
        return;
     }
     if (!user?.id) {
         toast({ variant: "destructive", title: "Error", description: "Could not identify updating user." });
         return;
     }

    setIsSubmitting(true);
    const updateData: Partial<Omit<Customer, 'id' | 'company_id' | 'created_at'>> = {
        name: data.name.trim(),
        contact_name: data.contact_name?.trim() || null,
        contact_email: data.contact_email?.trim() || null,
        contact_phone: data.contact_phone?.trim() || null,
        billing_notes: data.billing_notes?.trim() || null,
        status: data.status,
     };

    try {
       await updateCustomer(companyId, customerData.id, updateData);
       toast({
        title: "Customer Updated",
        description: `Customer "${data.name}" has been successfully updated.`,
       });
       router.push('/customers');

    } catch (error: any) {
       console.error("Failed to update customer:", error);
       toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update the customer. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error) {
     return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{error.startsWith('Access Denied') ? 'Access Denied' : 'Error Loading Customer'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button variant="outline" size="sm" onClick={() => router.push('/customers')} className="mt-4">
               Back to Customers
            </Button>
          </Alert>
      </main>
    );
  }

   if (!customerData) {
     return <main className="flex flex-1 items-center justify-center"><p>Customer data could not be loaded.</p></main>;
   }

   const createdAtDate = customerData.created_at instanceof Date
        ? customerData.created_at
        : customerData.created_at?.toDate?.() ?? new Date();

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Users className="h-6 w-6" /> Edit Customer - {customerData?.name}
          </CardTitle>
          <CardDescription>Update the details for this customer.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                 <Label htmlFor="name">Customer Name <span className="text-destructive">*</span></Label>
                <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <Input id="name" placeholder="e.g., Restaurant Chain A" {...field} />
                    )}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <Label htmlFor="contact_name">Contact Name</Label>
                 <Controller
                    name="contact_name"
                    control={control}
                    render={({ field }) => (
                        <Input id="contact_name" placeholder="e.g., John Doe" {...field} value={field.value ?? ''}/>
                    )}
                />
              </div>

               <div>
                <Label htmlFor="contact_email">Contact Email</Label>
                 <Controller
                    name="contact_email"
                    control={control}
                    render={({ field }) => (
                        <Input id="contact_email" type="email" placeholder="e.g., contact@company.com" {...field} value={field.value ?? ''} />
                    )}
                />
                 {errors.contact_email && <p className="text-sm text-destructive mt-1">{errors.contact_email.message}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                 <Controller
                    name="contact_phone"
                    control={control}
                    render={({ field }) => (
                        <Input id="contact_phone" placeholder="e.g., 555-123-4567" {...field} value={field.value ?? ''} />
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
                        <SelectTrigger id="status">
                            <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">{formatEnum('active')}</SelectItem>
                            <SelectItem value="inactive">{formatEnum('inactive')}</SelectItem>
                        </SelectContent>
                        </Select>
                    )}
                />
              </div>

              <div>
                <Label htmlFor="billing_notes">Billing Notes</Label>
                 <Controller
                    name="billing_notes"
                    control={control}
                    render={({ field }) => (
                       <Textarea
                        id="billing_notes"
                        placeholder="Any specific billing instructions..."
                        {...field}
                        value={field.value ?? ''}
                        rows={3}
                        />
                    )}
                />
              </div>
                <div className="space-y-2 mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Created At: {format(createdAtDate, 'PPp')}</p>
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
             </Button>
            <Button type="submit" disabled={isSubmitting || !canEditCustomers}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPinIcon className="h-5 w-5" /> Related Locations</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoadingLocations ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : relatedLocations.length > 0 ? (
                    <ul className="space-y-2">
                        {relatedLocations.slice(0, 5).map(loc => (
                            <li key={loc.id}>
                                <Link href={`/locations/${loc.id}`} className="text-primary hover:underline">{loc.name}</Link>
                                <p className="text-sm text-muted-foreground">{loc.address_line1}, {loc.city}</p>
                            </li>
                        ))}
                        {relatedLocations.length > 5 && <li className="text-sm text-muted-foreground mt-2">...and {relatedLocations.length - 5} more.</li>}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No locations found for this customer.</p>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Related Work Orders</CardTitle>
            </CardHeader>
            <CardContent>
                 {isLoadingWorkOrders ? (
                    <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : relatedWorkOrders.length > 0 ? (
                    <ul className="space-y-2">
                        {relatedWorkOrders.slice(0, 5).map(wo => (
                             <li key={wo.id} className="flex justify-between items-center">
                                <div>
                                    <Link href={`/work-orders/${wo.id}`} className="text-primary hover:underline">{wo.work_order_number}: {wo.summary}</Link>
                                    <p className="text-sm text-muted-foreground capitalize">{wo.status.replace('-', ' ')}</p>
                                </div>
                                 <Badge variant={wo.priority === 'high' || wo.priority === 'emergency' ? 'destructive' : 'outline'} className="capitalize">{wo.priority}</Badge>
                             </li>
                        ))}
                         {relatedWorkOrders.length > 5 && <li className="text-sm text-muted-foreground mt-2">...and {relatedWorkOrders.length - 5} more.</li>}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No work orders found for this customer.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
