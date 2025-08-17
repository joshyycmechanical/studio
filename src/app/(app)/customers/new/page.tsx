
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Users, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { createCustomerWithContacts } from '@/services/customers';
import { Separator } from '@/components/ui/separator';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { useTheme } from 'next-themes';
import ContactManager from '@/components/common/ContactManager';
import type { Contact } from '@/types/contact';

const customerSchema = z.object({
  name: z.string().min(1, { message: 'Customer Name is required' }),
  status: z.enum(['active', 'inactive']),
  billing_email: z.string().email("Invalid billing email").optional().or(z.literal('')),
  billing_address_line1: z.string().optional(),
  billing_address_line2: z.string().optional(),
  billing_city: z.string().optional(),
  billing_province: z.string().optional(),
  billing_postal_code: z.string().optional(),
  billing_country: z.string().optional(),
  billing_notes: z.string().optional(),
  contacts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    role: z.string().optional(),
    isPrimary: z.boolean(),
  })).optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function NewCustomerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  
  const canCreateCustomers = !authLoading && hasPermission(user, 'customers', 'create');

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      status: 'active',
      billing_email: '',
      billing_address_line1: '',
      billing_address_line2: '',
      billing_city: '',
      billing_province: '',
      billing_postal_code: '',
      billing_country: '',
      billing_notes: '',
      contacts: [],
    },
  });

  const customerName = useWatch({ control, name: 'name' });
  const contacts = useWatch({ control, name: 'contacts', defaultValue: [] as Contact[] });

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue: setAutocompleteValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {},
    debounce: 300,
  });

  useEffect(() => {
    if (customerName) {
      setAutocompleteValue(customerName);
    }
  }, [customerName, setAutocompleteValue]);

  const handleSelect = ({ description }: { description: string }) => () => {
    setAutocompleteValue(description, false);
    clearSuggestions();

    getGeocode({ address: description })
      .then((results) => {
        onAddressSelect(results[0].address_components, description);
      })
      .catch((error) => {
        console.log("😱 Error: ", error);
      });
  };
  
  const onAddressSelect = (addressComponents: any[], description: string) => {
    let streetNumber = '', route = '';
    
    addressComponents.forEach(component => {
        const types = component.types;
        if(types.includes('street_number')) streetNumber = component.long_name;
        if(types.includes('route')) route = component.long_name;
        if(types.includes('locality')) setValue('billing_city', component.long_name);
        if(types.includes('administrative_area_level_1')) setValue('billing_province', component.short_name);
        if(types.includes('postal_code')) setValue('billing_postal_code', component.long_name);
        if(types.includes('country')) setValue('billing_country', component.long_name);
    });

    setValue('billing_address_line1', streetNumber && route ? `${streetNumber} ${route}`: description.split(',')[0]);
  }

  const renderSuggestions = () =>
  data.map((suggestion) => {
    const { place_id, structured_formatting: { main_text, secondary_text } } = suggestion;
    return (
      <li key={place_id} onClick={handleSelect(suggestion)} className={`p-2 cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
        <strong>{main_text}</strong> <small>{secondary_text}</small>
      </li>
    );
  });

  const onSubmit = async (data: CustomerFormData) => {
    if (!canCreateCustomers || !companyId || !user) {
       toast({ variant: "destructive", title: "Error", description: "Permission denied or missing context." });
       return;
    }

    try {
       await createCustomerWithContacts(data, data.contacts ?? []);
       toast({ title: "Customer Created", description: `Customer "${data.name}" has been successfully created.` });
       router.push('/customers');
    } catch (error: any) {
       toast({ variant: "destructive", title: "Creation Failed", description: error.message });
    }
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 /></div>;
  if (!canCreateCustomers) return <main className="p-4"><Alert variant="destructive"><AlertCircle /> <AlertTitle>Access Denied</AlertTitle></Alert></main>;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 md:gap-8">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid auto-rows-max items-start gap-4 lg:col-span-2">
                <Card><CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><Label htmlFor="name">Customer Name <span className="text-destructive">*</span></Label><Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />{errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}</div>
                            <div><Label htmlFor="status">Status</Label><Controller name="status" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>)} /></div>
                        </div>
                    </CardContent>
                </Card>
                <ContactManager contacts={contacts as any} onContactsChange={(updatedContacts) => setValue('contacts', updatedContacts)} />
            </div>
            <div className="grid auto-rows-max items-start gap-4 lg:col-span-1">
                <Card><CardHeader><CardTitle>Billing Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div><Label htmlFor="billing_email">Billing Email</Label><Controller name="billing_email" control={control} render={({ field }) => <Input id="billing_email" type="email" {...field} value={field.value ?? ''} />} />{errors.billing_email && <p className="text-sm text-destructive mt-1">{errors.billing_email.message}</p>}</div>
                        <div className="space-y-2">
                            <Label>Billing Address</Label>
                            <div className="relative">
                                <Controller name="billing_address_line1" control={control} render={({ field }) => (<Input {...field} value={value} onChange={(e) => {setAutocompleteValue(e.target.value); field.onChange(e);}} disabled={!ready} placeholder="Search for an address" />)} />
                                {status === "OK" && <ul className={`absolute z-10 mt-1 w-full rounded-md border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-black'}`}>{renderSuggestions()}</ul>}
                            </div>
                            <Controller name="billing_address_line2" control={control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Address Line 2</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                            <div className="grid grid-cols-2 gap-2">
                                <Controller name="billing_city" control={control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">City</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                                <Controller name="billing_province" control={control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Province/State</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Controller name="billing_postal_code" control={control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Postal/Zip</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                                <Controller name="billing_country" control={control} render={({ field }) => (<div><Label className="text-xs text-muted-foreground">Country</Label><Input {...field} value={field.value ?? ''}/></div>)}/>
                            </div>
                        </div>
                        <div><Label htmlFor="billing_notes">Billing Notes</Label><Controller name="billing_notes" control={control} render={({ field }) => <Textarea id="billing_notes" {...field} value={field.value ?? ''} rows={3}/>} /></div>
                    </CardContent>
                </Card>
            </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Customer</>}</Button>
        </div>
      </form>
    </main>
  );
}
