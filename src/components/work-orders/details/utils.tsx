'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkOrderStatus } from '@/types/work-order';

export const DetailItem = ({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) => (
    <div className="flex flex-col">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-base font-semibold">{value || children || 'N/A'}</span>
    </div>
);

export const StatusBadge = ({ status }: { status: WorkOrderStatus }) => {
    const statusClasses: { [key in WorkOrderStatus]: string } = {
        'new': 'bg-blue-500 hover:bg-blue-500/80',
        'scheduled': 'bg-yellow-500 hover:bg-yellow-500/80',
        'in-progress': 'bg-orange-500 hover:bg-orange-500/80',
        'on-hold': 'bg-gray-500 hover:bg-gray-500/80',
        'completed': 'bg-green-500 hover:bg-green-500/80',
        'invoiced': 'bg-purple-500 hover:bg-purple-500/80',
        'cancelled': 'bg-red-500 hover:bg-red-500/80',
        'traveling': 'bg-indigo-500 hover:bg-indigo-500/80', // Example color
    };
    return <Badge className={cn('text-white capitalize', statusClasses[status])}>{status.replace('-', ' ')}</Badge>;
};
