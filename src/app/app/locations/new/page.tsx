'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, MapPin, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Location } from '@/types/location';
import type { Customer } from '@/types/customer';
import { hasPermission } from '@/lib/permissions'; // Import permission checker
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Import Alert
// Import real data service functions
import { createLocation } from '@/services/locations'; // Use locations service
import { fetchCompanyCustomers } from '@/services/customers'; // Use customers service
import { formatEnum } from '@/lib/utils';

// Location types
const locationTypes = ['restaurant', 'warehouse', 'office', 'residential', 'other'] as const;

// Define the form schema using Zod
const locationSchema = z.object({
  name: z.string().min(1, { message: 'Location Name is required' }),
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  address_line1: z.string().min(1, { message: 'Address Line 1 is required' }),
  address_line2: z.string().optional(),
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
  const { user, companyId, loading: authLoading } = useAuth(); // Added authLoading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  const canCreateLocations = !authLoading && hasPermission(user, 'locations', 'create');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: '',
      customer_id: '',
      address_line1: '',
      address_line2: '',
      city: '',
      province: '',
      postal_code: '',
      country: 'USA', // Default country
      location_type: 'other', // Default type
    },
  });

   // Fetch customer data for dropdown using the service
   useEffect(() => {
     if (!companyId || !canCreateLocations) { // Check permission before fetching
         setLoadingCustomers(false);
         return;
     }
     const fetchCustomers = async () => {
       setLoadingCustomers(true);
       try {
         const fetchedCustomers = await fetchCompanyCustomers(companyId);
         setCustomers(fetchedCustomers);
       } catch (error: any) {
         console.error("Error fetching customers:", error);
         toast({ variant: "destructive", title: "Error", description: error.message || "Could not load customers." });
       } finally {
         setLoadingCustomers(false);
       }
     };
     fetchCustomers();
   }, [companyId, canCreateLocations, toast]);


  // Use the createLocation service function
  const onSubmit = async (data: LocationFormData) => {
    if (!canCreateLocations) {
       toast({ variant: "destructive", title: "Permission Denied", description: "You cannot create locations." });
       return;
    }
    if (!companyId || !user) {
       toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
       return;
    }
    setIsSubmitting(true);
    console.log("Submitting New Location Data:", data);

     // Prepare data for the service function
     const locationData: Omit<Location, 'id' | 'created_at' | 'equipment_count'> = {
         company_id: companyId,
         customer_id: data.customer_id,
         name: data.name.trim(),
         address_line1: data.address_line1.trim(),
         address_line2: data.address_line2?.trim() || null,
         city: data.city.trim(),
         province: data.province.trim(),
         postal_code: data.postal_code.trim(),
         country: data.country.trim(),
         location_type: data.location_type,
         // created_at is handled by the service, equipment_count starts at 0
     };

    try {
       await createLocation(locationData);

       toast({
        title: "Location Created",
        description: `Location "${data.name}" has been successfully created.`,
       });
       router.push('/locations'); // Redirect back to the list page

    } catch (error: any) {
       console.error("Failed to create location:", error);
       toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the location. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

   // --- Render Checks ---
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateLocations) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to create new locations.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </main>
    );
  }
   // --- End Render Checks ---


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <MapPin className="h-6 w-6" /> Create New Location
          </CardTitle>
          <CardDescription>Fill in the details below to add a new service location.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

               {/* Customer (Dropdown) */}
              <div>
                 <Label htmlFor="customer_id">Customer <span className="text-destructive">*</span></Label>
                 <Controller
                    name="customer_id"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={loadingCustomers}>
                        <SelectTrigger id="customer_id">
                            <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select Customer"} />
                        </SelectTrigger>
                        <SelectContent>
                             {customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                            </SelectItem>
                            ))}
                             {customers.length === 0 && !loadingCustomers && <SelectItem value="no-customers-placeholder" disabled>No customers found</SelectItem>}
                        </SelectContent>
                        </Select>
                    )}
                    />
                {errors.customer_id && <p className="text-sm text-destructive mt-1">{errors.customer_id.message}</p>}
              </div>

              {/* Location Name */}
              <div>
                 <Label htmlFor="name">Location Name <span className="text-destructive">*</span></Label>
                <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <Input id="name" placeholder="e.g., Downtown Branch" {...field} />
                    )}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>

               {/* Address Line 1 */}
              <div className="md:col-span-2">
                 <Label htmlFor="address_line1">Address Line 1 <span className="text-destructive">*</span></Label>
                <Controller
                    name="address_line1"
                    control={control}
                    render={({ field }) => (
                        <Input id="address_line1" placeholder="e.g., 123 Main St" {...field} />
                    )}
                />
                {errors.address_line1 && <p className="text-sm text-destructive mt-1">{errors.address_line1.message}</p>}
              </div>

               {/* Address Line 2 */}
              <div className="md:col-span-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                 <Controller
                    name="address_line2"
                    control={control}
                    render={({ field }) => (
                        <Input id="address_line2" placeholder="Apt, Suite, Building, etc. (Optional)" {...field} value={field.value ?? ''}/>
                    )}
                />
              </div>

               {/* City */}
              <div>
                 <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                <Controller
                    name="city"
                    control={control}
                    render={({ field }) => (
                        <Input id="city" placeholder="e.g., Metropolis" {...field} />
                    )}
                />
                {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
              </div>

              {/* Province/State */}
              <div>
                 <Label htmlFor="province">Province/State <span className="text-destructive">*</span></Label>
                <Controller
                    name="province"
                    control={control}
                    render={({ field }) => (
                        <Input id="province" placeholder="e.g., CA" {...field} />
                    )}
                />
                {errors.province && <p className="text-sm text-destructive mt-1">{errors.province.message}</p>}
              </div>

               {/* Postal/Zip Code */}
              <div>
                 <Label htmlFor="postal_code">Postal/Zip Code <span className="text-destructive">*</span></Label>
                <Controller
                    name="postal_code"
                    control={control}
                    render={({ field }) => (
                        <Input id="postal_code" placeholder="e.g., 90210" {...field} />
                    )}
                />
                {errors.postal_code && <p className="text-sm text-destructive mt-1">{errors.postal_code.message}</p>}
              </div>

               {/* Country */}
              <div>
                 <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                <Controller
                    name="country"
                    control={control}
                    render={({ field }) => (
                        // TODO: Consider making this a dropdown if supporting multiple countries widely
                        <Input id="country" placeholder="e.g., USA" {...field} />
                    )}
                />
                {errors.country && <p className="text-sm text-destructive mt-1">{errors.country.message}</p>}
              </div>

               {/* Location Type */}
              <div>
                <Label htmlFor="location_type">Location Type</Label>
                <Controller
                    name="location_type"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="location_type">
                            <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {locationTypes.map(type => (
                                <SelectItem key={type} value={type}>{formatEnum(type)}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    )}
                />
              </div>

          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
             </Button>
            <Button type="submit" disabled={isSubmitting || loadingCustomers}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Creating...' : 'Create Location'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
