
'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import type { WorkOrder } from '@/types/work-order';
import type { UserProfile } from '@/types/user';
import type { Invoice } from '@/types/invoice';
import { fetchCompanyWorkOrders } from '@/services/workOrders';
import { fetchCompanyUsers } from '@/services/users';
import { fetchCompanyInvoices } from '@/services/invoices';
import { ReportsHeader } from '@/components/reports/list/ReportsHeader';
import { WorkOrderVolumeChart } from '@/components/reports/list/WorkOrderVolumeChart';
import { TechnicianPerformanceChart } from '@/components/reports/list/TechnicianPerformanceChart';
import { RevenueChart } from '@/components/reports/list/RevenueChart';
import { startOfYear } from 'date-fns';

export default function ReportsPage() {
    const { user, companyId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [loadingData, setLoadingData] = React.useState(true);
    const [dateRange, setDateRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
        from: startOfYear(new Date()),
        to: new Date(),
    });

    const canViewReports = !authLoading && hasPermission(user, 'reports', 'view');
    const canGenerateReports = !authLoading && hasPermission(user, 'reports', 'generate');

    React.useEffect(() => {
        if (authLoading || !companyId || !canViewReports) {
             setLoadingData(false);
             setWorkOrders([]);
             setUsers([]);
             setInvoices([]);
            return;
        }

        const fetchData = async () => {
            setLoadingData(true);
            try {
                 const [fetchedWorkOrders, fetchedUsers, fetchedInvoices] = await Promise.all([
                    fetchCompanyWorkOrders(companyId),
                    fetchCompanyUsers(companyId),
                    fetchCompanyInvoices(companyId)
                 ]);
                setWorkOrders(fetchedWorkOrders);
                setUsers(fetchedUsers);
                setInvoices(fetchedInvoices);
            } catch (error: any) {
                toast({ variant: "destructive", title: "Error", description: "Could not load report data." });
                 setWorkOrders([]);
                 setUsers([]);
                 setInvoices([]);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
     }, [companyId, authLoading, canViewReports, toast]);

     const workOrdersInDateRange = React.useMemo(() => {
        if (!dateRange.from || !dateRange.to) return workOrders;

         const startTime = dateRange.from.getTime();
         const endTime = dateRange.to.setHours(23, 59, 59, 999);

         return workOrders.filter(wo => {
             const woDate = wo.created_at instanceof Date ? wo.created_at : wo.created_at?.toDate();
             if (!woDate) return false;
             const woTime = woDate.getTime();
             return woTime >= startTime && woTime <= endTime;
         });
     }, [workOrders, dateRange]);
     
     const invoicesInDateRange = React.useMemo(() => {
        if (!dateRange.from || !dateRange.to) return invoices;

         const startTime = dateRange.from.getTime();
         const endTime = dateRange.to.setHours(23, 59, 59, 999);

         return invoices.filter(inv => {
             const invDate = inv.issue_date instanceof Date ? inv.issue_date : new Date(inv.issue_date);
             if (!invDate) return false;
             const invTime = invDate.getTime();
             return invTime >= startTime && invTime <= endTime;
         });
     }, [invoices, dateRange]);

    const handleExport = () => {
        alert('Exporting not implemented yet.');
    }

     if (authLoading) {
         return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
     }
     if (!canViewReports) {
         return <div className="p-4">Access Denied: You do not have permission to view reports.</div>;
     }

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <ReportsHeader
                dateRange={dateRange}
                onDateChange={setDateRange}
                onExport={handleExport}
                canGenerateReports={canGenerateReports}
                loadingData={loadingData}
            />
            {loadingData ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                    <WorkOrderVolumeChart workOrders={workOrdersInDateRange} dateRange={dateRange} />
                    <TechnicianPerformanceChart workOrders={workOrdersInDateRange} users={users} />
                    <div className="lg:col-span-2">
                        <RevenueChart invoices={invoicesInDateRange} dateRange={dateRange} />
                    </div>
                </div>
            )}
        </main>
    );
}
