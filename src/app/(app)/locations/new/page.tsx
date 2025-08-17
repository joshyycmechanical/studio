
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, MapPin, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Location } from '@/types/location';
import type { Customer } from '@/types/customer';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { createLocation } from '@/services/locations';
import { fetchCompanyCustomers } from '@/services/customers';
import { formatEnum } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import usePlacesAutocomplete, { getGeocode } from 'use-places-autocomplete';
import { useTheme } from 'next-themes';


const locationTypes = ['restaurant', 'warehouse', 'office', 'residential', 'other'] as const;

const locationSchema = z.object({
  name: z.string().min(1, { message: 'Location Name is required' }),
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  address_line1: z.string().min(1, { message: 'Address Line 1 is required' }),
  address_line2: z.string().optional().nullable(),
  city: z.string().min(1, { message: 'City is required' }),
  province: z.string().min(1, { message: 'Province/State is required' }),
  postal_code: z.string().min(1, { message: 'Postal/Zip Code is required' }),
  country: z.string().min(1, { message: 'Country is required' }),
  location_type: z.enum(locationTypes),
});

type LocationFormData = z.infer<typeof locationSchema>;

export default function NewLocationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const { theme } = useTheme();

  const canCreateLocations = !authLoading && hasPermission(user, 'locations', 'create');

  const formMethods = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '', customer_id: '', address_line1: '', address_line2: '',
      city: '', province: '', postal_code: '', country: 'USA', location_type: 'other',
    },
  });

   const { ready, value: autocompleteValue, suggestions: { status: autocompleteStatus, data: autocompleteData }, setValue: setAutocompleteValue, clearSuggestions } = usePlacesAutocomplete({ requestOptions: {}, debounce: 300 });
   const locationNameValue = formMethods.watch('name');
   useEffect(() => { setAutocompleteValue(locationNameValue) }, [locationNameValue, setAutocompleteValue]);

   useEffect(() => {
     if (!companyId || !canCreateLocations) {
         setLoadingCustomers(false);
         return;
     }
     const fetchCustomers = async () => {
       setLoadingCustomers(true);
       try {
         const fetchedCustomers = await fetchCompanyCustomers(companyId);
         setCustomers(fetchedCustomers);
       } catch (error: any) {
         toast({ variant: "destructive", title: "Error", description: error.message || "Could not load customers." });
       } finally {
         setLoadingCustomers(false);
       }
     };
     fetchCustomers();
   }, [companyId, canCreateLocations, toast]);
   
  const handleAddressSelect = (suggestion: google.maps.places.AutocompletePrediction) => async () => {
    formMethods.setValue('name', suggestion.structured_formatting.main_text, { shouldValidate: true });
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
            if (types.includes('locality')) formMethods.setValue('city', component.long_name);
            if (types.includes('administrative_area_level_1')) formMethods.setValue('province', component.short_name);
            if (types.includes('postal_code')) formMethods.setValue('postal_code', component.long_name);
            if (types.includes('country')) formMethods.setValue('country', component.long_name);
        });
        formMethods.setValue('address_line1', `${streetNumber} ${route}`.trim());
    } catch (error) {
        console.error("Geocoding Error: ", error);
        toast({ title: 'Geocoding Error', description: 'Could not fetch address details.', variant: 'destructive' });
    }
  };


  const onSubmit = async (data: LocationFormData) => {
    if (!canCreateLocations || !companyId || !user) {
       toast({ variant: "destructive", title: "Error", description: "Permission denied or missing context." });
       return;
    }
    
    try {
       await createLocation(data);
       toast({ title: "Location Created", description: `Location "${data.name}" has been successfully created.` });
       router.push('/locations');
    } catch (error: any) {
       toast({ variant: "destructive", title: "Creation Failed", description: error.message });
    }
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 /></div>;
  if (!canCreateLocations) return <main className="p-4"><Alert variant="destructive"><AlertCircle /> <AlertTitle>Access Denied</AlertTitle></Alert></main>;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 md:gap-8">
      <Card>
        <FormProvider {...formMethods}>
            <form onSubmit={formMethods.handleSubmit(onSubmit)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin /> Create New Location</CardTitle>
                <CardDescription>Fill in the details below to add a new service location.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div><Label htmlFor="customer_id">Customer <span className="text-destructive">*</span></Label><Controller name="customer_id" control={formMethods.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value} disabled={loadingCustomers}><SelectTrigger id="customer_id"><SelectValue placeholder={loadingCustomers ? "Loading..." : "Select Customer"} /></SelectTrigger><SelectContent>{customers.map(customer => (<SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>))}{customers.length === 0 && !loadingCustomers && <SelectItem value="" disabled>No customers found</SelectItem>}</SelectContent></Select>)} />{formMethods.formState.errors.customer_id && <p className="text-sm text-destructive mt-1">{formMethods.formState.errors.customer_id.message}</p>}</div>
                <div className="relative"><Label htmlFor="name">Location Name / Search Address*</Label><Controller name="name" control={formMethods.control} render={({ field }) => (<Input id="name" {...field} disabled={!ready}/>)} />{autocompleteStatus === 'OK' && (<ul className={`absolute z-50 mt-1 w-full rounded-md border shadow-lg ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>{autocompleteData.map((suggestion) => (<li key={suggestion.place_id} onClick={handleAddressSelect(suggestion)} className={`p-2 cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}><strong>{suggestion.structured_formatting.main_text}</strong> <small>{suggestion.structured_formatting.secondary_text}</small></li>))}</ul>)}{formMethods.formState.errors.name && <p className="text-sm text-destructive mt-1">{formMethods.formState.errors.name.message}</p>}</div>
                <Separator/>
                <h3 className="text-lg font-semibold">Address Details</h3>
                <div className="space-y-4">
                    <div className="md:col-span-2"><Label htmlFor="address_line1">Address Line 1 <span className="text-destructive">*</span></Label><Controller name="address_line1" control={formMethods.control} render={({ field }) => <Input id="address_line1" {...field} />} />{formMethods.formState.errors.address_line1 && <p className="text-sm text-destructive mt-1">{formMethods.formState.errors.address_line1.message}</p>}</div>
                    <div className="md:col-span-2"><Label htmlFor="address_line2">Address Line 2</Label><Controller name="address_line2" control={formMethods.control} render={({ field }) => (<Input id="address_line2" {...field} value={field.value ?? ''}/>)} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><Label htmlFor="city">City <span className="text-destructive">*</span></Label><Controller name="city" control={formMethods.control} render={({ field }) => (<Input id="city" {...field} />)} />{formMethods.formState.errors.city && <p className="text-sm text-destructive mt-1">{formMethods.formState.errors.city.message}</p>}</div>
                        <div><Label htmlFor="province">Province/State <span className="text-destructive">*</span></Label><Controller name="province" control={formMethods.control} render={({ field }) => (<Input id="province" {...field} />)} />{formMethods.formState.errors.province && <p className="text-sm text-destructive mt-1">{formMethods.formState.errors.province.message}</p>}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><Label htmlFor="postal_code">Postal/Zip Code <span className="text-destructive">*</span></Label><Controller name="postal_code" control={formMethods.control} render={({ field }) => (<Input id="postal_code" {...field} />)} />{formMethods.formState.errors.postal_code && <p className="text-sm text-destructive mt-1">{formMethods.formState.errors.postal_code.message}</p>}</div>
                        <div><Label htmlFor="country">Country <span className="text-destructive">*</span></Label><Controller name="country" control={formMethods.control} render={({ field }) => (<Input id="country" {...field} />)} />{formMethods.formState.errors.country && <p className="text-sm text-destructive mt-1">{formMethods.formState.errors.country.message}</p>}</div>
                    </div>
                </div>
                <div><Label htmlFor="location_type">Location Type</Label><Controller name="location_type" control={formMethods.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger id="location_type"><SelectValue/></SelectTrigger><SelectContent>{locationTypes.map(type => (<SelectItem key={type} value={type}>{formatEnum(type)}</SelectItem>))}</SelectContent></Select>)} /></div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={formMethods.formState.isSubmitting || loadingCustomers}>{formMethods.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Create Location</Button>
            </CardFooter>
            </form>
        </FormProvider>
      </Card>
    </main>
  );
}
