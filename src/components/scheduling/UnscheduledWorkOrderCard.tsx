
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import type { WorkOrder } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import { getPriorityClasses } from './utils';

export const UnscheduledWorkOrderCard = ({ wo, customer }: { wo: WorkOrder; customer?: Customer }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `unscheduled-${wo.id}`,
        data: { workOrder: wo, type: 'unscheduled', duration: wo.estimated_duration_hours ?? 1 },
    });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10, position: 'relative' } : undefined;

    return (
        <Card ref={setNodeRef} style={style} {...listeners} {...attributes} className={`p-2 mb-2 cursor-grab shadow-sm hover:shadow-md border-l-4 ${getPriorityClasses(wo.priority)}`}>
            <p className="font-semibold text-sm truncate">{wo.work_order_number}: {wo.summary}</p>
            <p className="text-xs text-muted-foreground truncate">{customer?.name ?? 'Loading customer...'}</p>
        </Card>
    );
};
