
'use client';

import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Edit, CheckCheck, Play, User, Coffee, LogOut, MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from './utils';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { useUserActions } from '@/hooks/useUserActions';

export const WorkOrderHeader = ({ workOrder, canDelete, onDelete, isDeleting }: any) => {
    const router = useRouter();
    const { user } = useAuth();
    const { handleClockIn, handleClockOut, handleUpdateStatus, isActionLoading } = useUserActions(workOrder.id);
    const canEdit = hasPermission(user, 'work-orders', 'edit');
    const canComplete = hasPermission(user, 'work-orders', 'manage_status');

    return (
        <div className="flex flex-wrap items-center gap-4">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}><ArrowLeft className="h-4"/></Button>
            <div>
                <p className="text-sm text-muted-foreground">Work Order</p>
                <h1 className="text-2xl font-bold truncate">{workOrder.work_order_number}: {workOrder.summary}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
                {workOrder.status === 'scheduled' && (
                    <Button onClick={() => handleClockIn()} disabled={isActionLoading}>
                        <Play className="mr-2 h-4 w-4"/> Clock In & Start Job
                    </Button>
                )}
                 {workOrder.status === 'in-progress' && (
                    <Button variant="destructive" onClick={() => handleClockOut()} disabled={isActionLoading}>
                        <LogOut className="mr-2 h-4 w-4"/> Clock Out & End Job
                    </Button>
                )}
                {canComplete && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
                    <Button variant="secondary" asChild><Link href={`/work-orders/${workOrder.id}/complete`}><CheckCheck className="mr-2 h-4"/>Complete Job</Link></Button>
                )}
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                         {canEdit && <DropdownMenuItem onSelect={() => router.push(`/work-orders/${workOrder.id}/edit`)}><Edit className="mr-2 h-4 w-4"/> Edit Details</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => handleUpdateStatus('on-hold')} disabled={workOrder.status === 'on-hold'}><Coffee className="mr-2 h-4 w-4"/> Place On Hold</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleUpdateStatus('scheduled')} disabled={!['on-hold', 'in-progress'].includes(workOrder.status)}><User className="mr-2 h-4 w-4"/> Back to Scheduled</DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
            </div>
        </div>
    );
};
