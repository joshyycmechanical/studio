
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { WorkOrder } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import { getPriorityClasses } from './utils';
import { eachDayOfInterval, startOfWeek, endOfWeek, format, isSameDay } from 'date-fns';
import { useDraggable } from '@dnd-kit/core';

const WeekViewWorkOrderCard = ({ wo, customer }: { wo: WorkOrder; customer?: Customer }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `scheduled-${wo.id}`,
        data: { workOrder: wo, type: 'scheduled' },
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <Card className={`p-2 shadow-sm border-l-4 cursor-grab ${getPriorityClasses(wo.priority)}`}>
                <p className="text-xs font-bold truncate">{wo.summary}</p>
                <p className="text-xs text-muted-foreground">{wo.work_order_number}</p>
            </Card>
        </div>
    );
};

export const WeekView = ({ currentDate, workOrders, customers }: any) => {
    const weekDays = eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) });

    return (
        <div className="flex flex-1 overflow-auto border-t">
            {weekDays.map(day => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const { setNodeRef, isOver } = useDroppable({
                    id: `droppable-week-day-${dayKey}`,
                    data: { type: 'week-day-column', date: day }
                });

                return (
                    <div ref={setNodeRef} key={day.toISOString()} className={cn("flex-1 min-w-[200px] border-r", isOver && "bg-primary/20")}>
                        <div className="text-center py-2 border-b font-semibold">{format(day, 'EEE d')}</div>
                        <ScrollArea className="h-full p-2">
                            <div className="space-y-2">
                                {workOrders
                                    .filter((wo: WorkOrder) => wo.scheduled_date && isSameDay(new Date(wo.scheduled_date), day))
                                    .map((wo: WorkOrder) => (
                                        <WeekViewWorkOrderCard
                                            key={wo.id}
                                            wo={wo}
                                            customer={customers.find((c: Customer) => c.id === wo.customer_id)}
                                        />
                                    ))
                                }
                            </div>
                        </ScrollArea>
                    </div>
                )
            })}
        </div>
    )
};
