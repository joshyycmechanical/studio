
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { UserCog, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { fetchCompanyRoles } from '@/services/roles'; // Import the service
import type { Role } from '@/types/role';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function RolesPage() {
  const { user, companyId, loading: authLoading } = useAuth();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const canViewRoles = !authLoading && hasPermission(user, 'roles', 'view');

  React.useEffect(() => {
    if (!canViewRoles) {
      if (!authLoading) setError("You do not have permission to view roles.");
      setLoadingData(false);
      return;
    }
    if (companyId) {
      const fetchData = async () => {
        setLoadingData(true);
        setError(null);
        try {
          const fetchedRoles = await fetchCompanyRoles(companyId);
          setRoles(fetchedRoles);
        } catch (err: any) {
          setError(err.message || "Failed to load roles.");
          console.error("Error fetching roles:", err);
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [companyId, canViewRoles, authLoading]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!canViewRoles) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>{error || 'You do not have permission to view roles and permissions.'}</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-6 w-6" /> Roles & Permissions
          </CardTitle>
          <CardDescription>
            Review the roles and their associated permissions within your company. Full role customization is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
             <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Roles</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {roles.map(role => (
                <AccordionItem value={role.id} key={role.id}>
                  <AccordionTrigger className="text-lg hover:no-underline">
                    {role.name}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground mb-4">{role.description}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                       {Object.entries(role.permissions).map(([moduleSlug, perms]) => {
                         const canAccess = (typeof perms === 'boolean' && perms) || (typeof perms === 'object' && perms.can_access);
                         if (canAccess) {
                            return (
                                <div key={moduleSlug} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                    <CheckCircle className="h-4 w-4 text-green-600"/>
                                    <span className="capitalize">{moduleSlug.replace(/_/g, ' ')}</span>
                                </div>
                            );
                         }
                         return null;
                       })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
         <CardFooter className="text-sm text-muted-foreground">
             Total Roles: {roles.length}
         </CardFooter>
      </Card>
    </main>
  );
}
