
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlusCircle, Filter, Edit, Trash2, CalendarCheck, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { MaintenanceContract } from '@/types/maintenance';
import type { Customer } from '@/types/customer'; // Import Customer type
import { format } from 'date-fns';
// Import real data service functions
import { fetchCompanyMaintenanceContracts, deleteMaintenanceContract, fetchMaintenanceCustomers } from '@/services/maintenance'; // Use maintenance service

export default function MaintenancePage() {
  const { user: currentUser, loading: authLoading, companyId } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [contracts, setContracts] = useState<MaintenanceContract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // For delete loading state
  const [searchTerm, setSearchTerm] = useState('');

  // --- Permission Checks ---
  const canView = !authLoading && hasPermission(currentUser, 'maintenance', 'view');
  const canManage = !authLoading && hasPermission(currentUser, 'maintenance', 'manage');

  // Fetch Data using Firestore service
  const fetchData = useCallback(async () => {
    if (!companyId || !canView) {
      setLoadingData(false);
      setContracts([]);
      setCustomers([]);
      return;
    }
    setLoadingData(true);
    console.log(`[MaintenancePage] Fetching data for company: ${companyId}`);
    try {
      // Fetch contracts and customers in parallel
      const [contractData, customerData] = await Promise.all([
        fetchCompanyMaintenanceContracts(companyId),
        fetchMaintenanceCustomers(companyId) // Use service to fetch customers
      ]);
      setContracts(contractData);
      setCustomers(customerData);
    } catch (error: any) {
      console.error("[MaintenancePage] Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not load maintenance contracts or customers." });
      setContracts([]);
      setCustomers([]);
    } finally {
      setLoadingData(false);
    }
  }, [companyId, canView, toast]); // Dependencies for useCallback

  useEffect(() => {
    if (!authLoading) { // Only fetch if auth loading is complete
      fetchData();
    }
  }, [authLoading, fetchData]); // Refetch data when auth loading state changes or fetchData changes


  // Memoized Filtered Data
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = contract.name.toLowerCase().includes(searchLower);
      const customerName = customers.find(c => c.id === contract.customer_id)?.name.toLowerCase() ?? '';
      const customerMatch = customerName.includes(searchLower);
      return nameMatch || customerMatch;
    });
  }, [contracts, searchTerm, customers]);

  // --- Action Handlers ---
  const handleCreateContract = () => {
    if (!canManage) return;
    router.push('/maintenance/new');
  };

  const handleEditContract = (contractId: string) => {
    if (!canManage) return;
    router.push(`/maintenance/${contractId}`);
  };

  // Use the real deleteMaintenanceContract service function
  const handleDeleteContract = async (contractId: string, contractName: string) => {
    if (!canManage || !companyId) return;
    setIsSaving(true);
    try {
        await deleteMaintenanceContract(companyId, contractId);
        toast({ title: "Contract Deleted", description: `Contract "${contractName}" deleted.` });
        // Refetch data after deletion
        fetchData(); // Re-fetch the list
    } catch (error: any)
        { console.error("Error deleting contract:", error);
        toast({ variant: "destructive", title: "Delete Failed", description: error.message || "Could not delete contract." });
    } finally {
        setIsSaving(false);
    }
  }

  const getCustomerName = (customerId: string): string => {
    return customers.find(c => c.id === customerId)?.name ?? 'Loading...'; // Indicate loading
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
          <AlertDescription>You do not have permission to view maintenance schedules.</AlertDescription>
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
                <CalendarCheck className="h-6 w-6" /> Maintenance Schedules
              </CardTitle>
              <CardDescription>Manage recurring maintenance contracts and visits.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* TODO: Add Filter Button */}
              {/* <Button variant="outline" size="sm" disabled> <Filter className="mr-2 h-4 w-4" /> Filter </Button> */}
              {canManage && (
                <Button size="sm" onClick={handleCreateContract} disabled={loadingData || isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  New Contract
                </Button>
              )}
            </div>
          </div>
          {/* Search Input */}
          <div className="mt-4">
            <Input
              placeholder="Search by contract name or customer..."
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
                  <TableHead>Contract Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Visit Due</TableHead>{/* TODO: Calculate this */}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {contracts.length === 0 ? "No maintenance contracts found." : "No contracts match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.name}</TableCell>
                      <TableCell>{getCustomerName(contract.customer_id)}</TableCell>
                      <TableCell className="capitalize">{contract.frequency.replace('-', ' ')}</TableCell>
                      <TableCell>{contract.location_ids.length}</TableCell>
                      <TableCell>
                        <Badge variant={contract.is_active ? 'default' : 'secondary'}>
                          {contract.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{"-"}</TableCell>{/* Placeholder for Next Visit */}
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {canManage && (
                          <>
                            <Button variant="outline" size="icon" onClick={() => handleEditContract(contract.id)} title="Edit Contract" disabled={isSaving}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" title="Delete Contract" disabled={isSaving}>
                                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the contract "{contract.name}" and stop generating future visits.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => handleDeleteContract(contract.id, contract.name)}
                                    disabled={isSaving}
                                  >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
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
          Total Contracts: {filteredContracts.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        </CardFooter>
      </Card>
    </main>
  );
}
