
import { useCallback } from 'react';
import { DragEndEvent } from '@d-kit/core';
import { getHours, getMinutes, isSameDay } from 'date-fns';
import type { WorkOrder } from '@/types/work-order';

const HOUR_HEIGHT_IN_PX = 60;
const SNAP_GRID_MINUTES = 15;

export const useSchedulingDnD = (updateMutation: any) => {
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const workOrder = active.data.current?.workOrder as WorkOrder;
        if (!workOrder) return;

        const targetData = over.data.current as { type: string, technicianId?: string, date?: Date };

        if (targetData.type === 'technician-column' && targetData.technicianId && targetData.date) {
            const dropY = event.delta.y + (active.data.current?.type === 'scheduled' ? (getHours(new Date(workOrder.scheduled_date!)) + getMinutes(new Date(workOrder.scheduled_date!)) / 60) * HOUR_HEIGHT_IN_PX : event.client?.y || 0);
            const rawHour = dropY / HOUR_HEIGHT_IN_PX;
            const snappedMinute = Math.round((rawHour * 60) / SNAP_GRID_MINUTES) * SNAP_GRID_MINUTES;
            const hour = Math.floor(snappedMinute / 60);
            const minute = snappedMinute % 60;

            const newScheduledDate = new Date(targetData.date);
            newScheduledDate.setHours(hour, minute, 0, 0);

            updateMutation.mutate({
                workOrderId: workOrder.id,
                updates: {
                    assigned_technician_id: targetData.technicianId,
                    scheduled_date: newScheduledDate,
                    status: 'scheduled',
                }
            });
        } else if (targetData.type === 'week-day-column' && targetData.date) {
            const newDate = new Date(targetData.date);
            const originalTime = workOrder.scheduled_date ? new Date(workOrder.scheduled_date) : new Date();
            newDate.setHours(workOrder.scheduled_date ? getHours(originalTime) : 8, workOrder.scheduled_date ? getMinutes(originalTime) : 0, 0, 0);

            if (workOrder.scheduled_date && isSameDay(new Date(workOrder.scheduled_date), newDate)) return;

            updateMutation.mutate({
                workOrderId: workOrder.id,
                updates: { scheduled_date: newDate, status: 'scheduled' }
            });
        }
    }, [updateMutation]);

    return { handleDragEnd };
}
