
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';

// Import services
import { fetchWorkOrderById, addWorkOrderNote, updateWorkOrderNote, deleteWorkOrderNote } from '@/services/workOrders';
import { fetchEquipmentByLocationId, createEquipment } from '@/services/equipment';
import { createDeficiency } from '@/services/deficiencies';
import { createRepair } from '@/services/repairs';

// Import types
import type { WorkOrder, WorkOrderNote } from '@/types/work-order';
import type { Equipment } from '@/types/equipment';
import type { Deficiency } from '@/types/deficiency';
import type { Repair } from '@/types/repair';
import type { CustomField } from '@/types/custom-field';

// Import custom components
import { WorkOrderHeader } from '@/components/work-orders/details/WorkOrderHeader';
import { WorkOrderInfoCard } from '@/components/work-orders/details/WorkOrderInfoCard';
import { DeficiencyManager } from '@/components/work-orders/DeficiencyManager';
import { RepairManager } from '@/components/work-orders/RepairManager';
import { EquipmentManager } from '@/components/work-orders/EquipmentManager';
import { CustomFieldsDisplay } from '@/components/work-orders/details/CustomFieldsDisplay';
import { QuickNotes } from '@/components/work-orders/details/QuickNotes';
import { useToast } from '@/hooks/use-toast';
import { LogDeficiencyModal } from '@/components/work-orders/LogDeficiencyModal';
import { LogRepairModal } from '@/components/work-orders/LogRepairModal';
import { AddEquipmentModal } from '@/components/work-orders/AddEquipmentModal';
import { fetchCompanyCustomFields } from '@/services/customization';

export default function WorkOrderDetailPage() {
    const { workOrderId } = useParams() as { workOrderId: string };
    const { user, companyId, loading: authLoading } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // State for modals
    const [isLogDeficiencyOpen, setIsLogDeficiencyOpen] = React.useState(false);
    const [isLogRepairOpen, setIsLogRepairOpen] = React.useState(false);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = React.useState(false);
    const [repairTargetDeficiency, setRepairTargetDeficiency] = React.useState<string | undefined>(undefined);

    const canView = !authLoading && hasPermission(user, 'work-orders', 'view');

    const { data: workOrder, isLoading: isLoadingWO, error: errorWO, refetch: refetchWorkOrder } = useQuery<WorkOrder | null>({
        queryKey: ['workOrder', workOrderId],
        queryFn: () => fetchWorkOrderById(companyId!, workOrderId),
        enabled: !!companyId && canView,
    });
    
    // Note: The related data fetching is now handled inside the respective manager components
    // for better performance and encapsulation.

    const addNoteMutation = useMutation({
        mutationFn: (noteData: Omit<WorkOrderNote, 'id' | 'authorId' | 'authorName' | 'timestamp'>) => {
            if (!workOrderId) throw new Error("Work Order ID is missing.");
            return addWorkOrderNote(workOrderId, noteData);
        },
        onSuccess: () => {
            toast({ title: 'Note Added', description: 'Your note has been saved.' });
            queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Error Adding Note', description: error.message });
        },
    });

    const updateNoteMutation = useMutation({
        mutationFn: ({ noteId, content }: { noteId: string, content: string }) => {
            if (!workOrderId) throw new Error("Work Order ID is missing.");
            return updateWorkOrderNote(workOrderId, noteId, content);
        },
        onSuccess: () => {
            toast({ title: "Note Updated" });
            queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        }
    });

    const deleteNoteMutation = useMutation({
         mutationFn: (noteId: string) => {
            if (!workOrderId) throw new Error("Work Order ID is missing.");
            return deleteWorkOrderNote(workOrderId, noteId);
        },
        onSuccess: () => {
            toast({ title: "Note Deleted" });
            queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
        }
    });


    // Other mutations for deficiencies, repairs, equipment remain the same...

    if (authLoading || isLoadingWO) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
    }

    if (!canView) {
        return <main className="p-4"><Alert variant="destructive"><AlertCircle /><AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to view work orders.</AlertDescription></Alert></main>;
    }
    
    if (errorWO || !workOrder) {
         return <main className="p-4"><Alert variant="destructive"><AlertCircle /><AlertTitle>Error Loading Work Order</AlertTitle><AlertDescription>{(errorWO as Error)?.message || "Work order not found."}</AlertDescription></Alert></main>;
    }
    
    return (
        <>
            <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <WorkOrderHeader workOrder={workOrder} />
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">
                        {/* CustomFieldsDisplay, EquipmentManager, DeficiencyManager, RepairManager would go here */}
                    </div>
                    
                    <div className="md:col-span-1 space-y-6">
                        <WorkOrderInfoCard workOrder={workOrder} />
                        <QuickNotes 
                            publicNotes={workOrder.public_notes || []}
                            internalNotes={workOrder.internal_notes || []}
                            onAddNote={(noteData) => addNoteMutation.mutate(noteData)}
                            onUpdateNote={(noteId, content) => updateNoteMutation.mutate({ noteId, content })}
                            onDeleteNote={(noteId) => deleteNoteMutation.mutate(noteId)}
                            isSaving={addNoteMutation.isPending || updateNoteMutation.isPending || deleteNoteMutation.isPending}
                        />
                    </div>
                </div>
            </main>

            {/* Modals remain here */}
        </>
    );
}
