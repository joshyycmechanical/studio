'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react'; // Import useCallback
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlusCircle, Filter, Edit, Trash2, Wrench, Loader2, AlertCircle, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Equipment, EquipmentStatus } from '@/types/equipment';
import type { Location } from '@/types/location'; // Import Location type
import type { Customer } from '@/types/customer'; // Import Customer type
import { format } from 'date-fns';
// Import REAL Firestore service functions
import {
    fetchCompanyEquipment,
    deleteEquipment
} from '@/services/equipment'; // Use equipment service
import { fetchCompanyLocations } from '@/services/locations'; // Use location service
import { fetchCompanyCustomers } from '@/services/customers'; // Use customer service


export default function EquipmentPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // Used for delete loading state
  const [searchTerm, setSearchTerm] = useState('');

  // --- Permission Checks ---
  const canView = !authLoading && hasPermission(user, 'equipment', 'view');
  const canCreate = !authLoading && hasPermission(user, 'equipment', 'create');
  const canEdit = !authLoading && hasPermission(user, 'equipment', 'edit');
  const canDelete = !authLoading && hasPermission(user, 'equipment', 'delete');

  // Fetch Data using REAL Firestore services
  const fetchData = useCallback(async () => {
    if (!companyId || !canView) {
        setLoadingData(false);
        setEquipmentList([]);
        setLocations([]);
        setCustomers([]);
        return;
    }
    setLoadingData(true);
    console.log(`[EquipmentPage] Fetching data for company: ${companyId}`);
    try {
        const [equipmentData, locationData, customerData] = await Promise.all([
            fetchCompanyEquipment(companyId),
            fetchCompanyLocations(companyId),
            fetchCompanyCustomers(companyId),
        ]);
        setEquipmentList(equipmentData);
        setLocations(locationData);
        setCustomers(customerData);
    } catch (error: any) {
        console.error("[EquipmentPage] Error fetching data:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "Could not load equipment." });
        setEquipmentList([]);
        setLocations([]);
        setCustomers([]);
    } finally {
        setLoadingData(false);
    }
   }, [companyId, canView, toast]);

   useEffect(() => {
       if (!authLoading) { // Only fetch when auth is ready
           fetchData();
       }
   }, [fetchData, authLoading]);


  // Memoized Filtered Data (remains the same)
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter(eq => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = eq.name.toLowerCase().includes(searchLower);
      const serialMatch = eq.serial_number?.toLowerCase().includes(searchLower);
      const modelMatch = eq.model_number?.toLowerCase().includes(searchLower);
      const typeMatch = eq.equipment_type?.toLowerCase().includes(searchLower);
      const locationName = locations.find(l => l.id === eq.location_id)?.name.toLowerCase() ?? '';
      const locationMatch = locationName.includes(searchLower);
      const customerName = customers.find(c => c.id === eq.customer_id)?.name.toLowerCase() ?? '';
      const customerMatch = customerName.includes(searchLower);
      return nameMatch || serialMatch || modelMatch || typeMatch || locationMatch || customerMatch;
    });
  }, [equipmentList, searchTerm, locations, customers]);

  // --- Action Handlers ---
  const handleCreateEquipment = () => {
     if (!canCreate) return;
    router.push('/equipment/new');
  };

  const handleEditEquipment = (equipmentId: string) => {
     if (!canEdit) return;
    router.push(`/equipment/${equipmentId}`);
  };

    const handleViewLocation = (locationId: string) => {
     // Assuming location view permission is checked on the target page
     router.push(`/locations/${locationId}`);
   };

   // Use the REAL deleteEquipment service function
   const handleDeleteEquipment = async (equipmentId: string, equipmentName: string) => {
     if (!canDelete || !companyId) return;
     setIsSaving(true);
     try {
         await deleteEquipment(companyId, equipmentId); // Call REAL service
         toast({ title: "Equipment Deleted", description: `Equipment "${equipmentName}" deleted.` });
         fetchData(); // Refetch data after deletion
     } catch (error: any) {
         console.error("Error deleting equipment:", error);
         toast({ variant: "destructive", title: "Delete Failed", description: error.message || "Could not delete equipment." });
     } finally {
         setIsSaving(false);
     }
   }

   // Helper Functions (remain the same)
   const getLocationName = (locationId: string): string => {
       return locations.find(l => l.id === locationId)?.name ?? 'Loading...';
   }
   const getCustomerName = (customerId: string): string => {
       return customers.find(c => c.id === customerId)?.name ?? 'Loading...';
   }
   const getStatusBadgeVariant = (status: EquipmentStatus): "default" | "destructive" | "secondary" | "outline" => {
        switch (status) {
            case 'operational': return 'default'; // Like green/blue
            case 'needs-repair': return 'destructive'; // Like red/orange
            case 'decommissioned': return 'secondary'; // Like grey
            default: return 'outline';
        }
    };

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
           <AlertDescription>You do not have permission to view equipment.</AlertDescription>
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
                    <Wrench className="h-6 w-6" /> Equipment
                 </CardTitle>
                 <CardDescription>Track and manage customer equipment assets.</CardDescription>
             </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                 {/* TODO: Add Filter Button */}
                 {/* <Button variant="outline" size="sm" disabled> <Filter className="mr-2 h-4 w-4" /> Filter </Button> */}
                 {canCreate && (
                   <Button size="sm" onClick={handleCreateEquipment} disabled={loadingData || isSaving}>
                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                     Add Equipment
                   </Button>
                 )}
              </div>
           </div>
            {/* Search Input */}
             <div className="mt-4">
                 <Input
                    placeholder="Search by name, serial, location, customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-lg"
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
                  <TableHead>Location</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {equipmentList.length === 0 ? "No equipment found." : "No equipment matches your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEquipment.map((eq) => (
                      <TableRow key={eq.id}>
                        <TableCell className="font-medium">{eq.name}</TableCell>
                        <TableCell>
                             <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => handleViewLocation(eq.location_id)}>
                                {getLocationName(eq.location_id)}
                             </Button>
                        </TableCell>
                        <TableCell>{getCustomerName(eq.customer_id)}</TableCell>
                        <TableCell>{eq.equipment_type || '-'}</TableCell>
                        <TableCell>{eq.serial_number || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(eq.status)} className="capitalize">{eq.status.replace('-', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          {canEdit && (
                            <Button variant="outline" size="icon" onClick={() => handleEditEquipment(eq.id)} title="Edit Equipment" disabled={isSaving}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" title="Delete Equipment" disabled={isSaving}>
                                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the equipment "{eq.name}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => handleDeleteEquipment(eq.id, eq.name)}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
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
             Total Equipment: {filteredEquipment.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
         </CardFooter>
      </Card>
    </main>
  );
}
