
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { clockIn, clockOut } from '@/services/user-actions';
import { updateWorkOrder } from '@/services/workOrders';
import type { WorkOrderStatus } from '@/types/work-order';

export const useUserActions = (workOrderId: string) => {
    const { companyId, fetchUserProfile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
        queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
        fetchUserProfile(); // Refetch user profile to update active timer status globally
    };

    const clockInMutation = useMutation({
        mutationFn: () => clockIn(workOrderId),
        onSuccess: () => {
            toast({ title: 'Clocked In', description: 'Your timesheet has started.' });
            invalidateQueries();
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Clock In Failed', description: error.message });
        }
    });

    const clockOutMutation = useMutation({
        mutationFn: (notes?: string) => clockOut(notes),
        onSuccess: () => {
            toast({ title: 'Clocked Out', description: 'Your time entry has been saved.' });
            invalidateQueries();
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Clock Out Failed', description: error.message });
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: (status: WorkOrderStatus) => updateWorkOrder(companyId!, workOrderId, { status }),
        onSuccess: (_, status) => {
            toast({ title: 'Status Updated', description: `Work order status changed to ${status}.` });
            invalidateQueries();
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Status Update Failed', description: error.message });
        }
    });

    return {
        handleClockIn: () => clockInMutation.mutate(),
        handleClockOut: (notes?: string) => clockOutMutation.mutate(notes),
        handleUpdateStatus: (status: WorkOrderStatus) => updateStatusMutation.mutate(status),
        isActionLoading: clockInMutation.isPending || clockOutMutation.isPending || updateStatusMutation.isPending,
    };
};
