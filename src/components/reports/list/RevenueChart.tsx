
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { format, startOfMonth } from 'date-fns';
import type { Invoice } from '@/types/invoice';

interface RevenueChartProps {
    invoices: Invoice[];
    dateRange: { from?: Date; to?: Date };
}

export function RevenueChart({ invoices, dateRange }: RevenueChartProps) {
    const revenueData = React.useMemo(() => {
        const monthMap: { [key: string]: { month: string; revenue: number } } = {};

        if (dateRange?.from && dateRange?.to) {
            let currentMonth = startOfMonth(dateRange.from);
            const endMonth = startOfMonth(dateRange.to);
            while (currentMonth <= endMonth) {
                 const monthKey = format(currentMonth, 'yyyy-MM');
                 const monthLabel = format(currentMonth, 'MMM');
                 monthMap[monthKey] = { month: monthLabel, revenue: 0 };
                 currentMonth.setMonth(currentMonth.getMonth() + 1);
            }
        }

        invoices.forEach(invoice => {
            // Only include paid invoices in revenue calculation
            if (invoice.status === 'paid' && invoice.last_payment_date) {
                const paymentDate = invoice.last_payment_date instanceof Date ? invoice.last_payment_date : new Date(invoice.last_payment_date);
                 const monthKey = format(paymentDate, 'yyyy-MM');
                 if (monthMap[monthKey]) {
                    monthMap[monthKey].revenue += invoice.total_amount;
                 }
            }
        });

        return Object.keys(monthMap)
            .sort()
            .map(key => monthMap[key]);

    }, [invoices, dateRange]);

    const chartConfig = {
      revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
    } satisfies React.ComponentProps<typeof ChartContainer>["config"];
    
    const totalRevenue = revenueData.reduce((acc, item) => acc + item.revenue, 0);

    return (
        <Card>
             <CardHeader>
                <CardTitle>Revenue Analysis</CardTitle>
                 <CardDescription>Total revenue from paid invoices within the selected period.</CardDescription>
             </CardHeader>
             <CardContent>
                <div className="text-4xl font-bold mb-4">
                    {totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </div>
                 {revenueData.length > 0 ? (
                     <ChartContainer config={chartConfig} className="h-[250px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                             <AreaChart
                                 data={revenueData}
                                 margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                              >
                                 <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                  <XAxis
                                     dataKey="month"
                                     tickLine={false}
                                     axisLine={false}
                                     tickMargin={8}
                                 />
                                 <ChartTooltip
                                     cursor={false}
                                     content={<ChartTooltipContent indicator="dot" />}
                                  />
                                 <Area dataKey="revenue" type="natural" fill="var(--color-revenue)" fillOpacity={0.4} stroke="var(--color-revenue)" />
                             </AreaChart>
                          </ResponsiveContainer>
                      </ChartContainer>
                  ) : (
                      <p className="text-muted-foreground text-center py-10">No revenue data available for the selected period.</p>
                  )}
            </CardContent>
             <CardFooter>
                 <p className="text-xs text-muted-foreground">Based on invoices marked 'paid' within the selected date range.</p>
             </CardFooter>
        </Card>
    );
};
