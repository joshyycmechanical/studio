
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PlusCircle, Filter, Edit, Trash2, Construction, Loader2, AlertCircle, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, UserProfileWithRoles } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Repair } from '@/types/repair';
import type { Location } from '@/types/location';
// UserProfile is now imported via AuthContext
// import type { UserProfile } from '@/types/user';
import { format } from 'date-fns';
import Link from 'next/link';
// Import REAL Firestore service functions
import { fetchCompanyRepairs, deleteRepair } from '@/services/repairs';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyUsers } from '@/services/users';


export default function RepairsPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<Partial<UserProfileWithRoles>[]>([]); // Use partial for users
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null); // Track deleting repair ID
  const [searchTerm, setSearchTerm] = useState('');

  // --- Permission Checks ---
  const canView = !authLoading && hasPermission(user, 'repairs', 'view');
  const canCreate = !authLoading && hasPermission(user, 'repairs', 'create');
  const canEdit = !authLoading && hasPermission(user, 'repairs', 'edit');
  const canDelete = !authLoading && hasPermission(user, 'repairs', 'delete');

  // Fetch Data using Firestore service
  const fetchData = useCallback(async () => {
    if (!companyId || !canView) {
      setLoadingData(false);
      setRepairs([]);
      setLocations([]);
      setUsers([]);
      return;
    }
    setLoadingData(true);
    console.log(`[RepairsPage] Fetching data for company: ${companyId}`);
    try {
      // Fetch repairs, locations, and users in parallel
      const [repairData, locData, userData] = await Promise.all([
        fetchCompanyRepairs(companyId),
        fetchCompanyLocations(companyId), // Fetch locations
        fetchCompanyUsers(companyId) // Fetch users for technician name
      ]);
      setRepairs(repairData);
      setLocations(locData);
      setUsers(userData);
    } catch (error: any) {
      console.error("[RepairsPage] Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not load repair records." });
      setRepairs([]);
      setLocations([]);
      setUsers([]);
    } finally {
      setLoadingData(false);
    }
  }, [companyId, canView, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, fetchData]);

  // Memoized Filtered Data
  const filteredRepairs = useMemo(() => {
    return repairs.filter(rep => {
      const searchLower = searchTerm.toLowerCase();
      const descriptionMatch = rep.description.toLowerCase().includes(searchLower);
      const locationName = locations.find(l => l.id === rep.location_id)?.name.toLowerCase() ?? '';
      const locationMatch = locationName.includes(searchLower);
      const techName = users.find(t => t.id === rep.technician_id)?.full_name?.toLowerCase() ?? '';
      const techMatch = techName.includes(searchLower);
      // TODO: Add filtering by date, WO#, etc.
      return descriptionMatch || locationMatch || techMatch;
    });
  }, [repairs, searchTerm, locations, users]);

  // --- Action Handlers ---
  const handleCreateRepair = () => {
    if (!canCreate) return;
    router.push('/repairs/new');
  };

  const handleEditRepair = (repairId: string) => {
    if (!canEdit) return;
    router.push(`/repairs/${repairId}`);
  };

   // Use the real delete service function
   const handleDeleteRepair = async (repairId: string, description: string) => {
     if (!canDelete || !companyId) return;
     setIsSaving(repairId); // Set loading for this specific ID
     try {
         await deleteRepair(companyId, repairId);
         toast({ title: "Repair Record Deleted", description: `"${description}" deleted.` });
         fetchData(); // Refetch data after deletion
     } catch (error: any) {
         console.error("Error deleting repair record:", error);
         toast({ variant: "destructive", title: "Delete Failed", description: error.message || "Could not delete repair record." });
     } finally {
         setIsSaving(null); // Clear loading state
     }
   }

   // Helper Functions
   const getLocationName = (locationId: string): string => {
       return locations.find(l => l.id === locationId)?.name ?? 'N/A';
   }
   const getTechnicianName = (technicianId: string): string => {
       return users.find(t => t.id === technicianId)?.full_name ?? 'N/A';
   }
    const formatCurrency = (amount: number | null | undefined): string => {
        if (amount === null || amount === undefined) return '-';
        return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }); // Adjust currency as needed
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
                <AlertDescription>You do not have permission to view repair records.</AlertDescription>
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
                    <Construction className="h-6 w-6" /> Repairs
                 </CardTitle>
                 <CardDescription>Track repair records, labor, and materials.</CardDescription>
             </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                 {/* TODO: Add Filter Button */}
                 {/* <Button variant="outline" size="sm" disabled> <Filter className="mr-2 h-4 w-4" /> Filter </Button> */}
                 {canCreate && (
                   <Button size="sm" onClick={handleCreateRepair} disabled={loadingData || !!isSaving}>
                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                     Log Repair
                   </Button>
                 )}
              </div>
           </div>
            {/* Search Input */}
             <div className="mt-4">
                 <Input
                    placeholder="Search by description, location, tech..."
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
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Related WO</TableHead>
                  <TableHead>Labor (hrs)</TableHead>
                  <TableHead>Materials ($)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepairs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {repairs.length === 0 ? "No repair records found." : "No repairs match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRepairs.map((rep) => (
                      <TableRow key={rep.id}>
                        <TableCell className="font-medium max-w-xs truncate">{rep.description}</TableCell>
                        <TableCell>{format(new Date(rep.repair_date), 'PP')}</TableCell>
                        <TableCell>{getLocationName(rep.location_id)}</TableCell>
                        <TableCell>{getTechnicianName(rep.technician_id)}</TableCell>
                        <TableCell>
                           {rep.work_order_id ? (
                               <Link href={`/work-orders/${rep.work_order_id}`} className="text-primary hover:underline text-xs flex items-center gap-1">
                                 <Briefcase className="h-3 w-3"/> {/* TODO: Display WO Number if available */}
                                  WO-{rep.work_order_id.substring(0,4)} {/* Placeholder */}
                               </Link>
                            ) : '-'}
                        </TableCell>
                         <TableCell className="text-center">{rep.labor_hours ?? '-'}</TableCell>
                         <TableCell className="text-right">{formatCurrency(rep.materials_cost)}</TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                           {canEdit && (
                            <Button variant="outline" size="icon" onClick={() => handleEditRepair(rep.id)} title="Edit Repair" disabled={!!isSaving}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                           )}
                           {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" title="Delete Repair" disabled={isSaving === rep.id}>
                                   {isSaving === rep.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the repair record: "{rep.description}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={!!isSaving}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => handleDeleteRepair(rep.id, rep.description)}
                                    disabled={isSaving === rep.id} // Disable only if this item is being deleted
                                  >
                                    {isSaving === rep.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
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
             Total Repair Records: {filteredRepairs.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
         </CardFooter>
      </Card>
    </main>
  );
}
