
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlusCircle, Filter, Edit, Trash2, FileText, Loader2, AlertCircle, Send, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Invoice, InvoiceStatus } from '@/types/invoice';
import type { Customer } from '@/types/customer'; // For customer name display
import { format } from 'date-fns';
// Import REAL Firestore service functions
import { fetchCompanyInvoices, updateInvoiceStatus, deleteInvoice } from '@/services/invoices'; // Use invoice service
import { fetchCompanyCustomers } from '@/services/customers'; // To get customer names


export default function InvoicingPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]); // State for customers
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null); // Track ID being saved/processed
  const [searchTerm, setSearchTerm] = useState('');

  // --- Permission Checks ---
  const canView = !authLoading && hasPermission(user, 'invoicing', 'view');
  const canCreate = !authLoading && hasPermission(user, 'invoicing', 'create');
  const canEdit = !authLoading && hasPermission(user, 'invoicing', 'edit');
  const canVoid = !authLoading && hasPermission(user, 'invoicing', 'delete'); // Using delete permission for voiding
  const canSend = !authLoading && hasPermission(user, 'invoicing', 'send');
  const canRecordPayment = !authLoading && hasPermission(user, 'invoicing', 'process_payment');

  // Fetch Data using Firestore services
  const fetchData = useCallback(async () => {
    if (!companyId || !canView) {
      setLoadingData(false);
      setInvoices([]);
      setCustomers([]);
      return;
    }
    setLoadingData(true);
    console.log(`[InvoicingPage] Fetching data for company: ${companyId}`);
    try {
       const [invoicesData, customersData] = await Promise.all([
            fetchCompanyInvoices(companyId),
            fetchCompanyCustomers(companyId)
       ]);
      setInvoices(invoicesData);
      setCustomers(customersData);
    } catch (error: any) {
      console.error("[InvoicingPage] Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not load invoices or customers." });
      setInvoices([]);
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
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const searchLower = searchTerm.toLowerCase();
      const numberMatch = inv.invoice_number.toLowerCase().includes(searchLower);
      const customerName = customers.find(c => c.id === inv.customer_id)?.name.toLowerCase() ?? '';
      const customerMatch = customerName.includes(searchLower);
      return numberMatch || customerMatch;
    });
  }, [invoices, searchTerm, customers]);

  // --- Action Handlers ---
  const handleCreateInvoice = () => {
    if (!canCreate) return;
    router.push('/invoicing/new');
  };

  const handleEditInvoice = (invoiceId: string) => {
    if (!canEdit) return;
    router.push(`/invoicing/${invoiceId}`);
  };

  const handleVoidInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!canVoid || !companyId || !user?.id) return;
    setIsSaving(invoiceId); // Set loading specific to this invoice
    try {
        await updateInvoiceStatus(companyId, invoiceId, 'void', user.id); // Call Firestore service to void
        toast({ title: "Invoice Voided", description: `Invoice ${invoiceNumber} has been voided.` });
        fetchData(); // Refetch data
    } catch (error: any) {
        console.error("Error voiding invoice:", error);
        toast({ variant: "destructive", title: "Void Failed", description: error.message || "Could not void the invoice." });
    } finally {
        setIsSaving(null); // Clear loading state
    }
  }

  const handleSendInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!canSend || !companyId || !user?.id) return;
     setIsSaving(invoiceId);
     try {
         // --- TODO: Call API/Server Action to send email AND update status ---
         await updateInvoiceStatus(companyId, invoiceId, 'sent', user.id); // Update status first
         // await callSendEmailApi(invoiceId); // Then call email sending API
         await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate sending
         // -----------------------------------------------------------------
         console.log("Sending Invoice:", invoiceId);
         toast({ title: "Invoice Sent (Simulated)", description: `Invoice ${invoiceNumber} marked as sent.` });
         fetchData(); // Refetch data
     } catch (error: any) {
         console.error("Error sending invoice:", error);
         toast({ variant: "destructive", title: "Send Failed", description: error.message || "Could not send the invoice." });
     } finally {
         setIsSaving(null);
     }
  }

    const handleRecordPayment = (invoiceId: string) => {
     if (!canRecordPayment) return;
     // TODO: Open payment recording modal or navigate to payment page
     toast({ title: "Record Payment (WIP)", description: `Modal for recording payment for ${invoiceId} not implemented.` });
  }

  // Helper Functions
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }); // Adjust currency as needed
  };

   const getCustomerName = (customerId: string): string => {
       return customers.find(c => c.id === customerId)?.name ?? 'Loading...';
   }

  const getStatusBadgeVariant = (status: Invoice['status']): "default" | "secondary" | "outline" | "destructive" => {
      switch (status) {
          case 'paid': return 'default'; // Greenish
          case 'sent': return 'secondary'; // Bluish
          case 'partially-paid': return 'secondary'; // Yellowish/Orangish
          case 'overdue': return 'destructive'; // Red
          case 'draft': return 'outline';
          case 'void': return 'destructive'; // Greyish/Reddish strikethrough
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
          <AlertDescription>You do not have permission to view invoices.</AlertDescription>
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
                <FileText className="h-6 w-6" /> Invoicing
              </CardTitle>
              <CardDescription>Generate, track, and manage invoices.</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* TODO: Add Filter Button */}
              {/* <Button variant="outline" size="sm" disabled> <Filter className="mr-2 h-4 w-4" /> Filter </Button> */}
              {canCreate && (
                <Button size="sm" onClick={handleCreateInvoice} disabled={loadingData || !!isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Create Invoice
                </Button>
              )}
            </div>
          </div>
          {/* Search Input */}
          <div className="mt-4">
            <Input
              placeholder="Search by invoice #, customer..."
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
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {invoices.length === 0 ? "No invoices found." : "No invoices match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{getCustomerName(inv.customer_id)}</TableCell>
                      <TableCell>{format(new Date(inv.issue_date), 'PP')}</TableCell>
                      <TableCell>{format(new Date(inv.due_date), 'PP')}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(inv.status)} className={`capitalize ${inv.status === 'void' ? 'line-through' : ''}`}>
                          {inv.status.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(inv.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(inv.amount_due)}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                         {canSend && inv.status === 'draft' && ( // Can only send drafts
                             <Button variant="outline" size="icon" onClick={() => handleSendInvoice(inv.id, inv.invoice_number)} title="Send Invoice" disabled={isSaving === inv.id}>
                                {isSaving === inv.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                                <span className="sr-only">Send</span>
                              </Button>
                         )}
                         {canRecordPayment && (inv.status === 'sent' || inv.status === 'partially-paid' || inv.status === 'overdue') && ( // Can record payment if not paid/void/draft
                             <Button variant="outline" size="icon" onClick={() => handleRecordPayment(inv.id)} title="Record Payment" disabled={!!isSaving}>
                                <CreditCard className="h-4 w-4" /> <span className="sr-only">Record Payment</span>
                              </Button>
                         )}
                        {canEdit && (
                          <Button variant="outline" size="icon" onClick={() => handleEditInvoice(inv.id)} title="Edit Invoice" disabled={!!isSaving || inv.status === 'paid' || inv.status === 'void'}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        {canVoid && ( // Using void permission
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" title="Void Invoice" disabled={!!isSaving || inv.status === 'paid' || inv.status === 'void'}>
                                {isSaving === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="sr-only">Void</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will void invoice {inv.invoice_number}, marking it as uncollectible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={!!isSaving}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => handleVoidInvoice(inv.id, inv.invoice_number)}
                                  disabled={!!isSaving}
                                >
                                  {isSaving === inv.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Void Invoice
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
          Total Invoices: {filteredInvoices.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        </CardFooter>
      </Card>
    </main>
  );
}
