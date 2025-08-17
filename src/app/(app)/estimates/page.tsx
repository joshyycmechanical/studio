
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlusCircle, Filter, Edit, Trash2, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Estimate, EstimateStatus } from '@/types/estimate';
import type { Customer } from '@/types/customer';
import { format } from 'date-fns';
// Import REAL Firestore service functions
import { fetchCompanyEstimates, deleteEstimate } from '@/services/estimates';
import { fetchCompanyCustomers } from '@/services/customers'; // To get customer names


export default function EstimatesPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]); // State for customers
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // Use for delete loading state
  const [searchTerm, setSearchTerm] = useState('');

  // --- Permission Checks ---
  const canView = !authLoading && hasPermission(user, 'estimates', 'view');
  const canCreate = !authLoading && hasPermission(user, 'estimates', 'create');
  const canEdit = !authLoading && hasPermission(user, 'estimates', 'edit');
  const canDelete = !authLoading && hasPermission(user, 'estimates', 'delete');
  const canSend = !authLoading && hasPermission(user, 'estimates', 'send');

  // Fetch Data using Firestore services
  const fetchData = useCallback(async () => {
    if (!companyId || !canView) {
      setLoadingData(false);
      setEstimates([]);
      setCustomers([]);
      return;
    }
    setLoadingData(true);
    console.log(`[EstimatesPage] Fetching data for company: ${companyId}`);
    try {
      // Fetch estimates and customers in parallel
      const [estimatesData, customersData] = await Promise.all([
        fetchCompanyEstimates(companyId),
        fetchCompanyCustomers(companyId) // Fetch customers for display
      ]);
      setEstimates(estimatesData);
      setCustomers(customersData);
    } catch (error: any) {
      console.error("[EstimatesPage] Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not load estimates or customers." });
      setEstimates([]);
      setCustomers([]);
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
  const filteredEstimates = useMemo(() => {
    return estimates.filter(est => {
      const searchLower = searchTerm.toLowerCase();
      const summaryMatch = est.summary.toLowerCase().includes(searchLower);
      const numberMatch = est.estimate_number.toLowerCase().includes(searchLower);
      const customerName = customers.find(c => c.id === est.customer_id)?.name?.toLowerCase() ?? '';
      const customerMatch = customerName.includes(searchLower);
      return summaryMatch || numberMatch || customerMatch;
    });
  }, [estimates, searchTerm, customers]);

  // --- Action Handlers ---
  const handleCreateEstimate = () => {
    if (!canCreate) return;
    router.push('/estimates/new'); // Navigate to the new estimate page
  };

  const handleEditEstimate = (estimateId: string) => {
    if (!canEdit) return;
    router.push(`/estimates/${estimateId}`); // Navigate to the edit estimate page
  };

  const handleDeleteEstimate = async (estimateId: string, estimateNumber: string) => {
    if (!canDelete || !companyId) return;
    setIsSaving(true);
    try {
        await deleteEstimate(companyId, estimateId); // Call Firestore service
        toast({ title: "Estimate Deleted", description: `Estimate ${estimateNumber} deleted.` });
        fetchData(); // Refetch data
    } catch (error: any) {
        console.error("Error deleting estimate:", error);
        toast({ variant: "destructive", title: "Delete Failed", description: error.message || "Could not delete estimate." });
    } finally {
        setIsSaving(false);
    }
  }

  // Helper Functions
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }); // Adjust currency as needed
  };

    const getCustomerName = (customerId: string): string => {
       return customers.find(c => c.id === customerId)?.name ?? 'Loading...';
   }

  const getStatusBadgeVariant = (status: Estimate['status']): "default" | "secondary" | "outline" | "destructive" => {
      switch (status) {
          case 'approved': return 'default'; // Greenish
          case 'sent': return 'secondary'; // Bluish/Greyish
          case 'draft': return 'outline';
          case 'rejected': return 'destructive';
          case 'invoiced': return 'secondary'; // Or maybe a specific color?
          case 'expired': return 'destructive';
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
          <AlertDescription>You do not have permission to view estimates.</AlertDescription>
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
                <DollarSign className="h-6 w-6" /> Estimates / Quotes
              </CardTitle>
              <CardDescription>Create, send, and manage estimates or quotes.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* TODO: Add Filter Button */}
              {/* <Button variant="outline" size="sm" disabled> <Filter className="mr-2 h-4 w-4" /> Filter </Button> */}
              {canCreate && (
                <Button size="sm" onClick={handleCreateEstimate} disabled={loadingData || isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Create Estimate
                </Button>
              )}
            </div>
          </div>
          {/* Search Input */}
          <div className="mt-4">
            <Input
              placeholder="Search by estimate #, summary, customer..."
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
                  <TableHead>Estimate #</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstimates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {estimates.length === 0 ? "No estimates found." : "No estimates match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEstimates.map((est) => (
                    <TableRow key={est.id}>
                      <TableCell className="font-medium">{est.estimate_number}</TableCell>
                      <TableCell className="max-w-xs truncate">{est.summary}</TableCell>
                      <TableCell>{getCustomerName(est.customer_id)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(est.status)} className="capitalize">
                          {est.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(est.total_amount)}</TableCell>
                      <TableCell>{format(new Date(est.created_at), 'PP')}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {canEdit && (
                          <Button variant="outline" size="icon" onClick={() => handleEditEstimate(est.id)} title="Edit Estimate" disabled={isSaving}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" title="Delete Estimate" disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="sr-only">Delete</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete estimate {est.estimate_number}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => handleDeleteEstimate(est.id, est.estimate_number)}
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
          Total Estimates: {filteredEstimates.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        </CardFooter>
      </Card>
    </main>
  );
}
