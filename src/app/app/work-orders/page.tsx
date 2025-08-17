
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, AlertCircle, Briefcase } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { WorkOrder } from '@/types/work-order';
import { fetchCompanyWorkOrders } from '@/services/workOrders';
import { fetchCompanyCustomers } from '@/services/customers';
import { WorkOrderTable } from '@/components/work-orders/WorkOrderTable';

export default function WorkOrdersListPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const canView = !authLoading && hasPermission(user, 'work-orders', 'view');
  const canCreate = !authLoading && hasPermission(user, 'work-orders', 'create');

  const { data: workOrders = [], isLoading: isLoadingWOs, error: errorWOs } = useQuery<WorkOrder[]>({
    queryKey: ['workOrders', companyId],
    queryFn: () => fetchCompanyWorkOrders(),
    enabled: !!companyId && canView,
  });

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery<any[]>({
    queryKey: ['customers', companyId],
    queryFn: () => fetchCompanyCustomers(companyId!),
    enabled: !!companyId && canView,
  });
  
  const workOrdersWithCustomer = React.useMemo(() => {
    return workOrders.map(wo => ({
      ...wo,
      customer_name: customers.find(c => c.id === wo.customer_id)?.name || 'N/A',
    }));
  }, [workOrders, customers]);

  if (authLoading || isLoadingWOs || isLoadingCustomers) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canView) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md"><AlertCircle /><AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to view work orders.</AlertDescription></Alert>
      </main>
    );
  }

  if (errorWOs) {
    return <main className="p-4"><Alert variant="destructive"><AlertCircle /><AlertTitle>Error Loading Data</AlertTitle><AlertDescription>{(errorWOs as Error).message}</AlertDescription></Alert></main>;
  }
  
  const myWorkOrders = workOrdersWithCustomer.filter(wo => wo.assigned_technician_id === user?.id);
  const availableWorkOrders = workOrdersWithCustomer.filter(wo => !wo.assigned_technician_id);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="h-6 w-6"/> Work Orders</h1>
                <p className="text-muted-foreground">Manage all work orders for your company.</p>
            </div>
            {canCreate && <Button onClick={() => router.push('/work-orders/new')}><PlusCircle className="mr-2 h-4"/> New Work Order</Button>}
        </div>

        <div className="space-y-6">
            <WorkOrderTable workOrders={myWorkOrders} title="My Assigned Work Orders" showActions={true} />
            <WorkOrderTable workOrders={availableWorkOrders} title="Available Work Orders" showActions={true} />
        </div>
    </main>
  );
}
