
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, AlertCircle, ShieldAlert, Edit, Wrench } from 'lucide-react';
import { format } from "date-fns";
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Deficiency } from '@/types/deficiency';
import { fetchCompanyDeficiencies } from '@/services/deficiencies';
import Link from 'next/link';

export default function DeficienciesPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const router = useRouter();

  const canView = !authLoading && hasPermission(user, 'deficiencies', 'view');
  const canCreate = !authLoading && hasPermission(user, 'deficiencies', 'create');
  const canEdit = !authLoading && hasPermission(user, 'deficiencies', 'edit');

  const { data: deficiencies = [], isLoading, error } = useQuery<Deficiency[]>({
    queryKey: ['deficiencies', companyId],
    queryFn: () => fetchCompanyDeficiencies(companyId!),
    enabled: !!companyId && canView,
  });

  if (authLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canView) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to view deficiencies.</AlertDescription>
        </Alert>
      </main>
    );
  }
  
  if (error) {
       return <main className="flex flex-1 items-center justify-center p-4"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 md:gap-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldAlert /> Deficiencies</CardTitle>
            <CardDescription>Track and manage all reported equipment and location issues.</CardDescription>
          </div>
          {canCreate && (
            <Button onClick={() => router.push('/deficiencies/new')}>
              <PlusCircle className="mr-2 h-4 w-4" /> Log Deficiency
            </Button>
          )}
        </CardHeader>
        <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Reported On</TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deficiencies.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No deficiencies found.</TableCell></TableRow>
                ) : (
                  deficiencies.map((def) => (
                      <TableRow key={def.id}>
                        <TableCell className="font-medium max-w-sm truncate">{def.description}</TableCell>
                        <TableCell><Badge className="capitalize">{def.status.replace('-', ' ')}</Badge></TableCell>
                        <TableCell><Badge variant={def.severity === 'critical' || def.severity === 'high' ? 'destructive' : 'secondary'} className="capitalize">{def.severity}</Badge></TableCell>
                        <TableCell>{format(def.created_at, 'PPP')}</TableCell>
                        <TableCell>
                          {def.related_work_order_id ? (
                            <Link href={`/work-orders/${def.related_work_order_id}`} className="text-primary hover:underline">
                                View WO
                            </Link>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-auto py-1 px-2 text-xs"
                              onClick={() => router.push(`/work-orders/new?deficiencyId=${def.id}`)}
                            >
                              <Wrench className="mr-1 h-3 w-3" /> Create WO
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="icon" onClick={() => router.push(`/deficiencies/${def.id}`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </CardContent>
         <CardFooter className="text-sm text-muted-foreground">
             Total Deficiencies: {deficiencies.length}
         </CardFooter>
      </Card>
    </main>
  );
}
