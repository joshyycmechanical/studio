
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import type { WorkOrder } from '@/types/work-order';
import type { UserProfile } from '@/types/user';

interface TechnicianPerformanceChartProps {
    workOrders: WorkOrder[];
    users: UserProfile[];
}

export function TechnicianPerformanceChart({ workOrders, users }: TechnicianPerformanceChartProps) {
    const performanceData = React.useMemo(() => {
        const techMap: { [key: string]: { name: string; completed: number } } = {};

        // Initialize map with all users who can be technicians
        users.forEach(user => {
            // This condition can be refined if there's a specific 'technician' role
            if (user.full_name) {
                 techMap[user.id] = { name: user.full_name, completed: 0 };
            }
        });

        // Aggregate completed work orders
        workOrders.forEach(wo => {
            if ((wo.status === 'completed' || wo.status === 'invoiced') && wo.assigned_technician_id) {
                const techId = wo.assigned_technician_id;
                if (techMap[techId]) {
                    techMap[techId].completed += 1;
                }
            }
        });

        // Filter out technicians with zero completed work orders and sort
        return Object.values(techMap)
            .filter(tech => tech.completed > 0)
            .sort((a, b) => b.completed - a.completed);

    }, [workOrders, users]);

    const chartConfig = {
      completed: { label: 'Completed WOs', color: 'hsl(var(--chart-1))' },
    } satisfies React.ComponentProps<typeof ChartContainer>["config"];

    return (
        <Card>
             <CardHeader>
                <CardTitle>Technician Performance</CardTitle>
                 <CardDescription>Number of completed/invoiced work orders per technician in the selected period.</CardDescription>
             </CardHeader>
             <CardContent>
                 {performanceData.length > 0 ? (
                     <ChartContainer config={chartConfig} className="h-[300px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                             <BarChart
                                 data={performanceData}
                                 layout="vertical"
                                 margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                              >
                                 <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                 <YAxis
                                     dataKey="name"
                                     type="category"
                                     width={120}
                                     tickLine={false}
                                     axisLine={false}
                                     tick={{ fontSize: 12 }}
                                 />
                                  <XAxis dataKey="completed" type="number" hide />
                                 <ChartTooltip
                                     cursor={false}
                                     content={<ChartTooltipContent indicator="dashed" hideLabel />}
                                  />
                                 <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
                             </BarChart>
                          </ResponsiveContainer>
                      </ChartContainer>
                  ) : (
                      <p className="text-muted-foreground text-center py-10">No technician performance data available for the selected period.</p>
                  )}
            </CardContent>
        </Card>
    );
};
