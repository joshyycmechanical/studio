
import { useDroppable } from '@dnd-kit/core';
import type { WorkOrder } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import type { UserProfileWithRoles } from '@/types/user';
import { DraggableWorkOrderEvent } from './DraggableWorkOrderEvent';
import { isSameDay } from 'date-fns';

export const TechnicianDayColumn = ({ date, technician, workOrders, customers }: { date: Date; technician: Partial<UserProfileWithRoles>; workOrders: WorkOrder[]; customers: Customer[] }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `droppable-${technician.id}-${date.toISOString().split('T')[0]}`,
        data: { type: 'technician-column', technicianId: technician.id, date },
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const techniciansWorkOrders = workOrders.filter(wo => wo.assigned_technician_id === technician.id && wo.scheduled_date && isSameDay(new Date(wo.scheduled_date), date));

    return (
        <div ref={setNodeRef} className="min-w-[200px] flex-1 relative border-r">
            <div className="text-center py-2 border-b sticky top-0 bg-background z-10">{technician.full_name}</div>
            <div className="relative">
                {hours.map(hour => (
                    <div key={hour} className="h-[60px] border-b" />
                ))}
                {techniciansWorkOrders.map(wo => (
                    <DraggableWorkOrderEvent key={wo.id} workOrder={wo} customer={customers.find(c => c.id === wo.customer_id)} />
                ))}
                {isOver && <div className="absolute inset-0 bg-primary/20 rounded-md" />}
            </div>
        </div>
    );
};
