
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
import { PlusCircle, Filter, Edit, Trash2, MapPin, Loader2, AlertCircle, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Location } from '@/types/location';
import type { Customer } from '@/types/customer';
import { fetchCompanyLocations, deleteLocation } from '@/services/locations';
import { fetchCompanyCustomers } from '@/services/customers';

export default function LocationsPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');

  const canView = !authLoading && hasPermission(user, 'locations', 'view');
  const canCreate = !authLoading && hasPermission(user, 'locations', 'create');
  const canEdit = !authLoading && hasPermission(user, 'locations', 'edit');
  const canDelete = !authLoading && hasPermission(user, 'locations', 'delete');

  const { data: locations = [], isLoading: isLoadingLocations, error: locationsError } = useQuery<Location[]>({
    queryKey: ['locations', companyId],
    queryFn: () => fetchCompanyLocations(companyId!),
    enabled: !!companyId && canView,
  });

  const { data: customers = [], isLoading: isLoadingCustomers, error: customersError } = useQuery<Customer[]>({
    queryKey: ['customers', companyId],
    queryFn: () => fetchCompanyCustomers(companyId!),
    enabled: !!companyId && canView,
  });

  const deleteMutation = useMutation({
    mutationFn: (locationId: string) => {
        if (!companyId || !canDelete) throw new Error("Permission denied or missing company ID.");
        return deleteLocation(companyId, locationId);
    },
    onSuccess: () => {
        toast({ title: "Location Deleted", description: "The location has been successfully deleted." });
        queryClient.invalidateQueries({ queryKey: ['locations', companyId] });
    },
    onError: (err: any) => {
        toast({ variant: "destructive", title: "Delete Failed", description: err.message || "Could not delete location." });
    }
  });

  const loadingData = isLoadingLocations || isLoadingCustomers;
  const error = locationsError || customersError;

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    return locations.filter(location => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = location.name.toLowerCase().includes(searchLower);
      const addressMatch = location.address_line1.toLowerCase().includes(searchLower);
      const cityMatch = location.city.toLowerCase().includes(searchLower);
      const postalCodeMatch = location.postal_code.toLowerCase().includes(searchLower);
      const customerName = customers.find(c => c.id === location.customer_id)?.name.toLowerCase() ?? '';
      const customerMatch = customerName.includes(searchLower);
      return nameMatch || addressMatch || cityMatch || postalCodeMatch || customerMatch;
    });
  }, [locations, searchTerm, customers]);

  const handleCreateLocation = () => {
     if (!canCreate) return;
    router.push('/locations/new');
  };

  const handleEditLocation = (locationId: string) => {
     if (!canEdit) return;
    router.push(`/locations/${locationId}`);
  };

  const handleViewEquipment = (locationId: string) => {
     router.push(`/equipment?locationId=${locationId}`);
   };

  const handleDeleteLocation = (locationId: string) => {
     deleteMutation.mutate(locationId);
  }

  const getCustomerName = (customerId: string): string => {
       return customers.find(c => c.id === customerId)?.name ?? 'Loading...';
  }

   if (authLoading) {
     return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
   }
   if (!canView) {
     return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You do not have permission to view locations.</AlertDescription>
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

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
           <div className="flex justify-between items-center gap-4 flex-wrap">
             <div className="flex-grow">
                 <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-6 w-6" /> Locations
                 </CardTitle>
                 <CardDescription>Manage service locations and site details.</CardDescription>
             </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                 {canCreate && (
                   <Button size="sm" onClick={handleCreateLocation} disabled={loadingData || deleteMutation.isPending}>
                     {loadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                     Add Location
                   </Button>
                 )}
              </div>
           </div>
             <div className="mt-4">
                 <Input
                    placeholder="Search by name, address, customer..."
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {locations.length === 0 ? "No locations found." : "No locations match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell className="font-medium">{loc.name}</TableCell>
                        <TableCell>{getCustomerName(loc.customer_id)}</TableCell>
                        <TableCell>{loc.address_line1}</TableCell>
                        <TableCell>{loc.city}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{loc.location_type}</Badge></TableCell>
                        <TableCell className="text-center">{loc.equipment_count}</TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                           <Button variant="outline" size="icon" onClick={() => handleViewEquipment(loc.id)} title="View Equipment" disabled={deleteMutation.isPending && deleteMutation.variables === loc.id}>
                              <Wrench className="h-4 w-4" />
                              <span className="sr-only">View Equipment</span>
                           </Button>
                          {canEdit && (
                            <Button variant="outline" size="icon" onClick={() => handleEditLocation(loc.id)} title="Edit Location" disabled={deleteMutation.isPending && deleteMutation.variables === loc.id}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" title="Delete Location" disabled={deleteMutation.isPending && deleteMutation.variables === loc.id}>
                                  {deleteMutation.isPending && deleteMutation.variables === loc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the location "{loc.name}" and all associated data (equipment, work orders, etc.).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={deleteMutation.isPending && deleteMutation.variables === loc.id}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => handleDeleteLocation(loc.id)}
                                    disabled={deleteMutation.isPending && deleteMutation.variables === loc.id}
                                  >
                                    {deleteMutation.isPending && deleteMutation.variables === loc.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
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
             Total Locations: {filteredLocations.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
         </CardFooter>
      </Card>
    </main>
  );
}
