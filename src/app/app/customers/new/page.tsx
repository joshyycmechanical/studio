'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
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
import type { Customer } from '@/types/customer';
import { hasPermission } from '@/lib/permissions'; // Import permission checker
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Import Alert
// Import real data service function
import { createCustomer } from '@/services/customers';
import { formatEnum } from '@/lib/utils';

// Define the form schema using Zod
const customerSchema = z.object({
  name: z.string().min(1, { message: 'Customer Name is required' }),
  contact_name: z.string().optional(),
  contact_email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')), // Allow empty string or valid email
  contact_phone: z.string().optional(),
  billing_notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function NewCustomerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

   const canCreateCustomers = !authLoading && hasPermission(user, 'customers', 'create');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      billing_notes: '',
      status: 'active', // Default status
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    if (!canCreateCustomers) {
       toast({ variant: "destructive", title: "Permission Denied", description: "You cannot create customers." });
       return;
    }
    if (!companyId || !user) {
       toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
       return;
    }
    setIsSubmitting(true);
    console.log("Submitting New Customer Data:", data);

    // Prepare data for the service function
     const customerData: Omit<Customer, 'id' | 'created_at'> = {
         company_id: companyId,
         name: data.name,
         contact_name: data.contact_name?.trim() || null, // Use trim and null coalescing
         contact_email: data.contact_email?.trim() || null, // Use trim and null coalescing
         contact_phone: data.contact_phone?.trim() || null, // Use trim and null coalescing
         billing_notes: data.billing_notes?.trim() || null, // Use trim and null coalescing
         status: data.status,
     };

    try {
       // Use the real service function
       const newCustomer = await createCustomer(customerData);

       toast({
        title: "Customer Created",
        description: `Customer "${newCustomer.name}" has been successfully created.`,
       });
       router.push('/customers'); // Redirect back to the list page

    } catch (error: any) {
       console.error("Failed to create customer:", error);
       toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the customer. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

   // --- Render Checks ---
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateCustomers) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to create new customers.</AlertDescription>
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
             <Users className="h-6 w-6" /> Create New Customer
          </CardTitle>
          <CardDescription>Fill in the details below to add a new customer.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
               {/* Customer Name */}
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

               {/* Contact Name */}
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

              {/* Contact Email */}
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

             {/* Column 2 */}
            <div className="space-y-4">
              {/* Contact Phone */}
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

              {/* Status */}
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

              {/* Billing Notes */}
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
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
             </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Creating...' : 'Create Customer'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
