
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Clock, User, Calendar as CalendarIcon, Loader2, AlertCircle, Filter, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TimeEntry, TimeEntryStatus } from '@/types/time-entry';
import type { UserProfile } from '@/types/user';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { fetchCompanyTimeEntries, updateTimeEntryStatus, deleteTimeEntry } from '@/services/time-entries';
import { fetchCompanyUsers } from '@/services/users';

export default function TimesheetsPage() {
  const { user: currentUser, companyId, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [technicians, setTechnicians] = useState<Partial<UserProfile>[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const [selectedTechnician, setSelectedTechnician] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  const canViewAllTimesheets = !authLoading && hasPermission(currentUser, 'timesheets', 'view_all');
  const canManageTimesheets = !authLoading && hasPermission(currentUser, 'timesheets', 'manage');

  const fetchData = useCallback(async () => {
    if (!companyId || authLoading) return;
    
    setLoadingData(true);
    try {
      const [entriesData, techData] = await Promise.all([
         fetchCompanyTimeEntries(companyId),
         fetchCompanyUsers(companyId) // Still need this for the filter dropdown
      ]);
      setTimeEntries(entriesData);
      setTechnicians(techData);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not load data." });
    } finally {
      setLoadingData(false);
    }
   }, [companyId, authLoading, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEntries = React.useMemo(() => {
     const userIdToFilter = !canViewAllTimesheets ? currentUser?.id : selectedTechnician;
    return timeEntries.filter(entry => {
      const techMatch = userIdToFilter === 'all' || entry.user_id === userIdToFilter;
      const entryClockInDate = entry.clock_in_time instanceof Date ? entry.clock_in_time : entry.clock_in_time?.toDate();
      const dateMatch =
        (!dateRange.from || (entryClockInDate && entryClockInDate >= dateRange.from)) &&
        (!dateRange.to || (entryClockInDate && entryClockInDate <= addDays(dateRange.to, 1)));
      return techMatch && dateMatch;
    });
   }, [timeEntries, selectedTechnician, dateRange, canViewAllTimesheets, currentUser?.id]);

  const formatDuration = (minutes: number | null | undefined): string => {
    if (minutes === null || minutes === undefined) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };
  
  const handleStatusUpdate = async (entryId: string, newStatus: 'approved' | 'rejected') => {
      if (!canManageTimesheets || !companyId || !currentUser?.id) return;
      setIsSaving(entryId);
      try {
          await updateTimeEntryStatus(companyId, entryId, newStatus, currentUser.id);
          fetchData();
          toast({ title: `Time Entry ${newStatus}` });
      } catch (error: any) {
           toast({ variant: "destructive", title: "Update Failed", description: error.message });
      } finally {
          setIsSaving(null);
      }
  }

  const handleDelete = async (entryId: string) => {
      if (!canManageTimesheets || !companyId) return;
      setIsSaving(entryId);
       try {
          await deleteTimeEntry(companyId, entryId);
           setTimeEntries(prev => prev.filter(entry => entry.id !== entryId));
           toast({ title: "Time Entry Deleted" });
       } catch (error: any) {
            toast({ variant: "destructive", title: "Delete Failed", description: error.message });
       } finally {
            setIsSaving(null);
       }
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
    
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
            <CardTitle>Timesheets</CardTitle>
            <CardDescription>Review and manage technician time entries.</CardDescription>
          <div className="mt-4 flex flex-wrap items-end gap-4">
             {canViewAllTimesheets && (
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="tech-filter">Technician</Label>
                  <Select
                    value={selectedTechnician}
                    onValueChange={setSelectedTechnician}
                    disabled={loadingData}
                  >
                    <SelectTrigger id="tech-filter">
                      <SelectValue placeholder="All Technicians" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Technicians</SelectItem>
                      {technicians.map(tech => (
                         tech.id ? (
                             <SelectItem key={tech.id} value={tech.id}>
                                {tech.full_name ?? tech.email ?? 'Unnamed User'}
                             </SelectItem>
                         ) : null
                      ))}
                    </SelectContent>
                  </Select>
                </div>
             )}
            <div className="flex-1 min-w-[280px]">
                <Label htmlFor="date-range-filter">Date Range</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button id="date-range-filter" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")} disabled={loadingData}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (dateRange.to ? (`${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`) : format(dateRange.from, "LLL dd, y")) : (<span>Pick a date range</span>)}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange.from} selected={dateRange} onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })} numberOfMonths={2}/>
                    </PopoverContent>
                </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                   {canViewAllTimesheets && <TableHead>Technician</TableHead>}
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={canViewAllTimesheets ? 7 : 6} className="h-24 text-center text-muted-foreground">No time entries found.</TableCell></TableRow>
                ) : (
                  filteredEntries.map((entry) => {
                      const clockInDate = entry.clock_in_time instanceof Date ? entry.clock_in_time : entry.clock_in_time?.toDate();
                      const clockOutDate = entry.clock_out_time instanceof Date ? entry.clock_out_time : entry.clock_out_time?.toDate();

                      return (
                          <TableRow key={entry.id}>
                            {canViewAllTimesheets && <TableCell>{entry.user_name}</TableCell>}
                            <TableCell>{clockInDate ? format(clockInDate, 'PP p') : '-'}</TableCell>
                            <TableCell>{clockOutDate ? format(clockOutDate, 'PP p') : (entry.status === 'clocked-in' ? <Badge variant="outline">Clocked In</Badge> : '-')}</TableCell>
                            <TableCell>{formatDuration(entry.duration_minutes)}</TableCell>
                            <TableCell>{entry.work_order_id ?? '-'}</TableCell>
                            <TableCell><Badge variant={entry.status === 'approved' ? 'default' : 'secondary'}>{entry.status.replace('_', ' ')}</Badge></TableCell>
                            <TableCell className="text-right space-x-1">
                              {canManageTimesheets && entry.status === 'pending_approval' && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(entry.id, 'approved')} disabled={isSaving === entry.id}>{isSaving === entry.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4" />}</Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleStatusUpdate(entry.id, 'rejected')} disabled={isSaving === entry.id}>{isSaving === entry.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="h-4 w-4" />}</Button>
                                </>
                              )}
                              {canManageTimesheets && entry.status !== 'clocked-in' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSaving === entry.id}>{isSaving === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this time entry.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(entry.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </TableCell>
                          </TableRow>
                      );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter className="text-sm text-muted-foreground">Total Entries: {filteredEntries.length}</CardFooter>
      </Card>
    </main>
  );
}
