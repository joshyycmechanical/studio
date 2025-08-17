
'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { useNewWorkOrder } from '@/components/work-orders/new/useNewWorkOrder';
import { WorkOrderForm } from '@/components/work-orders/new/WorkOrderForm';
import { FormProvider } from 'react-hook-form';
import { Button } from '@/components/ui/button';

function NewWorkOrderPageContent() {
  const {
    router,
    authLoading,
    canCreateWorkOrders,
    onSubmit,
    isSubmitting,
    loadingDropdowns,
    customers,
    filteredLocations,
    technicians,
    customerForm,
    handleCreateNewCustomer,
    isCustomerDialogOpen,
    setIsCustomerDialogOpen,
    isSubmittingCustomer,
    workOrderForm // Get the form instance from the hook
  } = useNewWorkOrder();
  
  const isLoading = authLoading || loadingDropdowns;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateWorkOrders) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to create new work orders.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <FormProvider {...workOrderForm}>
        <WorkOrderForm
          onSubmit={workOrderForm.handleSubmit(onSubmit)}
          isSubmitting={isSubmitting}
          isLoading={isLoading}
          dropdownData={{
            customers,
            locations: filteredLocations,
            equipment: [],
            technicians: technicians,
          }}
          customerFormProps={{
              customerForm: customerForm,
              handleCreateNewCustomer: handleCreateNewCustomer,
              isCustomerDialogOpen: isCustomerDialogOpen,
              setIsCustomerDialogOpen: setIsCustomerDialogOpen,
              isSubmittingCustomer: isSubmittingCustomer,
          }}
          router={router}
        />
      </FormProvider>
    </main>
  );
}

export default function NewWorkOrderPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <NewWorkOrderPageContent />
        </Suspense>
    );
}

