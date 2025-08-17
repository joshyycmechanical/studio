
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download, CreditCard } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/types/invoice'; // Import types
import { format } from 'date-fns';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { fetchCompanyInvoices } from '@/services/portal';

export default function PortalInvoicesPage() {
    const { customerUser, loading: authLoading } = usePortalAuth();
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
         if (authLoading || !customerUser?.companyId || !customerUser.customerId) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const invoiceData = await fetchCompanyInvoices(customerUser.companyId, customerUser.customerId);
                setInvoices(invoiceData);
            } catch (err) {
                 console.error("Error fetching portal invoices data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authLoading, customerUser]);

    const formatCurrency = (amount: number): string => {
        return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    };

    const getStatusBadgeVariant = (status: InvoiceStatus): "default" | "secondary" | "outline" | "destructive" => {
        switch (status) {
            case 'paid': return 'default';
            case 'sent': return 'secondary';
            case 'partially-paid': return 'secondary';
            case 'overdue': return 'destructive';
            case 'draft': return 'outline';
            case 'void': return 'destructive';
            default: return 'outline';
        }
    };

    const handleDownloadPdf = (invoiceId: string) => {
        console.log("Download PDF for:", invoiceId);
        alert("PDF download not implemented yet.");
    }

    const handleMakePayment = (invoiceId: string, amountDue: number) => {
         console.log("Make payment for:", invoiceId, "Amount:", amountDue);
         alert(`Payment gateway integration for ${formatCurrency(amountDue)} not implemented yet.`);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Invoices
                </CardTitle>
                <CardDescription>View and manage your invoices.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Issue Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Amount Due</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.filter(inv => inv.status !== 'draft' && inv.status !== 'void').map((inv) => (
                                    <TableRow key={inv.id}>
                                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                                        <TableCell>{format(new Date(inv.issue_date), 'PP')}</TableCell>
                                        <TableCell>{format(new Date(inv.due_date), 'PP')}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(inv.status)} className="capitalize">
                                                {inv.status.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{formatCurrency(inv.total_amount)}</TableCell>
                                        <TableCell>{formatCurrency(inv.amount_due)}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                             <Button variant="outline" size="icon" onClick={() => handleDownloadPdf(inv.id)} title="Download PDF">
                                                <Download className="h-4 w-4" />
                                                <span className="sr-only">Download PDF</span>
                                            </Button>
                                             {inv.amount_due > 0 && ['sent', 'partially-paid', 'overdue'].includes(inv.status) && (
                                                <Button variant="default" size="icon" onClick={() => handleMakePayment(inv.id, inv.amount_due)} title="Make Payment">
                                                    <CreditCard className="h-4 w-4" />
                                                    <span className="sr-only">Make Payment</span>
                                                </Button>
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
                Showing {invoices.filter(inv => inv.status !== 'draft' && inv.status !== 'void').length} invoices.
            </CardFooter>
        </Card>
    );
}
