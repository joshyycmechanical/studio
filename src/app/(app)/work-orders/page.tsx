
'use client';

import * as React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { WorkOrderTable } from '@/components/work-orders/WorkOrderTable';
import { WorkOrderListHeader } from '@/components/work-orders/list/WorkOrderListHeader';
import { useWorkOrders } from '@/components/work-orders/list/useWorkOrders';

export default function WorkOrdersListPage() {
  const {
    canView,
    canCreate,
    myWorkOrders,
    availableWorkOrders,
    allOtherWorkOrders,
    isLoading,
    error,
  } = useWorkOrders();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canView) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md"><AlertCircle /><AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to view work orders.</AlertDescription></Alert>
      </main>
    );
  }

  if (error) {
    return <main className="p-4"><Alert variant="destructive"><AlertCircle /><AlertTitle>Error Loading Data</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4">
        <WorkOrderListHeader canCreate={canCreate} />
        <div className="space-y-6">
            <WorkOrderTable workOrders={myWorkOrders} title="My Assigned Work Orders" />
            <WorkOrderTable workOrders={availableWorkOrders} title="Available & Unassigned Jobs" />
            <WorkOrderTable workOrders={allOtherWorkOrders} title="All Other Work Orders" />
        </div>
    </main>
  );
}
