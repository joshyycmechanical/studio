
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, AlertCircle, Package, Users2, Settings, Loader2, ArrowLeft } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { fetchCompanyByIdApi } from '@/services/companies';
import type { Company } from '@/types/company';

export default function EditCompanyPage() {
    const { user: currentUser, loading: authLoading, firebaseUser } = useAuth();
    const router = useRouter();
    const { companyId } = useParams() as { companyId: string };
    
    const [company, setCompany] = React.useState<Company | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    
    const canView = !authLoading && hasPermission(currentUser, 'platform-companies', 'view');
    
    React.useEffect(() => {
        if (!canView || !firebaseUser) {
            if (!authLoading) setError("Access Denied.");
            setLoading(false);
            return;
        }
        
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const idToken = await firebaseUser.getIdToken();
                const data = await fetchCompanyByIdApi(idToken, companyId);
                if (!data) throw new Error("Company not found.");
                setCompany(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        
        if (firebaseUser) {
            fetchData();
        }
        
    }, [canView, firebaseUser, companyId, authLoading]);
    
    if (loading || authLoading) {
        return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
    }
    
    if (error) {
        return (
             <main className="flex flex-1 flex-col items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                     <Button variant="outline" size="sm" onClick={() => router.push('/platform/companies')} className="mt-4">Back to Companies</Button>
                </Alert>
            </main>
        );
    }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
            <Button variant="link" onClick={() => router.push('/platform/companies')} className="p-0 h-auto text-sm text-muted-foreground mb-2 self-start flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to All Companies
            </Button>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-6 w-6" /> Manage: {company?.name || 'Company'}
          </CardTitle>
          <CardDescription>
            Select a management area below for {company?.name || 'this company'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href={`/platform/companies/${companyId}/modules`}>
                 <Card className="hover:bg-muted/50 hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Package className="h-8 w-8 text-primary" />
                        <div>
                             <CardTitle className="text-lg">Modules</CardTitle>
                            <CardDescription className="text-xs">Manage installed modules</CardDescription>
                        </div>
                    </CardHeader>
                 </Card>
            </Link>
             <Link href={`/platform/companies/${companyId}/users`}>
                 <Card className="hover:bg-muted/50 hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Users2 className="h-8 w-8 text-primary" />
                        <div>
                             <CardTitle className="text-lg">Users</CardTitle>
                            <CardDescription className="text-xs">View and manage users</CardDescription>
                        </div>
                    </CardHeader>
                 </Card>
            </Link>
             <Link href={`/platform/companies/${companyId}/roles`}>
                 <Card className="hover:bg-muted/50 hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Users2 className="h-8 w-8 text-primary" />
                        <div>
                             <CardTitle className="text-lg">Roles</CardTitle>
                            <CardDescription className="text-xs">Manage company roles</CardDescription>
                        </div>
                    </CardHeader>
                 </Card>
            </Link>
             <Link href={`/platform/companies/${companyId}/settings`}>
                 <Card className="hover:bg-muted/50 hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Settings className="h-8 w-8 text-primary" />
                        <div>
                             <CardTitle className="text-lg">Settings</CardTitle>
                            <CardDescription className="text-xs">View/edit advanced settings</CardDescription>
                        </div>
                    </CardHeader>
                 </Card>
            </Link>
        </CardContent>
      </Card>
    </main>
  );
}
