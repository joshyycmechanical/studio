
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
  Briefcase,
  Users,
  DollarSign,
  Wrench,
  Loader2,
  BarChartHorizontal,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { WorkOrder, WorkOrderStatus } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import type { Invoice } from '@/types/invoice';
import type { UserProfileWithRoles } from '@/types/user';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell as RechartsPrimitiveCell } from 'recharts';
import Link from 'next/link';
import { fetchDashboardData } from '@/services/dashboard';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';

// Helper to format currency
const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '$0.00';
    return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};

// Chart Component for Work Order Statuses
const WorkOrderStatusChart = ({ workOrders }: { workOrders: WorkOrder[] }) => {
    const statusCounts = React.useMemo(() => {
        const counts: { [key: string]: number } = {};
        if (!workOrders) return [];
        workOrders.forEach(wo => {
            counts[wo.status] = (counts[wo.status] || 0) + 1;
        });
        const allStatuses = ['new', 'scheduled', 'in-progress', 'on-hold', 'completed', 'invoiced', 'cancelled'];
        return allStatuses.map(status => ({
             name: status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
             value: counts[status] || 0,
             fill: `var(--chart-color-${status})`,
        }));
    }, [workOrders]);

    const chartConfig = {
      value: { label: 'Count' },
      'New': { label: 'New', color: 'hsl(var(--chart-1))' },
      'Scheduled': { label: 'Scheduled', color: 'hsl(var(--chart-2))' },
      'In Progress': { label: 'In Progress', color: 'hsl(var(--chart-3))' },
      'On Hold': { label: 'On Hold', color: 'hsl(var(--chart-4))' },
      'Completed': { label: 'Completed', color: 'hsl(var(--chart-5))' },
      'Invoiced': { label: 'Invoiced', color: 'hsl(var(--chart-1))' },
      'Cancelled': { label: 'Cancelled', color: 'hsl(var(--muted))' },
    } satisfies React.ComponentProps<typeof ChartContainer>['config'];

    return (
        <Card>
             <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <BarChartHorizontal className="h-5 w-5" /> Work Order Statuses
                </CardTitle>
                <CardDescription>Distribution of current work orders by status.</CardDescription>
            </CardHeader>
             <CardContent>
                {workOrders && workOrders.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statusCounts} layout="vertical" margin={{ left: 20, right: 10, top: 5, bottom: 5 }}>
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    width={120}
                                    tick={{ fontSize: 12 }}
                                />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                <Bar dataKey="value" radius={4}>
                                     {statusCounts.map((entry, index) => {
                                         const configEntry = chartConfig[entry.name as keyof typeof chartConfig];
                                         return <RechartsPrimitiveCell key={`cell-${index}`} fill={configEntry?.color ?? 'hsl(var(--chart-1))'} />;
                                     })}
                                </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                      </ChartContainer>
                  ) : (
                      <p className="text-muted-foreground text-center py-10">No work order data available for the chart.</p>
                  )}
            </CardContent>
            <CardFooter>
                <p className="text-xs text-muted-foreground">Data based on all work orders in the system.</p>
            </CardFooter>
        </Card>
    );
};

// Main Dashboard Component
export default function DashboardPage() {
    const { user, companyId, authStatus } = useAuth();
    const router = useRouter();

    const isPlatformOwner = user?.company_id === null;

    const { data: dashboardData, isLoading, error } = useQuery({
      queryKey: ['dashboardData', companyId],
      queryFn: () => {
        if (!companyId) {
            throw new Error("Company context is not available for dashboard.");
        }
        return fetchDashboardData();
      },
      enabled: authStatus === 'loggedIn' && !!companyId && !isPlatformOwner, // Enable only for company users
    });


    // Redirect platform owner away from this dashboard
    React.useEffect(() => {
        if (authStatus === 'loggedIn' && isPlatformOwner) {
            router.replace('/platform/companies');
        }
    }, [authStatus, isPlatformOwner, router]);


    if (authStatus === 'loading' || isLoading) {
        return (
            <main className="flex flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </main>
        );
    }
    
    // This state will be hit if the user is a platform owner while the redirect is happening
    if (isPlatformOwner) {
        return (
             <main className="flex flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">Redirecting to Platform Admin...</p>
            </main>
        );
    }

     if (error) {
        return (
             <main className="flex flex-1 items-center justify-center p-4">
                 <Card className="w-full max-w-md">
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2"><AlertCircle className="text-destructive"/> Error Loading Dashboard</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Request Failed</AlertTitle>
                            <AlertDescription>{(error as Error).message}</AlertDescription>
                        </Alert>
                        <p className="text-sm text-muted-foreground mt-4">There was an issue fetching required data. This may be due to a network issue or insufficient permissions. Please try again later or contact support.</p>
                    </CardContent>
                 </Card>
            </main>
        )
    }

    if (!dashboardData) {
        return (
             <main className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground">No dashboard data available.</p>
            </main>
        )
    }

    const { workOrders, customers, equipment, invoices, users } = dashboardData;

    const activeWorkOrders = workOrders.filter(wo => !['completed', 'cancelled', 'invoiced'].includes(wo.status)).length;
    const dueInvoices = invoices.filter(inv => (inv.amount_due ?? 0) > 0 && !['paid', 'void'].includes(inv.status));
    const totalDueAmount = dueInvoices.reduce((sum, inv) => sum + (inv.amount_due ?? 0), 0);
    const activeUsers = users.filter(u => u.status === 'active').length;
    const invitedUsers = users.filter(u => u.status === 'invited').length;
    const activeEquipment = equipment.filter(eq => eq.status === 'operational').length;
    const needsRepairEquipment = equipment.filter(eq => eq.status === 'needs-repair').length;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Link href="/work-orders" className="hover:bg-muted/50 transition-colors rounded-lg">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Work Orders</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeWorkOrders}</div>
              <p className="text-xs text-muted-foreground">
                  {workOrders.filter(wo => wo.status === 'new').length} new job(s)
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/invoicing" className="hover:bg-muted/50 transition-colors rounded-lg">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Amount Due</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalDueAmount)}</div>
              <p className="text-xs text-muted-foreground">
                From {dueInvoices.length} open invoice(s)
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/users" className="hover:bg-muted/50 transition-colors rounded-lg">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers}</div>
              <p className="text-xs text-muted-foreground">
                {invitedUsers} pending invitation(s)
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/equipment" className="hover:bg-muted/50 transition-colors rounded-lg">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipment Status</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeEquipment} <span className="text-lg text-muted-foreground">Operational</span></div>
              <p className="text-xs text-muted-foreground">
                {needsRepairEquipment} item(s) need repair
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
             <WorkOrderStatusChart workOrders={workOrders} />
             {/* Recent Activity placeholder until implemented */}
             <Card className="xl:col-span-2">
                <CardHeader>
                    <CardTitle>Recent Activity (Not Implemented)</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-10">Recent activity feed will go here.</p>
                </CardContent>
             </Card>
        </div>
    </main>
  );
}
