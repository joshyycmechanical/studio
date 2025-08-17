
'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, PlusCircle, ShieldCheck, Users, Edit } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Role } from '@/types/role';
import { fetchCompanyRoles } from '@/services/roles'; // This function needs to be created

export default function RolesListPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const router = useRouter();

  const canManageRoles = !authLoading && hasPermission(user, 'roles:manage');

  const { data: roles = [], isLoading, error } = useQuery<Role[]>({
    queryKey: ['roles', companyId],
    queryFn: () => fetchCompanyRoles(companyId!),
    enabled: !!companyId && canManageRoles,
  });

  if (authLoading || isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canManageRoles) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to manage roles.</AlertDescription>
        </Alert>
      </main>
    );
  }
  
  if (error) {
    return <main className="p-4"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6"/> Roles & Permissions</h1>
          <p className="text-muted-foreground">Define what users can see and do in your organization.</p>
        </div>
        <Button onClick={() => router.push('/settings/roles/new')}>
          <PlusCircle className="mr-2 h-4"/> New Role
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map(role => (
          <Card key={role.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {role.name}
              </CardTitle>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{role.user_count || 0} users in this role</span>
               </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => router.push(`/settings/roles/${role.id}`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Role & Permissions
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  );
}
