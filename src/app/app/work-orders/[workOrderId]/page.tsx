
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AlertCircle, Edit, CheckCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatEnum, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Import services
import { fetchWorkOrderById, createDeficiency, createRepair, deleteWorkOrder } from '@/services/workOrders';
import { fetchEquipmentByLocationId, createEquipment } from '@/services/equipment';
import { fetchDeficienciesByWorkOrderId } from '@/services/deficiencies';
import { fetchRepairsByWorkOrderId } from '@/services/repairs';

// Import types
import type { WorkOrder } from '@/types/work-order';
import type { Equipment } from '@/types/equipment';
import type { Deficiency } from '@/types/deficiency';
import type { Repair } from '@/types/repair';

// Import custom components
import { DeficiencyManager } from '@/components/work-orders/DeficiencyManager';
import { LogDeficiencyModal } from '@/components/work-orders/LogDeficiencyModal';
import { RepairManager } from '@/components/work-orders/RepairManager';
import { LogRepairModal } from '@/components/work-orders/LogRepairModal';
import { EquipmentManager } from '@/components/work-orders/EquipmentManager';
import { AddEquipmentModal } from '@/components/work-orders/AddEquipmentModal';
import { WorkOrderHeader } from '@/components/work-orders/WorkOrderHeader';

export default function WorkOrderDetailPage() {
    const { workOrderId } = useParams() as { workOrderId: string };
    const { user, companyId, loading: authLoading } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const [isLogDeficiencyOpen, setIsLogDeficiencyOpen] = React.useState(false);
    const [isLogRepairOpen, setIsLogRepairOpen] = React.useState(false);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = React.useState(false);
    const [repairTargetDeficiency, setRepairTargetDeficiency] = React.useState<string | undefined>(undefined);
    
    // Permission checks
    const canView = !authLoading && hasPermission(user, 'work-orders', 'view');
    const canEdit = !authLoading && hasPermission(user, 'work-orders', 'edit');
    const canComplete = !authLoading && hasPermission(user, 'work-orders', 'manage_status');
    const canDelete = !authLoading && hasPermission(user, 'work-orders', 'delete');
    const canLogDeficiency = !authLoading && hasPermission(user, 'deficiencies', 'create');
    const canLogRepair = !authLoading && hasPermission(user, 'repairs', 'create');
    const canAddEquipment = !authLoading && hasPermission(user, 'equipment', 'create');

    const { data: workOrder, isLoading: isLoadingWO, error: errorWO } = useQuery<WorkOrder | null>({
        queryKey: ['workOrder', workOrderId],
        queryFn: () => fetchWorkOrderById(companyId!, workOrderId),
        enabled: !!companyId && canView,
    });
    
    const { data: equipment = [], refetch: refetchEquipment } = useQuery<Equipment[]>({
        queryKey: ['locationEquipment', workOrder?.location_id],
        queryFn: () => fetchEquipmentByLocationId(companyId!, workOrder!.location_id!),
        enabled: !!companyId && !!workOrder?.location_id && canView,
    });

    const { data: deficiencies = [], refetch: refetchDeficiencies } = useQuery<Deficiency[]>({
        queryKey: ['workOrderDeficiencies', workOrderId],
        queryFn: () => fetchDeficienciesByWorkOrderId(companyId!, workOrderId),
        enabled: !!companyId && !!workOrderId && canView,
    });

    const { data: repairs = [] } = useQuery<Repair[]>({
        queryKey: ['workOrderRepairs', workOrderId],
        queryFn: () => fetchRepairsByWorkOrderId(companyId!, workOrderId),
        enabled: !!companyId && !!workOrderId && canView,
    });
    
    const deleteMutation = useMutation({
        mutationFn: () => deleteWorkOrder(companyId!, workOrderId),
        onSuccess: () => {
            toast({ title: 'Success', description: 'Work order deleted successfully.' });
            router.push('/work-orders');
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        },
    });

    if (authLoading || isLoadingWO) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
    }

    if (!canView || !workOrder) {
        return <main className="p-4"><Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle><AlertDescription>Work order not found or you lack permission.</AlertDescription></Alert></main>;
    }
    
    return (
        <main className="bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="container mx-auto py-8 px-4">
                <WorkOrderHeader 
                    workOrder={workOrder} 
                    canEdit={canEdit} 
                    canComplete={canComplete}
                    canDelete={canDelete}
                    onDelete={deleteMutation.mutate}
                    isDeleting={deleteMutation.isPending}
                />

                <div className="mt-8 grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">
                        {/* Other components */}
                    </div>
                </div>
            </div>

            {/* Modals */}
        </main>
    );
}
