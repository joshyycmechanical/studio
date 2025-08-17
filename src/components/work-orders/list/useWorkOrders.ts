
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { fetchCompanyWorkOrders } from '@/services/workOrders';
import { fetchCompanyCustomers } from '@/services/customers';
import type { WorkOrder } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import { useMemo } from 'react';

export const useWorkOrders = () => {
    const { user, companyId, loading: authLoading } = useAuth();
    
    const canView = !authLoading && hasPermission(user, 'work-orders', 'view');
    const canCreate = !authLoading && hasPermission(user, 'work-orders', 'create');

    const { data: workOrders = [], isLoading: isLoadingWOs, error: errorWOs } = useQuery<WorkOrder[]>({
        queryKey: ['workOrders', companyId],
        queryFn: () => fetchCompanyWorkOrders(),
        enabled: !!companyId && canView,
    });

    const { data: customers = [], isLoading: isLoadingCustomers } = useQuery<Customer[]>({
        queryKey: ['customers', companyId],
        queryFn: () => fetchCompanyCustomers(companyId!),
        enabled: !!companyId && canView,
    });
    
    const workOrdersWithCustomer = useMemo(() => {
        if (!workOrders || !customers) return [];
        return workOrders.map(wo => ({
            ...wo,
            customer_name: customers.find(c => c.id === wo.customer_id)?.name || 'N/A',
        }));
    }, [workOrders, customers]);

    const myWorkOrders = useMemo(() => {
        return workOrdersWithCustomer.filter(wo => wo.assigned_technician_id === user?.id && !['completed', 'invoiced', 'cancelled'].includes(wo.status));
    }, [workOrdersWithCustomer, user]);

    const availableWorkOrders = useMemo(() => {
        return workOrdersWithCustomer.filter(wo => !wo.assigned_technician_id && wo.status === 'new');
    }, [workOrdersWithCustomer]);

    const allOtherWorkOrders = useMemo(() => {
        return workOrdersWithCustomer.filter(wo => !myWorkOrders.includes(wo) && !availableWorkOrders.includes(wo));
    }, [workOrdersWithCustomer, myWorkOrders, availableWorkOrders]);

    return {
        canView,
        canCreate,
        myWorkOrders,
        availableWorkOrders,
        allOtherWorkOrders,
        isLoading: authLoading || isLoadingWOs || isLoadingCustomers,
        error: errorWOs
    }
}
