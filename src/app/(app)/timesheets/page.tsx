
'use client';

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchCompanyTimeEntries, deleteTimeEntry, updateTimeEntryStatus } from '@/services/time-entries';
import { fetchCompanyUsers } from '@/services/users';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import type { TimeEntry } from '@/types/time-entry';
import type { UserProfile } from '@/types/user';
import { TimesheetHeader } from '@/components/timesheets/list/TimesheetHeader';
import { TimesheetTable } from '@/components/timesheets/list/TimesheetTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function TimesheetsPage() {
  const { user: currentUser, companyId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedTechnician, setSelectedTechnician] = React.useState<string>('all');
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>({ from: new Date(new Date().setDate(1)), to: new Date() });

  const canViewAllTimesheets = hasPermission(currentUser, 'time-entries', 'view_all');
  const canApproveTimesheets = hasPermission(currentUser, 'time-entries', 'approve');
  const canDeleteTimesheets = hasPermission(currentUser, 'time-entries', 'delete');

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<UserProfile[]>({
    queryKey: ['companyUsers', companyId],
    queryFn: () => fetchCompanyUsers(companyId!),
    enabled: !!companyId && canViewAllTimesheets,
  });

  const { data: timeEntries = [], isLoading: isLoadingEntries, error } = useQuery<TimeEntry[]>({
    queryKey: ['timeEntries', companyId, selectedTechnician, dateRange],
    queryFn: () => fetchCompanyTimeEntries(
      companyId!,
      canViewAllTimesheets ? (selectedTechnician === 'all' ? undefined : selectedTechnician) : currentUser?.id,
      dateRange.from,
      dateRange.to
    ),
    enabled: !!companyId && !authLoading,
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => deleteTimeEntry(companyId!, entryId),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Time entry deleted successfully.' });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });
  
  const statusMutation = useMutation({
    mutationFn: ({ entryId, status }: { entryId: string, status: 'approved' | 'rejected' }) => 
      updateTimeEntryStatus(companyId!, entryId, status, currentUser!.id),
    onSuccess: (data, variables) => {
      toast({ title: 'Success', description: `Time entry has been ${variables.status}.` });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
    onError: (error: any) => {
       toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  });

  const filteredEntries = React.useMemo(() => {
    return timeEntries.filter(entry => {
      if (canViewAllTimesheets) {
        return selectedTechnician === 'all' || entry.user_id === selectedTechnician;
      }
      return entry.user_id === currentUser?.id;
    });
  }, [timeEntries, selectedTechnician, canViewAllTimesheets, currentUser?.id]);


  if (authLoading || isLoadingUsers || isLoadingEntries) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
  }
  
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <TimesheetHeader
        selectedTechnician={selectedTechnician}
        onTechnicianChange={setSelectedTechnician}
        dateRange={dateRange}
        onDateChange={setDateRange}
        users={users}
        canViewAllTimesheets={canViewAllTimesheets}
      />

      <Card>
        <CardContent>
          {error ? (
             <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>
          ) : (
            <TimesheetTable
                timeEntries={filteredEntries}
                users={users}
                canApprove={canApproveTimesheets}
                canDelete={canDeleteTimesheets}
                onDelete={(id) => deleteMutation.mutate(id)}
                onStatusChange={(id, status) => statusMutation.mutate({ entryId: id, status })}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
