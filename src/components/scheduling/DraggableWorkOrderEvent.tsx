
import { useDraggable } from '@dnd-kit/core';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Users, MapPin, Info } from 'lucide-react';
import Link from 'next/link';
import type { WorkOrder } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import { getPriorityClasses } from './utils';
import { getHours, getMinutes } from 'date-fns';

const HOUR_HEIGHT_IN_PX = 60;

export const DraggableWorkOrderEvent = ({ workOrder, customer }: { workOrder: WorkOrder; customer?: Customer }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `scheduled-${workOrder.id}`,
        data: { workOrder, type: 'scheduled', duration: workOrder.estimated_duration_hours ?? 1 },
    });

    if (!workOrder.scheduled_date) return null;

    const scheduledDate = new Date(workOrder.scheduled_date);
    const top = (getHours(scheduledDate) + getMinutes(scheduledDate) / 60) * HOUR_HEIGHT_IN_PX;
    const height = Math.max((workOrder.estimated_duration_hours ?? 1) * HOUR_HEIGHT_IN_PX, HOUR_HEIGHT_IN_PX / 2);

    const style: React.CSSProperties = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 10,
        position: 'relative',
        height: `${height}px`,
    } : {
        position: 'absolute',
        top: `${top}px`,
        height: `${height}px`,
        left: '0.5rem',
        right: '0.5rem',
        marginLeft: '4rem',
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`p-2 rounded-lg shadow-md cursor-grab transition-opacity flex flex-col justify-between ${isDragging ? 'opacity-50' : ''} ${getPriorityClasses(workOrder.priority)}`}>
                    <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate">{workOrder.work_order_number}: {workOrder.summary}</p>
                        <p className="text-xs truncate">{customer?.name}</p>
                    </div>
                    <div className="w-full h-1.5 bg-background/50 cursor-ns-resize rounded-b-md self-center mt-1" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="right" align="start">
                <div className="space-y-2 text-sm">
                    <p className="font-bold">{workOrder.summary}</p>
                    <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span>{customer?.name}</span></div>
                    <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /><span>{workOrder.location_name}</span></div>
                    <Separator/>
                    <p className="text-muted-foreground">{workOrder.description}</p>
                    <Button size="sm" asChild className="w-full mt-2"><Link href={`/work-orders/${workOrder.id}`}><Info className="mr-2 h-4 w-4"/> View Full Details</Link></Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};
