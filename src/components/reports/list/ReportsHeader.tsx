
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Download, Calendar as CalendarIconLucide } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface ReportsHeaderProps {
    dateRange: { from: Date | undefined; to: Date | undefined };
    onDateChange: (dateRange: { from: Date | undefined; to: Date | undefined }) => void;
    onExport: () => void;
    canGenerateReports: boolean;
    loadingData: boolean;
}

export function ReportsHeader({ dateRange, onDateChange, onExport, canGenerateReports, loadingData }: ReportsHeaderProps) {
    return (
        <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex-grow">
                <h1 className="font-semibold text-lg md:text-2xl">Reports</h1>
                <p className="text-sm text-muted-foreground">Generate and view business performance reports.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                 <div className="flex flex-col space-y-1.5">
                    <Label htmlFor="date" className="text-xs text-muted-foreground">Date Range (Created At)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-[260px] justify-start text-left font-normal h-9",
                                !dateRange.from && "text-muted-foreground"
                                )}
                            >
                                <CalendarIconLucide className="mr-2 h-4 w-4" />
                                {dateRange.from ? (
                                dateRange.to ? (
                                    <>
                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                    {format(dateRange.to, "LLL dd, y")}
                                    </>
                                ) : (
                                    format(dateRange.from, "LLL dd, y")
                                )
                                ) : (
                                <span>Pick a date range</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange.from}
                                selected={dateRange}
                                onSelect={onDateChange}
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>
                 </div>
                 <Button variant="outline" size="sm" onClick={onExport} disabled={!canGenerateReports || loadingData}>
                    <Download className="mr-2 h-4 w-4" /> Export
                 </Button>
            </div>
        </div>
    );
}
