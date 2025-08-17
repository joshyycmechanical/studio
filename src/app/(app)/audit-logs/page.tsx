'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookText, Loader2, AlertCircle, Filter, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { AuditLog } from '@/types/audit-log';
import { fetchAuditLogs } from '@/services/audit-logs';
import { format } from 'date-fns';

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const canViewLogs = !authLoading && hasPermission(user, 'audit-logs', 'view');

  const { data: logs = [], isLoading: loadingData, error, refetch, isRefetching } = useQuery<AuditLog[]>({
    queryKey: ['auditLogs'],
    queryFn: () => fetchAuditLogs(200), // Fetch up to 200 recent logs
    enabled: canViewLogs, // Only fetch if user has permission
  });

  // State for filtering
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredLogs = React.useMemo(() => {
    if (!logs) return [];
    const searchLower = searchTerm.toLowerCase();
    if (!searchLower) return logs;
    return logs.filter(log =>
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.entity_type?.toLowerCase().includes(searchLower) ||
      log.entity_id?.toLowerCase().includes(searchLower) ||
      log.details?.ip_address?.includes(searchLower)
    );
  }, [logs, searchTerm]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!canViewLogs) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to view audit logs.</AlertDescription>
        </Alert>
      </main>
    );
  }
  
  if (error) {
       return (
         <main className="flex flex-1 flex-col items-center justify-center p-4">
            <Alert variant="destructive" className="m-4 max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Data</AlertTitle>
                <AlertDescription>{(error as Error).message}</AlertDescription>
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
                    <BookText className="h-6 w-6" /> Audit Logs
                 </CardTitle>
                 <CardDescription>View system change history and user activity.</CardDescription>
             </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                 <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loadingData || isRefetching}>
                    {isRefetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                     Refresh
                 </Button>
                 <Button variant="outline" size="sm" disabled>
                    <Filter className="mr-2 h-4 w-4" /> Filter
                 </Button>
              </div>
           </div>
            <div className="mt-4">
                <Input
                   placeholder="Search by email, action, entity..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="max-w-md"
                   disabled={loadingData}
               />
            </div>
        </CardHeader>
        <CardContent>
          {(loadingData && !logs.length) ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{format(log.timestamp, 'PPp')}</TableCell>
                        <TableCell>{log.user_email || log.user_id || 'System'}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{log.action.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell className="text-xs">{log.entity_type ? `${log.entity_type}:${log.entity_id}` : '-'}</TableCell>
                        <TableCell className="text-xs font-mono">{log.details?.ip_address || '-'}</TableCell>
                      </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter className="text-sm text-muted-foreground">
             Showing latest {filteredLogs.length} log entries.
         </CardFooter>
      </Card>
    </main>
  );
}
