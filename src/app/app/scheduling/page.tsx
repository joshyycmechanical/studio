
'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, GripVertical, CheckCheck, Users, MapPin, Info, Calendar as CalendarIcon, ListFilter, List, CalendarDays, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { WorkOrder, WorkOrderPriority } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import type { UserProfileWithRoles } from '@/types/user';
import { fetchCompanyWorkOrders, updateWorkOrder } from '@/services/workOrders';
import { fetchCompanyCustomers } from '@/services/customers';
import { fetchCompanyUsers } from '@/services/users';
import { startOfDay, endOfDay, addDays, format, isSameDay, getHours, getMinutes, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { DndContext, useDroppable, useDraggable, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { UnscheduledWorkOrderCard } from '@/components/scheduling/UnscheduledWorkOrderCard';

const HOUR_HEIGHT_IN_PX = 60;
const SNAP_GRID_MINUTES = 15;

// Utility function to get priority-based styling
const getPriorityClasses = (priority?: WorkOrderPriority | null): string => {
    switch (priority) {
        case 'emergency':
            return 'border-destructive bg-destructive/10 text-destructive-foreground';
        case 'high':
            return 'border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-200';
        case 'medium':
            return 'border-yellow-500 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200';
        case 'low':
            return 'border-blue-500 bg-blue-500/10 text-blue-800 dark:text-blue-200';
        default:
            return 'border-border bg-card';
    }
};

// Resizing handle and logic state
const DraggableWorkOrderEvent = ({ workOrder, customer }: { workOrder: WorkOrder; customer?: Customer }) => {
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

const TechnicianDayColumn = ({ date, technician, workOrders, customers }: { date: Date; technician: Partial<UserProfileWithRoles>; workOrders: WorkOrder[]; customers: Customer[] }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `droppable-${technician.id}-${format(date, 'yyyy-MM-dd')}`,
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

const WeekView = ({ currentDate, workOrders, technicians, customers }: any) => {
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


const MonthView = ({ currentDate, workOrders, onDayClick }: any) => {
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


export default function SchedulingPage() {
    const { user: currentUser, loading: authLoading, companyId } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [view, setView] = useState<'day' | 'week' | 'month' | 'list'>('day');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedTechnicians, setSelectedTechnicians] = useState<Set<string>>(new Set());

    const canView = !authLoading && hasPermission(currentUser, 'scheduling', 'view');
    
    const { data: workOrders = [], isLoading: isLoadingWOs, error: errorWOs } = useQuery<WorkOrder[]>({
        queryKey: ['workOrders', companyId],
        queryFn: () => fetchCompanyWorkOrders(),
        enabled: !!companyId && canView,
    });

    const { data: customers = [], isLoading: isLoadingCustomers } = useQuery<Customer[]>({
        queryKey: ['customers', companyId],
        queryFn: () => fetchCompanyCustomers(companyId!),
        enabled: !!companyId && canView,
    });

    const { data: technicians = [], isLoading: isLoadingTechs } = useQuery<Partial<UserProfileWithRoles>[]>({
        queryKey: ['technicians', companyId],
        queryFn: () => fetchCompanyUsers(companyId!),
        enabled: !!companyId && canView,
    });

    const updateMutation = useMutation({
        mutationFn: (data: { workOrderId: string, updates: Partial<WorkOrder> }) => {
            if (!companyId) throw new Error("Company ID not found.");
            return updateWorkOrder(companyId, data.workOrderId, data.updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
            toast({ title: "Schedule Updated" });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        }
    });

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
    
    const navigateDate = (direction: number) => {
        let newDate;
        if (view === 'week') {
            newDate = addDays(currentDate, direction * 7);
        } else if (view === 'month') {
            newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1);
        } else {
            newDate = addDays(currentDate, direction);
        }
        setCurrentDate(newDate);
    };

    const sensors = useSensors(useSensor(PointerSensor));

    const displayedTechnicians = useMemo(() => {
        if (selectedTechnicians.size === 0) return technicians;
        return technicians.filter(t => selectedTechnicians.has(t.id!));
    }, [technicians, selectedTechnicians]);
    
    const unscheduledWorkOrders = useMemo(() => {
        return workOrders.filter(wo => !wo.assigned_technician_id && (wo.status === 'new' || wo.status === 'on-hold'));
    }, [workOrders]);

    if (authLoading || isLoadingWOs || isLoadingCustomers || isLoadingTechs) {
        return <div className="flex h-screen items-center justify-center"><Loader2/></div>;
    }
    if (!canView) {
        return <main><Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to view the schedule.</AlertDescription></Alert></main>;
    }

    const renderView = () => {
        switch(view) {
            case 'day': return (
                <div className="flex flex-1 overflow-hidden">
                    <Card className="w-64 flex-shrink-0 flex flex-col">
                        <CardHeader><CardTitle className="text-lg">Unscheduled</CardTitle></CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-2">
                            {unscheduledWorkOrders.map(wo => (
                                <UnscheduledWorkOrderCard key={wo.id} wo={wo} customer={customers.find(c => c.id === wo.customer_id)} />
                            ))}
                        </CardContent>
                    </Card>
                    <div className="flex-1 flex overflow-x-auto">
                        <div className="w-16 text-xs text-center sticky left-0 bg-background z-20">
                            {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                <div key={hour} className="h-[60px] relative border-b">
                                    <span className="absolute -top-2 left-1 text-muted-foreground">{format(new Date(0,0,0,hour), 'ha')}</span>
                                </div>
                            ))}
                        </div>
                        {displayedTechnicians.map(tech => (
                            <TechnicianDayColumn key={tech.id} date={currentDate} technician={tech} workOrders={workOrders} customers={customers} />
                        ))}
                    </div>
                </div>
            );
            case 'week': return <WeekView currentDate={currentDate} workOrders={workOrders} technicians={technicians} customers={customers} />;
            case 'month': return <MonthView currentDate={currentDate} workOrders={workOrders} onDayClick={(day: Date) => { setCurrentDate(day); setView('day'); }} />;
            case 'list': return <div className="text-center p-8 text-muted-foreground">List View - Coming Soon</div>;
        }
    };
    
    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col">
                <header className="p-4 border-b flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold">Dispatch Board</h1>
                        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
                        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}><ChevronLeft/></Button>
                        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}><ChevronRight/></Button>
                        <span className="font-semibold text-lg ml-4">{format(currentDate, view === 'month' ? "MMMM yyyy" : "MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline"><ListFilter className="mr-2"/>Technicians ({displayedTechnicians.length}/{technicians.length})</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuLabel>Filter Technicians</DropdownMenuLabel>
                                <DropdownMenuSeparator/>
                                {technicians.map(tech => (
                                    <DropdownMenuCheckboxItem key={tech.id} checked={selectedTechnicians.has(tech.id!)} onCheckedChange={(checked) => {
                                        const newSet = new Set(selectedTechnicians);
                                        if (checked) newSet.add(tech.id!);
                                        else newSet.delete(tech.id!);
                                        setSelectedTechnicians(newSet);
                                    }}>
                                        {tech.full_name}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-auto">
                            <TabsList>
                                <TabsTrigger value="day"><CalendarDays className="mr-2"/>Day</TabsTrigger>
                                <TabsTrigger value="week"><LayoutGrid className="mr-2"/>Week</TabsTrigger>
                                <TabsTrigger value="month"><CalendarIcon className="mr-2"/>Month</TabsTrigger>
                                <TabsTrigger value="list" disabled><List className="mr-2"/>List</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </header>
                {renderView()}
            </div>
        </DndContext>
    );
}
