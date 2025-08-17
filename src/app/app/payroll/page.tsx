'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DollarSign, Calendar as CalendarIcon, Loader2, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { format, startOfWeek, endOfWeek, addDays, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TimesheetSummary } from '@/types/time-entry'; // Import TimesheetSummary type
import type { UserProfile } from '@/types/user'; // For user data
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// Import REAL Firestore service functions
import { fetchCompanyTimeEntries, fetchCompanyUsers } from '@/services/time-entries'; // Fetch time entries and users
import type { TimeEntry } from '@/types/time-entry';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

export default function PayrollPage() {
  const { user: currentUser, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast(); // Add toast
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]); // State for raw time entries
  const [users, setUsers] = useState<Partial<UserProfile>[]>([]); // State for users
  const [loadingData, setLoadingData] = useState(true);
  const [payPeriod, setPayPeriod] = useState<{ from: Date | undefined, to: Date | undefined }>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }), // Default to current week starting Monday
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),   // Default to current week ending Sunday
  });

  // --- Permission Check ---
  const canViewPayroll = !authLoading && hasPermission(currentUser, 'payroll', 'view');
  const canExportPayroll = !authLoading && hasPermission(currentUser, 'payroll', 'export');

  // Fetch Raw Time Entries and Users
  const fetchData = useCallback(async () => {
     if (authLoading || !companyId) {
         setLoadingData(authLoading);
         return;
     }
    if (!canViewPayroll && !authLoading) {
        setLoadingData(false);
        return;
    }

    setLoadingData(true);
    console.log(`[PayrollPage] Fetching raw data for company: ${companyId}, Period: ${payPeriod.from} - ${payPeriod.to}`);
    try {
        // Fetch time entries within the date range and user data
       const [entriesData, usersData] = await Promise.all([
          // Pass dates to the fetch function
          fetchCompanyTimeEntries(companyId, undefined, payPeriod.from, payPeriod.to),
          fetchCompanyUsers(companyId)
       ]);

        // Filter only approved entries client-side (service could also offer this)
        const approvedEntries = entriesData.filter(entry => entry.status === 'approved');
        setTimeEntries(approvedEntries);
        setUsers(usersData);
    } catch (error: any) {
      console.error("[PayrollPage] Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load payroll data." }); // Use toast
      setTimeEntries([]);
      setUsers([]);
    } finally {
      setLoadingData(false);
    }
   }, [companyId, authLoading, canViewPayroll, payPeriod, toast]);

  useEffect(() => {
    fetchData(); // Fetch data initially and when dependencies change
  }, [fetchData]);


   // Calculate Payroll Summaries Client-Side
   const payrollSummaries = useMemo(() => {
        if (loadingData || users.length === 0 || timeEntries.length === 0 || !payPeriod.from || !payPeriod.to) {
            return [];
        }

        const summaries: { [userId: string]: TimesheetSummary } = {};

        timeEntries.forEach(entry => {
            // Skip entries without clock in/out or not approved
            if (!entry.clock_in_time || !entry.clock_out_time || entry.status !== 'approved') return;

            const userProfile = users.find(u => u.id === entry.user_id);
            if (!userProfile) return; // Skip entries for users not found

            // Convert Timestamps to Dates if necessary
            const clockIn = entry.clock_in_time instanceof Date ? entry.clock_in_time : (entry.clock_in_time as unknown as Timestamp).toDate();
            const clockOut = entry.clock_out_time instanceof Date ? entry.clock_out_time : (entry.clock_out_time as unknown as Timestamp).toDate();

            // Ensure dates are valid before calculating difference
            if (isNaN(clockIn.getTime()) || isNaN(clockOut.getTime())) {
                console.warn(`Invalid date found for time entry ${entry.id}`);
                return;
            }

            // Calculate duration for this entry
             const durationMinutes = differenceInMinutes(clockOut, clockIn);
             const durationHours = durationMinutes / 60;


            if (!summaries[entry.user_id]) {
                summaries[entry.user_id] = {
                    user_id: entry.user_id,
                    user_name: userProfile.full_name ?? userProfile.email ?? 'Unknown User',
                    period_start: payPeriod.from!,
                    period_end: payPeriod.to!,
                    total_hours: 0,
                    regular_hours: 0,
                    overtime_hours: 0,
                };
            }

            // Accumulate total hours for the user within the period
            summaries[entry.user_id].total_hours += durationHours;
        });

        // Calculate Regular vs Overtime (Simple Weekly Threshold Example)
        // This is a simplified calculation. Real OT calculation can be complex
        // (daily OT, 7th day consecutive, etc.) and should ideally happen on the backend.
        Object.values(summaries).forEach(summary => {
            const userProfile = users.find(u => u.id === summary.user_id);
             const otThreshold = userProfile?.overtime_threshold_hours ?? 40; // Get threshold from profile or default
            if (summary.total_hours > otThreshold) {
                summary.regular_hours = otThreshold;
                summary.overtime_hours = summary.total_hours - otThreshold;
            } else {
                summary.regular_hours = summary.total_hours;
                summary.overtime_hours = 0;
            }
        });

        return Object.values(summaries);
    }, [timeEntries, users, payPeriod, loadingData]);


  const handleExport = () => {
    if (!canExportPayroll) return;
    if (payrollSummaries.length === 0) {
        toast({ variant: "default", title: "No Data", description: "No payroll data to export for the selected period." });
        return;
    }
    console.log("Exporting payroll data for period:", payPeriod, payrollSummaries);

     // Basic CSV generation
     let csvContent = "data:text/csv;charset=utf-8,Technician,Regular Hours,Overtime Hours,Total Hours\n";
     payrollSummaries.forEach(row => {
         // Sanitize user name for CSV (remove commas)
         const userNameSanitized = row.user_name.replace(/,/g, '');
         csvContent += `${userNameSanitized},${row.regular_hours.toFixed(2)},${row.overtime_hours.toFixed(2)},${row.total_hours.toFixed(2)}\n`;
     });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      const fileName = `payroll_report_${format(payPeriod.from ?? new Date(), 'yyyyMMdd')}-${format(payPeriod.to ?? new Date(), 'yyyyMMdd')}.csv`;
      link.setAttribute("download", fileName);
      document.body.appendChild(link); // Required for FF
      link.click();
      document.body.removeChild(link);
      toast({ title: "Export Successful", description: `${fileName} downloaded.` });
  }

  // Render checks
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canViewPayroll) {
     return (
       <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You do not have permission to view payroll reports.</AlertDescription>
          </Alert>
       </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
           <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex-grow">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-6 w-6" /> Payroll Report
              </CardTitle>
              <CardDescription>Review summarized technician hours for payroll processing based on <span className='font-medium text-foreground'>approved</span> time entries.</CardDescription>
            </div>
             <div className="flex items-center gap-2 flex-shrink-0">
               {canExportPayroll && (
                 <Button size="sm" onClick={handleExport} disabled={loadingData || payrollSummaries.length === 0}>
                   <Download className="mr-2 h-4 w-4" /> Export CSV
                 </Button>
               )}
            </div>
          </div>
           {/* Pay Period Selector */}
           <div className="mt-4">
                <Label htmlFor="pay-period-filter">Pay Period</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="pay-period-filter"
                        variant={"outline"}
                        className={cn("w-full max-w-sm justify-start text-left font-normal", !payPeriod.from && "text-muted-foreground")}
                        disabled={loadingData}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {payPeriod.from ? (
                        payPeriod.to ? (
                            <>
                            {format(payPeriod.from, "LLL dd, y")} -{" "}
                            {format(payPeriod.to, "LLL dd, y")}
                            </>
                        ) : (
                            format(payPeriod.from, "LLL dd, y")
                        )
                        ) : (
                        <span>Select pay period</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={payPeriod.from}
                        selected={payPeriod}
                        onSelect={(range) => setPayPeriod(range || { from: undefined, to: undefined })}
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
            </div>
        </CardHeader>
        <CardContent>
           {loadingData ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead className="text-right">Regular Hours</TableHead>
                  <TableHead className="text-right">Overtime Hours</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                   {/* Add columns for pay rate, total pay if permissions allow */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No approved time entries found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  payrollSummaries.map((summary) => (
                    <TableRow key={summary.user_id}>
                      <TableCell className="font-medium">{summary.user_name}</TableCell>
                      <TableCell className="text-right">{summary.regular_hours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{summary.overtime_hours.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{summary.total_hours.toFixed(2)}</TableCell>
                       {/* TODO: Add calculated pay columns if rate is available */}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter className="text-sm text-muted-foreground">
            Data based on <span className='font-medium text-foreground'>approved</span> time entries for the selected period. Overtime calculated based on weekly threshold (check user profiles for specific thresholds).
        </CardFooter>
      </Card>
    </main>
  );
}
