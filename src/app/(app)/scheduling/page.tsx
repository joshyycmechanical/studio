
'use client';

import * as React from 'react';
import { DndContext, useSensor, PointerSensor, useSensors } from '@dnd-kit/core';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { addDays, format } from 'date-fns';
import { useSchedulingState } from '@/components/scheduling/useSchedulingState';
import { useSchedulingDnD } from '@/components/scheduling/useSchedulingDnD';
import { SchedulingHeader } from '@/components/scheduling/SchedulingHeader';
import { UnscheduledWorkOrderCard } from '@/components/scheduling/UnscheduledWorkOrderCard';
import { TechnicianDayColumn } from '@/components/scheduling/TechnicianDayColumn';
import { WeekView } from '@/components/scheduling/WeekView';
import { MonthView } from '@/components/scheduling/MonthView';

export default function SchedulingPage() {
    const {
        view,
        setView,
        currentDate,
        setCurrentDate,
        selectedTechnicians,
        setSelectedTechnicians,
        canView,
        workOrders,
        customers,
        technicians,
        displayedTechnicians,
        unscheduledWorkOrders,
        isLoading,
        error,
        updateMutation
    } = useSchedulingState();

    const { handleDragEnd } = useSchedulingDnD(updateMutation);

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

    const handleTechnicianFilterChange = (technicianId: string, checked: boolean) => {
        const newSet = new Set(selectedTechnicians);
        if (checked) {
            newSet.add(technicianId);
        } else {
            newSet.delete(technicianId);
        }
        setSelectedTechnicians(newSet);
    };

    const sensors = useSensors(useSensor(PointerSensor));

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!canView) {
        return (
            <main className="p-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>You do not have permission to view the schedule.</AlertDescription>
                </Alert>
            </main>
        );
    }

    if (error) {
        return (
            <main className="p-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Data</AlertTitle>
                    <AlertDescription>{(error as Error).message}</AlertDescription>
                </Alert>
            </main>
        )
    }

    const renderView = () => {
        switch (view) {
            case 'day':
                return (
                    <div className="flex flex-1 overflow-hidden">
                        <Card className="w-64 flex-shrink-0 flex flex-col">
                            <CardHeader><CardTitle className="text-lg">Unscheduled</CardTitle></CardHeader>
                            <CardContent className="flex-1 overflow-y-auto">
                                {unscheduledWorkOrders.map(wo => (
                                    <UnscheduledWorkOrderCard key={wo.id} wo={wo} customer={customers.find(c => c.id === wo.customer_id)} />
                                ))}
                            </CardContent>
                        </Card>
                        <div className="flex-1 flex overflow-x-auto">
                            <div className="w-16 text-xs text-center sticky left-0 bg-background z-20">
                                {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                    <div key={hour} className="h-[60px] relative border-b">
                                        <span className="absolute -top-2 left-1 text-muted-foreground">{format(new Date(0, 0, 0, hour), 'ha')}</span>
                                    </div>
                                ))}
                            </div>
                            {displayedTechnicians.map(tech => (
                                <TechnicianDayColumn key={tech.id} date={currentDate} technician={tech} workOrders={workOrders} customers={customers} />
                            ))}
                        </div>
                    </div>
                );
            case 'week':
                return <WeekView currentDate={currentDate} workOrders={workOrders} customers={customers} />;
            case 'month':
                return <MonthView currentDate={currentDate} workOrders={workOrders} onDayClick={(day: Date) => { setCurrentDate(day); setView('day'); }} />;
            case 'list':
                return <div className="text-center p-8 text-muted-foreground">List View - Coming Soon</div>;
            default:
                return null;
        }
    };

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col">
                <SchedulingHeader
                    currentDate={currentDate}
                    view={view}
                    onViewChange={(v: any) => setView(v)}
                    onNavigateDate={navigateDate}
                    onSetToday={() => setCurrentDate(new Date())}
                    technicians={technicians}
                    selectedTechnicians={selectedTechnicians}
                    onTechnicianFilterChange={handleTechnicianFilterChange}
                />
                {renderView()}
            </div>
        </DndContext>
    );
}
