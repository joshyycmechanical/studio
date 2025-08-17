
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { WorkOrder } from '@/types/work-order';
import { eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, isSameMonth } from 'date-fns';
import { getPriorityClasses } from './utils';

export const MonthView = ({ currentDate, workOrders, onDayClick }: any) => {
    const startOfMonthDay = startOfMonth(currentDate);
    const endOfMonthDay = endOfMonth(currentDate);
    const startDate = startOfWeek(startOfMonthDay, { weekStartsOn: 1 });
    const endDate = endOfWeek(endOfMonthDay, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const groupedWorkOrders = useMemo(() => {
        const map = new Map<string, WorkOrder[]>();
        workOrders.forEach((wo: WorkOrder) => {
            if (wo.scheduled_date) {
                const dayKey = format(new Date(wo.scheduled_date), 'yyyy-MM-dd');
                if (!map.has(dayKey)) map.set(dayKey, []);
                map.get(dayKey)!.push(wo);
            }
        });
        return map;
    }, [workOrders]);

    return (
        <div className="flex-1 grid grid-cols-7 border-t border-r">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center font-semibold py-2 border-b">{day}</div>
            ))}
            {days.map(day => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const wosForDay = groupedWorkOrders.get(dayKey) || [];
                return (
                    <div key={dayKey} onClick={() => onDayClick(day)} className={cn("border-b border-l min-h-[120px] p-1 flex flex-col cursor-pointer hover:bg-muted/50", { 'bg-muted/30 text-muted-foreground': !isSameMonth(day, currentDate) })}>
                        <span className="font-semibold">{format(day, 'd')}</span>
                        <div className="flex-1 overflow-y-auto text-xs space-y-1 mt-1">
                            {wosForDay.slice(0, 3).map(wo => (
                                <div key={wo.id} className={`p-1 text-white rounded-sm truncate ${getPriorityClasses(wo.priority)}`}>{wo.summary}</div>
                            ))}
                            {wosForDay.length > 3 && <div className="text-xs text-muted-foreground mt-1">+{wosForDay.length - 3} more</div>}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
