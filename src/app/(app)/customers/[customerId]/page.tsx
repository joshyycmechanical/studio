
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller, FormProvider } from 'react-hook-form'; // Import FormProvider
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Users, AlertCircle, MapPin as MapPinIcon, Briefcase, PlusCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { WorkOrder } from '@/types/work-order';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { hasPermission } from '@/lib/permissions';
import { fetchCustomerById, updateCustomer } from '@/services/customers';
import { fetchLocationsByCustomerId, createLocation } from '@/services/locations';
import { fetchWorkOrdersByCustomerId } from '@/services/workOrders';
import { formatEnum } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useTheme } from 'next-themes';
import usePlacesAutocomplete, { getGeocode } from 'use-places-autocomplete';


// Define the form schema for the main customer edit form
const customerSchema = z.object({
  name: z.string().min(1, { message: 'Customer Name is required' }),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')).nullable(),
  contact_phone: z.string().optional().nullable(),
  billing_notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']),
  billing_email: z.string().email("Invalid billing email").optional().or(z.literal('')).nullable(),
  billing_address_line1: z.string().optional().nullable(),
  billing_address_line2: z.string().optional().nullable(),
  billing_city: z.string().optional().nullable(),
  billing_province: z.string().optional().nullable(),
  billing_postal_code: z.string().optional().nullable(),
  billing_country: z.string().optional().nullable(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

// Define the form schema for the new location dialog
const locationTypes = ['restaurant', 'warehouse', 'office', 'residential', 'other'] as const;
const newLocationSchema = z.object({
  name: z.string().min(1, { message: 'Location Name is required' }),
  address_line1: z.string().min(1, { message: 'Address Line 1 is required' }),
  address_line2: z.string().optional().nullable(),
  city: z.string().min(1, { message: 'City is required' }),
  province: z.string().min(1, { message: 'Province/State is required' }),
  postal_code: z.string().min(1, { message: 'Postal/Zip Code is required' }),
  country: z.string().optional().nullable(),
  location_type: z.enum(locationTypes),
});
type NewLocationFormData = z.infer<typeof newLocationSchema>;


export default function EditCustomerPage() {
  const router = useRouter();
  const { customerId } = useParams() as { customerId: string };
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isAddLocationDialogOpen, setIsAddLocationDialogOpen] = useState(false);
  const { theme } = useTheme();

  const canEditCustomers = !authLoading && hasPermission(user, 'customers', 'edit');
  const canCreateLocations = !authLoading && hasPermission(user, 'locations', 'create');

  const { data: customerData, isLoading: isLoadingCustomer, error: errorCustomer, refetch } = useQuery<Customer | null>({
      queryKey: ['customer', customerId],
      queryFn: () => fetchCustomerById(companyId!, customerId),
      enabled: !!companyId && canEditCustomers,
  });

  const { data: relatedLocations = [], isLoading: isLoadingLocations, refetch: refetchLocations } = useQuery<Location[]>({
    queryKey: ['customerLocations', customerId],
    queryFn: () => fetchLocationsByCustomerId(companyId!, customerId),
    enabled: !!companyId && !!customerId,
  });

  const { data: relatedWorkOrders = [], isLoading: isLoadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ['customerWorkOrders', customerId],
    queryFn: () => fetchWorkOrdersByCustomerId(companyId!, customerId),
    enabled: !!companyId && !!customerId,
  });
  
  const customerForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', contact_name: '', contact_email: '', contact_phone: '', billing_notes: '', status: 'active' }
  });

  const locationForm = useForm<NewLocationFormData>({
    resolver: zodResolver(newLocationSchema),
    defaultValues: { name: '', address_line1: '', city: '', province: '', postal_code: '', country: 'USA', location_type: 'other' }
  });
  
  const { ready, value: autocompleteValue, suggestions: { status: autocompleteStatus, data: autocompleteData }, setValue: setAutocompleteValue, clearSuggestions } = usePlacesAutocomplete({ requestOptions: {}, debounce: 300 });
  const locationNameValue = locationForm.watch('name');
  useEffect(() => { setAutocompleteValue(locationNameValue) }, [locationNameValue, setAutocompleteValue]);

  useEffect(() => {
    if (customerData) {
      customerForm.reset({
        ...customerData,
        contact_name: customerData.contact_name ?? '',
        contact_email: customerData.contact_email ?? '',
        contact_phone: customerData.contact_phone ?? '',
        billing_notes: customerData.billing_notes ?? '',
        billing_email: customerData.billing_email ?? '',
        billing_address_line1: customerData.billing_address_line1 ?? '',
        billing_address_line2: customerData.billing_address_line2 ?? '',
        billing_city: customerData.billing_city ?? '',
        billing_province: customerData.billing_province ?? '',
        billing_postal_code: customerData.billing_postal_code ?? '',
        billing_country: customerData.billing_country ?? '',
      });
    }
  }, [customerData, customerForm.reset]);

  const updateCustomerMutation = useMutation({
      mutationFn: (data: CustomerFormData) => {
          if (!companyId || !customerData) throw new Error("Missing context or customer data.");
          return updateCustomer(companyId, customerData.id, data);
      },
      onSuccess: () => {
          toast({ title: "Customer Updated", description: "Customer details have been saved." });
          queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      },
      onError: (error: any) => {
          toast({ variant: "destructive", title: "Update Failed", description: error.message });
      }
  });

  const createLocationMutation = useMutation({
    mutationFn: (data: NewLocationFormData) => {
        if (!companyId || !customerData) throw new Error("Missing customer context.");
        const newLocationData: Omit<Location, 'id' | 'created_at' | 'equipment_count'> = {
            ...data,
            country: data.country ?? 'USA',
            company_id: companyId,
            customer_id: customerData.id,
        };
        return createLocation(newLocationData);
    },
    onSuccess: () => {
        toast({ title: "Location Added", description: "The new location has been saved."});
        refetchLocations();
        setIsAddLocationDialogOpen(false);
        locationForm.reset();
    },
    onError: (error: any) => {
        toast({ variant: "destructive", title: "Failed to Add Location", description: error.message });
    }
  });

  const onCustomerSubmit = (data: CustomerFormData) => {
    updateCustomerMutation.mutate(data);
  };
  
  const onLocationSubmit = (data: NewLocationFormData) => {
      createLocationMutation.mutate(data);
  };
  
  const handleAddressSelect = (suggestion: google.maps.places.AutocompletePrediction) => async () => {
    locationForm.setValue('name', suggestion.structured_formatting.main_text, { shouldValidate: true });
    setAutocompleteValue(suggestion.description, false);
    clearSuggestions();

    try {
        const results = await getGeocode({ address: suggestion.description });
        const addressComponents = results[0].address_components;
        let streetNumber = '', route = '';
        addressComponents.forEach(component => {
            const types = component.types;
            if (types.includes('street_number')) streetNumber = component.long_name;
            if (types.includes('route')) route = component.long_name;
            if (types.includes('locality')) locationForm.setValue('city', component.long_name);
            if (types.includes('administrative_area_level_1')) locationForm.setValue('province', component.short_name);
            if (types.includes('postal_code')) locationForm.setValue('postal_code', component.long_name);
            if (types.includes('country')) locationForm.setValue('country', component.long_name);
        });
        locationForm.setValue('address_line1', `${streetNumber} ${route}`.trim());
    } catch (error) {
        console.error("Geocoding Error: ", error);
        toast({ title: 'Geocoding Error', description: 'Could not fetch address details.', variant: 'destructive' });
    }
  };

  const renderSuggestions = () => autocompleteData.map((suggestion) => {
    const { place_id, structured_formatting: { main_text, secondary_text } } = suggestion;
    return (
      <li key={place_id} onClick={handleAddressSelect(suggestion)} className={`p-2 cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
        <strong>{main_text}</strong> <small>{secondary_text}</small>
      </li>
    );
  });

  const isLoading = authLoading || isLoadingCustomer;
  if (isLoading) return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  if (errorCustomer) return <main className="p-4"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(errorCustomer as Error).message}</AlertDescription></Alert></main>;
  if (!canEditCustomers) return <main className="p-4"><Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle></Alert></main>;
  if (!customerData) return <main className="p-4"><Alert variant="destructive"><AlertTitle>Not Found</AlertTitle><AlertDescription>Customer not found.</AlertDescription></Alert></main>;

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Customer List
            </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users /> Edit Customer - {customerData?.name}</CardTitle>
            <CardDescription>Update the details for this customer.</CardDescription>
          </CardHeader>
          <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
                   <div><Label htmlFor="name">Customer Name <span className="text-destructive">*</span></Label><Controller name="name" control={customerForm.control} render={({ field }) => <Input id="name" {...field} />} />{customerForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.name.message}</p>}</div>
                   <div><Label htmlFor="contact_name">Primary Contact Name</Label><Controller name="contact_name" control={customerForm.control} render={({ field }) => <Input id="contact_name" {...field} value={field.value ?? ''} />} /></div>
                   <div><Label htmlFor="contact_email">Primary Contact Email</Label><Controller name="contact_email" control={customerForm.control} render={({ field }) => <Input id="contact_email" type="email" {...field} value={field.value ?? ''} />} /></div>
                   <div><Label htmlFor="contact_phone">Primary Contact Phone</Label><Controller name="contact_phone" control={customerForm.control} render={({ field }) => <Input id="contact_phone" type="tel" {...field} value={field.value ?? ''} />} /></div>
                   <div><Label htmlFor="status">Status</Label><Controller name="status" control={customerForm.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>)} /></div>
                </div>
                 <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">Billing Information</h3>
                    <div><Label htmlFor="billing_email">Billing Email</Label><Controller name="billing_email" control={customerForm.control} render={({ field }) => <Input id="billing_email" type="email" {...field} value={field.value ?? ''} />} />{customerForm.formState.errors.billing_email && <p className="text-sm text-destructive mt-1">{customerForm.formState.errors.billing_email.message}</p>}</div>
                    <div><Label>Billing Address</Label>
                        <Controller name="billing_address_line1" control={customerForm.control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Address Line 1</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                        <Controller name="billing_address_line2" control={customerForm.control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Address Line 2</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                        <div className="grid grid-cols-2 gap-2">
                            <Controller name="billing_city" control={customerForm.control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">City</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                            <Controller name="billing_province" control={customerForm.control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Province/State</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                            <Controller name="billing_postal_code" control={customerForm.control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Postal/Zip</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                            <Controller name="billing_country" control={customerForm.control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Country</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                        </div>
                    </div>
                     <div><Label htmlFor="billing_notes">Billing Notes</Label><Controller name="billing_notes" control={customerForm.control} render={({ field }) => <Textarea id="billing_notes" {...field} value={field.value ?? ''} rows={3}/>} /></div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
               <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={updateCustomerMutation.isPending || !canEditCustomers}><Save className="mr-2 h-4"/>{updateCustomerMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><MapPinIcon className="h-5 w-5" /> Related Locations</CardTitle>
                  {canCreateLocations && (
                    <Dialog open={isAddLocationDialogOpen} onOpenChange={setIsAddLocationDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4 w-4"/>Add Location</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Location for {customerData.name}</DialogTitle>
                                <DialogDescription>Enter the details for the new service location.</DialogDescription>
                            </DialogHeader>
                            <FormProvider {...locationForm}>
                                <form onSubmit={locationForm.handleSubmit(onLocationSubmit)}>
                                    <div className="grid gap-4 py-4">
                                        <div className="relative"><Label htmlFor="loc-name">Location Name / Search Address*</Label><Controller name="name" control={locationForm.control} render={({ field }) => (<Input id="loc-name" {...field} disabled={!ready} autoComplete="off"/>)} />{autocompleteStatus === 'OK' && (<ul className={`absolute z-50 mt-1 w-full rounded-md border shadow-lg ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>{renderSuggestions()}</ul>)}{locationForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{locationForm.formState.errors.name.message}</p>}</div>
                                        <div><Label htmlFor="loc-address1">Address Line 1*</Label><Controller name="address_line1" control={locationForm.control} render={({ field }) => <Input id="loc-address1" {...field}/>} />{locationForm.formState.errors.address_line1 && <p className="text-sm text-destructive">{locationForm.formState.errors.address_line1.message}</p>}</div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><Label htmlFor="loc-city">City*</Label><Controller name="city" control={locationForm.control} render={({ field }) => <Input id="loc-city" {...field}/>} />{locationForm.formState.errors.city && <p className="text-sm text-destructive">{locationForm.formState.errors.city.message}</p>}</div>
                                            <div><Label htmlFor="loc-province">State*</Label><Controller name="province" control={locationForm.control} render={({ field }) => <Input id="loc-province" {...field}/>} />{locationForm.formState.errors.province && <p className="text-sm text-destructive">{locationForm.formState.errors.province.message}</p>}</div>
                                        </div>
                                         <div className="grid grid-cols-2 gap-4">
                                            <div><Label htmlFor="loc-postal">Postal Code*</Label><Controller name="postal_code" control={locationForm.control} render={({ field }) => <Input id="loc-postal" {...field}/>} />{locationForm.formState.errors.postal_code && <p className="text-sm text-destructive">{locationForm.formState.errors.postal_code.message}</p>}</div>
                                            <div><Label htmlFor="loc-type">Location Type</Label><Controller name="location_type" control={locationForm.control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{locationTypes.map(type => <SelectItem key={type} value={type}>{formatEnum(type)}</SelectItem>)}</SelectContent></Select>} /></div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                        <Button type="submit" disabled={createLocationMutation.isPending}>
                                            {createLocationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Add Location
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </FormProvider>
                        </DialogContent>
                    </Dialog>
                  )}
              </CardHeader>
              <CardContent>
                  {isLoadingLocations ? (
                      <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin"/></div>
                  ) : relatedLocations.length > 0 ? (
                      <ul className="space-y-2">
                          {relatedLocations.map(loc => (
                              <li key={loc.id}>
                                  <Link href={`/locations/${loc.id}`} className="text-primary hover:underline">{loc.name}</Link>
                                  <p className="text-sm text-muted-foreground">{loc.address_line1}, {loc.city}</p>
                              </li>
                          ))}
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
    </>
  );
}
