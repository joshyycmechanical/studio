
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ShieldAlert, ArrowLeft, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Deficiency } from '@/types/deficiency';
import { fetchDeficiencyById } from '@/services/deficiencies';
import Link from 'next/link';

export default function DeficiencyDetailPage() {
    const { deficiencyId } = useParams() as { deficiencyId: string };
    const { user, companyId, loading: authLoading } = useAuth();
    const router = useRouter();

    const canView = !authLoading && hasPermission(user, 'deficiencies', 'view');
    const canCreateEstimate = !authLoading && hasPermission(user, 'estimates', 'create');

    const { data: deficiency, isLoading, error } = useQuery<Deficiency | null>({
        queryKey: ['deficiency', deficiencyId],
        queryFn: () => fetchDeficiencyById(companyId!, deficiencyId),
        enabled: !!companyId && !!deficiencyId && canView,
    });

    const handleCreateEstimate = () => {
        // We'll implement the logic for this in a future step
        console.log("Creating estimate for deficiency:", deficiencyId);
        // This would likely redirect to a new estimate page with pre-filled info
        // router.push(`/estimates/new?deficiencyId=${deficiencyId}`);
    };

    if (authLoading || isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2/></div>;
    }
    
    if (error || !deficiency) {
        return <main><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error)?.message || "Deficiency not found."}</AlertDescription></Alert></main>;
    }

    if (!canView) {
        return <main><Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle></Alert></main>;
    }

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8">
            <div className="flex items-center gap-4">
                <Link href="/deficiencies"><Button variant="outline" size="icon"><ArrowLeft/></Button></Link>
                <div><h1 className="text-2xl font-semibold">Deficiency Details</h1></div>
                <div className="ml-auto">
                    {canCreateEstimate && (
                        <Button onClick={handleCreateEstimate}><PlusCircle className="mr-2 h-4"/> Create Estimate</Button>
                    )}
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldAlert/> {deficiency.description}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p><strong>Status:</strong> {deficiency.status}</p>
                    <p><strong>Severity:</strong> {deficiency.severity}</p>
                    <p><strong>Location:</strong> {deficiency.location_id}</p>
                    <p><strong>Equipment:</strong> {deficiency.equipment_id || 'N/A'}</p>
                    <p><strong>Reported By:</strong> {deficiency.reported_by}</p>
                    <p><strong>Reported On:</strong> {new Date(deficiency.created_at).toLocaleString()}</p>
                </CardContent>
            </Card>
        </main>
    );
}
