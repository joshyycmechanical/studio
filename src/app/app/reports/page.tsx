'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { BarChart3, Calendar as CalendarIconLucide, Download, Settings, MapPin, CheckSquare, Loader2 } from 'lucide-react'; // Renamed CalendarIcon to avoid conflict
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { hasPermission } from '@/lib/permissions'; // Import permissions
import { useToast } from '@/hooks/use-toast'; // Import useToast
import type { WorkOrder, WorkOrderStatus } from '@/types/work-order'; // Import WorkOrder type
// Import REAL Firestore service functions
import { fetchCompanyWorkOrders } from '@/services/workOrders'; // Use work order service


// Helper to format date ranges for display
const formatMonth = (date: Date): string => format(date, 'MMM');


// Chart Component for Work Order Statuses by Month
const WorkOrderVolumeChart = ({ workOrders, dateRange }: { workOrders: WorkOrder[], dateRange: { from?: Date, to?: Date } }) => {
    const monthlyData = React.useMemo(() => {
        const monthMap: { [key: string]: { month: string; scheduled: number; completed: number } } = {};

        // Initialize months within the range if provided
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
             // Use created_at as the basis for monthly grouping
             if (wo.created_at) {
                targetDate = wo.created_at instanceof Date ? wo.created_at : wo.created_at.toDate();
            }

            if (targetDate) {
                const monthKey = format(targetDate, 'yyyy-MM');
                const monthLabel = format(targetDate, 'MMM');
                 if (!monthMap[monthKey]) {
                    // Only include months within the date range if specified
                    if(dateRange.from && dateRange.to && (targetDate < dateRange.from || targetDate > dateRange.to)) {
                       return; // Skip if outside range
                    }
                    monthMap[monthKey] = { month: monthLabel, scheduled: 0, completed: 0 };
                 }

                // Count based on status *within* the period the WO was created
                if (wo.status === 'completed' || wo.status === 'invoiced') {
                    monthMap[monthKey].completed += 1;
                }
                // Consider 'scheduled' and 'in-progress' as scheduled for this chart
                if (wo.status === 'scheduled' || wo.status === 'in-progress') {
                    monthMap[monthKey].scheduled += 1;
                }
            }
        });

        // Sort chronologically based on the yyyy-MM key before returning
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


export default function ReportsPage() {
    const { user, companyId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]); // State for fetched data
    const [loadingData, setLoadingData] = React.useState(true);
    const [dateRange, setDateRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
        from: startOfYear(new Date()), // Default to start of current year
        to: new Date(), // Default to today
    });

    // State for custom report builder (placeholders)
    const [reportType, setReportType] = React.useState<string>('work_order_summary');
    const [selectedFields, setSelectedFields] = React.useState<string[]>([]); // Example: ['wo_number', 'customer_name', 'status']

    // Permissions
    const canViewReports = !authLoading && hasPermission(user, 'reports', 'view');
    const canGenerateReports = !authLoading && hasPermission(user, 'reports', 'generate');

    // Fetch data based on companyId and dateRange
    React.useEffect(() => {
        if (authLoading || !companyId || !canViewReports) {
             setLoadingData(false);
             setWorkOrders([]); // Clear data if no permission or context
            return;
        }

        const fetchData = async () => {
            setLoadingData(true);
            console.log(`[ReportsPage] Fetching work orders for company ${companyId} from ${dateRange.from} to ${dateRange.to}`);
            try {
                 // Fetch WOs - filtering by date is usually done client-side for this overview,
                 // but could be done server-side for performance with large datasets.
                 const fetchedWorkOrders = await fetchCompanyWorkOrders(companyId);
                setWorkOrders(fetchedWorkOrders);
            } catch (error: any) {
                console.error("[ReportsPage] Error fetching work order data:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not load report data." });
                 setWorkOrders([]); // Clear data on error
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
     }, [companyId, authLoading, canViewReports, toast]); // Refetch when companyId or auth state changes

    // Filter work orders based on the selected date range *client-side* for the chart
     const workOrdersInDateRange = React.useMemo(() => {
        if (!dateRange.from || !dateRange.to) return workOrders; // Return all if no range selected

         const startTime = dateRange.from.getTime();
         const endTime = dateRange.to.setHours(23, 59, 59, 999); // Include entire end day

         return workOrders.filter(wo => {
             const woDate = wo.created_at instanceof Date ? wo.created_at : wo.created_at?.toDate(); // Handle Timestamp
             if (!woDate) return false;
             const woTime = woDate.getTime();
             return woTime >= startTime && woTime <= endTime;
         });
     }, [workOrders, dateRange]);

    // TODO: Implement export functionality
    const handleExport = () => {
        alert('Exporting not implemented yet.');
    }

    // TODO: Implement custom report generation logic
    const handleGenerateCustomReport = () => {
        if (!canGenerateReports) {
            toast({ variant: "destructive", title: "Permission Denied", description: "You cannot generate custom reports." });
            return;
        }
        console.log("Generating Custom Report:", { reportType, selectedFields, dateRange });
        alert("Custom report generation not implemented yet.");
    }

     if (authLoading) {
         return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
     }
     if (!canViewReports) {
         // TODO: Replace with a proper Access Denied component
         return <div className="p-4">Access Denied: You do not have permission to view reports.</div>;
     }


    return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            {/* --- Standard Reports Section --- */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center gap-4 flex-wrap">
                        <div className="flex-grow">
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-6 w-6" /> Standard Reports
                            </CardTitle>
                            <CardDescription>Generate and view business performance reports.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Date Range Picker */}
                             <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="date" className="text-xs text-muted-foreground">Date Range (Created At)</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="date"
                                            variant={"outline"}
                                            className={cn(
                                            "w-[260px] justify-start text-left font-normal h-9", // Adjusted height
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
                                            onSelect={setDateRange}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>
                             </div>
                            {/* Export Button */}
                             <Button variant="outline" size="sm" onClick={handleExport} disabled={!canGenerateReports || loadingData}>
                                <Download className="mr-2 h-4 w-4" /> Export
                             </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                     {loadingData ? (
                          <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                     ) : (
                        <>
                            {/* Work Order Volume Chart using real data */}
                             <WorkOrderVolumeChart workOrders={workOrders} dateRange={dateRange} />

                            {/* Placeholder for other standard reports */}
                            <Card>
                                <CardHeader><CardTitle>Technician Performance (Placeholder)</CardTitle></CardHeader>
                                <CardContent><p className="text-muted-foreground">Technician performance report will go here.</p></CardContent>
                            </Card>
                             <Card>
                                <CardHeader><CardTitle>Revenue Analysis (Placeholder)</CardTitle></CardHeader>
                                <CardContent><p className="text-muted-foreground">Revenue analysis report will go here.</p></CardContent>
                            </Card>
                         </>
                     )}
                </CardContent>
            </Card>

             {/* --- Custom Report Builder Section --- */}
             {canGenerateReports && ( // Only show if user can generate reports
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-6 w-6" /> Custom Report Builder
                        </CardTitle>
                        <CardDescription>Create your own reports by selecting data types and fields.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {/* Report Type Selector */}
                             <div>
                                <Label htmlFor="report-type">Report Data Type</Label>
                                <Select value={reportType} onValueChange={setReportType}>
                                    <SelectTrigger id="report-type">
                                        <SelectValue placeholder="Select data type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="work_order_summary">Work Order Summary</SelectItem>
                                        <SelectItem value="customer_list">Customer List</SelectItem>
                                        <SelectItem value="equipment_details">Equipment Details</SelectItem>
                                        <SelectItem value="invoice_summary">Invoice Summary</SelectItem>
                                        {/* Add more reportable data types */}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Field Selector (Placeholder - requires more complex component) */}
                             <div>
                                 <Label>Fields to Include</Label>
                                 {/* TODO: Implement a multi-select dropdown or checkbox group based on selected reportType */}
                                 <p className="text-sm text-muted-foreground border p-2 rounded-md h-10 flex items-center">(Field selection component needed)</p>
                             </div>
                         </div>
                         {/* Add Filters section if needed */}
                         {/* Add Grouping/Sorting options */}
                    </CardContent>
                     <CardFooter>
                         <Button onClick={handleGenerateCustomReport} disabled={loadingData}>
                            Generate Custom Report
                        </Button>
                     </CardFooter>
                </Card>
             )}

            {/* --- Geolocation Verification Report Section --- */}
             {hasPermission(user, 'gps-tracking', 'view') && ( // Check GPS view permission
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-6 w-6" /> Geolocation Verification
                        </CardTitle>
                        <CardDescription>Verify technician clock-in/out locations against job sites.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* TODO: Implement UI to select technician(s) and date range */}
                        {/* TODO: Display map and list/table comparing clock locations vs job locations */}
                         <p className="text-muted-foreground">Geolocation verification report UI and logic will go here.</p>
                    </CardContent>
                     <CardFooter>
                        <Button disabled>Run Verification Report</Button> {/* Enable when implemented */}
                    </CardFooter>
                </Card>
             )}
        </main>
    );
}

