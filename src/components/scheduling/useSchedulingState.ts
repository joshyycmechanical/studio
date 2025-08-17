
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { hasPermission } from '@/lib/permissions';
import { fetchCompanyWorkOrders, updateWorkOrder } from '@/services/workOrders';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyUsers } from '@/services/users';
import type { WorkOrder } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import type { UserProfileWithRoles } from '@/types/user';

export const useSchedulingState = () => {
    const { user: currentUser, loading: authLoading, companyId } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [view, setView] = useState<'day' | 'week' | 'month' | 'list'>('day');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedTechnicians, setSelectedTechnicians] = useState<Set<string>>(new Set());

    const canView = !authLoading && hasPermission(currentUser, 'scheduling', 'view');

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

    const { data: technicians = [], isLoading: isLoadingTechs } = useQuery<Partial<UserProfileWithRoles>[]>({
        queryKey: ['technicians', companyId],
        queryFn: () => fetchCompanyUsers(companyId!),
        enabled: !!companyId && canView,
    });
    
    const displayedTechnicians = useMemo(() => {
        if (selectedTechnicians.size === 0) return technicians;
        return technicians.filter(t => selectedTechnicians.has(t.id!));
    }, [technicians, selectedTechnicians]);

    const unscheduledWorkOrders = useMemo(() => {
        return workOrders.filter(wo => !wo.assigned_technician_id && (wo.status === 'new' || wo.status === 'on-hold'));
    }, [workOrders]);

    const updateMutation = useMutation({
        mutationFn: (data: { workOrderId: string, updates: Partial<WorkOrder> }) => {
            if (!companyId) throw new Error("Company ID not found.");
            return updateWorkOrder(companyId, data.workOrderId, data.updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
            toast({ title: "Schedule Updated" });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        }
    });
    
    return {
        view,
        setView,
        currentDate,
        setCurrentDate,
        selectedTechnicians,
        setSelectedTechnicians,
        canView,
        workOrders,
        customers,
        technicians,
        displayedTechnicians,
        unscheduledWorkOrders,
        isLoading: authLoading || isLoadingWOs || isLoadingCustomers || isLoadingTechs,
        error: errorWOs,
        updateMutation
    }
};
