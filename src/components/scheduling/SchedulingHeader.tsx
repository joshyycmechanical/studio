
import { Button } from '@/components/ui/button';
import {
    ChevronLeft,
    ChevronRight,
    ListFilter,
    List,
    CalendarDays,
    LayoutGrid,
    Calendar as CalendarIcon,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

export const SchedulingHeader = ({
    currentDate,
    view,
    onViewChange,
    onNavigateDate,
    onSetToday,
    technicians,
    selectedTechnicians,
    onTechnicianFilterChange
}: any) => {
    const displayedTechnicians = technicians.filter((t: any) => selectedTechnicians.has(t.id!));
    return (
        <header className="p-4 border-b flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">Dispatch Board</h1>
                <Button variant="outline" size="sm" onClick={onSetToday}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => onNavigateDate(-1)}><ChevronLeft/></Button>
                <Button variant="outline" size="icon" onClick={() => onNavigateDate(1)}><ChevronRight/></Button>
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
                        {technicians.map((tech: any) => (
                            <DropdownMenuCheckboxItem key={tech.id} checked={selectedTechnicians.has(tech.id!)} onCheckedChange={(checked) => onTechnicianFilterChange(tech.id!, checked)}>
                                {tech.full_name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <Tabs value={view} onValueChange={onViewChange} className="w-auto">
                    <TabsList>
                        <TabsTrigger value="day"><CalendarDays className="mr-2"/>Day</TabsTrigger>
                        <TabsTrigger value="week"><LayoutGrid className="mr-2"/>Week</TabsTrigger>
                        <TabsTrigger value="month"><CalendarIcon className="mr-2"/>Month</TabsTrigger>
                        <TabsTrigger value="list" disabled><List className="mr-2"/>List</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
        </header>
    )
}
