
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import type { WorkOrder } from '@/types/work-order';

interface WorkOrderVolumeChartProps {
    workOrders: WorkOrder[];
    dateRange: { from?: Date; to?: Date };
}

export function WorkOrderVolumeChart({ workOrders, dateRange }: WorkOrderVolumeChartProps) {
    const monthlyData = React.useMemo(() => {
        const monthMap: { [key: string]: { month: string; scheduled: number; completed: number } } = {};

        if (dateRange.from && dateRange.to) {
            let currentMonth = new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), 1);
            const endMonth = new Date(dateRange.to.getFullYear(), dateRange.to.getMonth(), 1);
            while (currentMonth <= endMonth) {
                 const monthKey = format(currentMonth, 'yyyy-MM');
                 const monthLabel = format(currentMonth, 'MMM');
                 monthMap[monthKey] = { month: monthLabel, scheduled: 0, completed: 0 };
                 currentMonth.setMonth(currentMonth.getMonth() + 1);
            }
        }

        workOrders.forEach(wo => {
            let targetDate: Date | null = null;
             if (wo.created_at) {
                targetDate = wo.created_at instanceof Date ? wo.created_at : wo.created_at.toDate();
            }

            if (targetDate) {
                const monthKey = format(targetDate, 'yyyy-MM');
                const monthLabel = format(targetDate, 'MMM');
                 if (!monthMap[monthKey]) {
                    if(dateRange.from && dateRange.to && (targetDate < dateRange.from || targetDate > dateRange.to)) {
                       return;
                    }
                    monthMap[monthKey] = { month: monthLabel, scheduled: 0, completed: 0 };
                 }

                if (wo.status === 'completed' || wo.status === 'invoiced') {
                    monthMap[monthKey].completed += 1;
                }
                if (wo.status === 'scheduled' || wo.status === 'in-progress') {
                    monthMap[monthKey].scheduled += 1;
                }
            }
        });

        return Object.keys(monthMap)
            .sort()
            .map(key => monthMap[key]);

    }, [workOrders, dateRange]);

    const chartConfig = {
      completed: { label: 'Completed/Invoiced', color: 'hsl(var(--chart-1))' },
      scheduled: { label: 'Scheduled/In Progress', color: 'hsl(var(--chart-2))' },
    } satisfies React.ComponentProps<typeof ChartContainer>["config"];


    return (
        <Card>
             <CardHeader>
                <CardTitle>Work Order Volume</CardTitle>
                 <CardDescription>Created work orders by month, categorized by status (Completed/Invoiced vs. Scheduled/In Progress).</CardDescription>
             </CardHeader>
             <CardContent>
                 {monthlyData.length > 0 ? (
                     <ChartContainer config={chartConfig} className="h-[300px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                 <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                 <XAxis
                                     dataKey="month"
                                     tickLine={false}
                                     axisLine={false}
                                     tickMargin={8}
                                 />
                                 <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                                 <ChartTooltip
                                     cursor={false}
                                     content={<ChartTooltipContent indicator="dashed" />}
                                  />
                                  <ChartLegend content={<ChartLegendContent />} />
                                 <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
                                 <Bar dataKey="scheduled" fill="var(--color-scheduled)" radius={4} />
                             </BarChart>
                          </ResponsiveContainer>
                      </ChartContainer>
                  ) : (
                      <p className="text-muted-foreground text-center py-10">No work order data available for the selected period.</p>
                  )}
            </CardContent>
            <CardFooter>
                <p className="text-xs text-muted-foreground">Data from the selected period ({format(dateRange.from ?? new Date(0), 'PP')} - {format(dateRange.to ?? new Date(), 'PP')}).</p>
            </CardFooter>
        </Card>
    );
};
