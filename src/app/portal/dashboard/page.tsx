
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Briefcase, Wrench, FileText, Loader2 } from 'lucide-react';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { fetchCompanyWorkOrders, fetchCompanyInvoices, fetchCompanyEquipment } from '@/services/portal';
import type { WorkOrder } from '@/types/work-order';
import type { Invoice } from '@/types/invoice';
import type { Equipment } from '@/types/equipment';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function PortalDashboardPage() {
    const { customerUser, loading: authLoading } = usePortalAuth();
    const [data, setData] = React.useState<{
        workOrders: WorkOrder[];
        invoices: Invoice[];
        equipment: Equipment[];
    } | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (authLoading || !customerUser?.companyId || !customerUser.customerId) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [woData, invData, eqData] = await Promise.all([
                    fetchCompanyWorkOrders(customerUser.companyId, customerUser.customerId),
                    fetchCompanyInvoices(customerUser.companyId, customerUser.customerId),
                    fetchCompanyEquipment(customerUser.companyId, customerUser.customerId),
                ]);
                setData({
                    workOrders: woData,
                    invoices: invData,
                    equipment: eqData,
                });
            } catch (err: any) {
                setError(err.message || "Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authLoading, customerUser]);

    const openWorkOrders = data?.workOrders.filter(wo => !['completed', 'cancelled', 'invoiced'].includes(wo.status)).length ?? 0;
    const dueInvoices = data?.invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'partially-paid').length ?? 0;
    const equipmentCount = data?.equipment.length ?? 0;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
     if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Dashboard</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }


    return (
        <div>
            <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open Work Orders</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{openWorkOrders}</div>
                        <p className="text-xs text-muted-foreground">View your active service requests</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Your Equipment</CardTitle>
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{equipmentCount}</div>
                        <p className="text-xs text-muted-foreground">Track service history for your assets</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Invoices Due</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dueInvoices}</div>
                        <p className="text-xs text-muted-foreground">View and manage your invoices</p>
                    </CardContent>
                </Card>
            </div>
             {/* Placeholder for more content */}
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Overview of recent service updates.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Recent activity feed will go here...</p>
                </CardContent>
            </Card>
        </div>
    );
}
