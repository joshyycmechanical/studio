
'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlusCircle, Filter, Edit, Trash2, MapPin, Loader2, AlertCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Customer } from '@/types/customer';
// Import real data service functions
import { fetchCompanyCustomers, deleteCustomer } from '@/services/customers';


export default function CustomersPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');

  // --- Permission Checks ---
  const canView = !authLoading && hasPermission(user, 'customers', 'view');
  const canCreate = !authLoading && hasPermission(user, 'customers', 'create');
  const canEdit = !authLoading && hasPermission(user, 'customers', 'edit');
  const canDelete = !authLoading && hasPermission(user, 'customers', 'delete');

  // --- Data Fetching with TanStack Query ---
  const { data: customers = [], isLoading: loadingData, error } = useQuery<Customer[]>({
    queryKey: ['customers', companyId],
    queryFn: () => fetchCompanyCustomers(companyId!),
    enabled: !!companyId && canView, // Only fetch if companyId exists and user has permission
  });

  // --- Mutation for Deleting a Customer ---
  const deleteMutation = useMutation({
      mutationFn: (customerId: string) => {
          if (!companyId || !canDelete) throw new Error("Permission denied or missing company ID.");
          return deleteCustomer(companyId, customerId);
      },
      onSuccess: (_, customerId) => {
          toast({ title: "Customer Deleted", description: "The customer has been successfully deleted." });
          queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      },
      onError: (err: any) => {
          toast({ variant: "destructive", title: "Delete Failed", description: err.message || "Could not delete customer." });
      }
  });


  // Memoized Filtered Data
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(customer => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = customer.name.toLowerCase().includes(searchLower);
      const contactNameMatch = customer.contact_name?.toLowerCase().includes(searchLower);
      const contactEmailMatch = customer.contact_email?.toLowerCase().includes(searchLower);
      return nameMatch || !!contactNameMatch || !!contactEmailMatch;
    });
  }, [customers, searchTerm]);

  // --- Action Handlers ---
  const handleCreateCustomer = () => {
     if (!canCreate) return;
    router.push('/customers/new');
  };

  const handleEditCustomer = (customerId: string) => {
     if (!canEdit) return;
    router.push(`/customers/${customerId}`);
  };

    const handleViewLocations = (e: React.MouseEvent, customerId: string) => {
     e.stopPropagation(); // Prevent row click from navigating to edit page
     router.push(`/locations?customerId=${customerId}`);
   };

   const handleDeleteCustomer = (e: React.MouseEvent, customerId: string) => {
     e.stopPropagation(); // Prevent row click from navigating to edit page
     deleteMutation.mutate(customerId);
   }

  // --- Render Checks ---
   if (authLoading) {
     return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
   }
   if (!canView) {
     return (
       <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Access Denied</AlertTitle>
           <AlertDescription>You do not have permission to view customers.</AlertDescription>
         </Alert>
       </main>
     );
   }
    if (error) {
         return (
             <main className="flex flex-1 flex-col items-center justify-center p-4">
                <Alert variant="destructive" className="m-4 max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>{(error as Error).message}</AlertDescription>
                </Alert>
            </main>
         );
    }
  // --- End Render Checks ---

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
           <div className="flex justify-between items-center gap-4 flex-wrap">
             <div className="flex-grow">
                 <CardTitle className="flex items-center gap-2">
                    <Users className="h-6 w-6" /> Customers
                 </CardTitle>
                 <CardDescription>Manage customer information and history.</CardDescription>
             </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                 {canCreate && (
                   <Button size="sm" onClick={handleCreateCustomer} disabled={loadingData || deleteMutation.isPending}>
                     {loadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                     Add Customer
                   </Button>
                 )}
              </div>
           </div>
             <div className="mt-4">
                 <Input
                    placeholder="Search by name, contact, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                    disabled={loadingData}
                />
             </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {customers.length === 0 ? "No customers found." : "No customers match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((cust) => (
                      <TableRow key={cust.id} onClick={() => handleEditCustomer(cust.id)} className="cursor-pointer">
                        <TableCell className="font-medium">{cust.name}</TableCell>
                        <TableCell>{cust.contact_name || '-'}</TableCell>
                        <TableCell>{cust.contact_email || '-'}</TableCell>
                        <TableCell>{cust.contact_phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={cust.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                            {cust.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                           <Button variant="outline" size="icon" onClick={(e) => handleViewLocations(e, cust.id)} title="View Locations" disabled={deleteMutation.isPending && deleteMutation.variables === cust.id}>
                              <MapPin className="h-4 w-4" />
                              <span className="sr-only">View Locations</span>
                           </Button>
                          {canEdit && (
                            <Button variant="outline" size="icon" onClick={(e) => {e.stopPropagation(); handleEditCustomer(cust.id)}} title="Edit Customer" disabled={deleteMutation.isPending && deleteMutation.variables === cust.id}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog onOpenChange={(open) => { if(!open) { const event = new Event('click'); event.stopPropagation(); }}}>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" title="Delete Customer" onClick={(e) => e.stopPropagation()} disabled={deleteMutation.isPending && deleteMutation.variables === cust.id}>
                                   {deleteMutation.isPending && deleteMutation.variables === cust.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the customer "{cust.name}" and all associated data (locations, work orders, etc.).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={deleteMutation.isPending && deleteMutation.variables === cust.id}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={(e) => handleDeleteCustomer(e, cust.id)}
                                    disabled={deleteMutation.isPending && deleteMutation.variables === cust.id}
                                  >
                                    {deleteMutation.isPending && deleteMutation.variables === cust.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter className="text-sm text-muted-foreground">
             Total Customers: {filteredCustomers.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
         </CardFooter>
      </Card>
    </main>
  );
}
