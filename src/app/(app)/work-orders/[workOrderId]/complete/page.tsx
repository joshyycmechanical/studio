
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle, ArrowLeft, Signature } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { WorkOrder } from '@/types/work-order';
import { fetchWorkOrderById, updateWorkOrder } from '@/services/workOrders';
import Link from 'next/link';
import { SignaturePad } from '@/components/common/SignaturePad';
import { uploadFile } from '@/services/storage';

export default function CompleteWorkOrderPage() {
  const { workOrderId } = useParams() as { workOrderId: string };
  const { user, companyId, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [technicianNotes, setTechnicianNotes] = React.useState('');
  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null);

  const { data: workOrder, isLoading, error } = useQuery<WorkOrder | null>({
    queryKey: ['workOrder', workOrderId],
    queryFn: () => fetchWorkOrderById(companyId!, workOrderId),
    enabled: !!companyId,
    onSuccess: (data) => {
        if (data?.technician_notes) setTechnicianNotes(data.technician_notes);
    }
  });

  const mutation = useMutation({
    mutationFn: async ({ notes, signatureUrl }: { notes: string; signatureUrl: string | null }) => {
        if (!companyId || !workOrder) throw new Error("Missing data for completion.");
        
        let finalSignatureUrl = signatureUrl;
        if (signatureDataUrl && !signatureUrl) { // New signature was drawn
            const blob = await (await fetch(signatureDataUrl)).blob();
            const file = new File([blob], "signature.png", { type: "image/png" });
            const path = `companies/${companyId}/work-orders/${workOrderId}/signatures/${Date.now()}.png`;
            finalSignatureUrl = await uploadFile(file, path);
        }

        const updates: Partial<WorkOrder> = {
            status: 'completed',
            completed_date: new Date(),
            technician_notes: notes,
            customer_signature_url: finalSignatureUrl,
        };
        return updateWorkOrder(companyId, workOrderId, updates);
    },
    onSuccess: () => {
        toast({ title: 'Work Order Completed', description: 'The job has been successfully marked as complete.' });
        queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
        router.push('/work-orders');
    },
    onError: (error: any) => {
        toast({ variant: 'destructive', title: 'Completion Failed', description: error.message });
    }
  });

  const canComplete = !authLoading && hasPermission(user, 'work-orders', 'manage_status');

  if (isLoading || authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  if (!workOrder || !canComplete) return <Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle><AlertDescription>Work order not found or you lack permission.</AlertDescription></Alert>;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <div className="flex items-center gap-4">
            <Link href={`/work-orders/${workOrderId}`}><Button variant="outline" size="icon" className="h-7 w-7"><ArrowLeft className="h-4"/></Button></Link>
            <h1 className="text-2xl font-semibold">Complete Work Order</h1>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Final Details & Sign-Off</CardTitle>
                <CardDescription>Add final notes and capture customer signature to complete the job.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div>
                    <Label htmlFor="technician-notes">Technician Notes</Label>
                    <Textarea id="technician-notes" placeholder="Summarize work performed, parts used, and any follow-up actions needed." value={technicianNotes} onChange={(e) => setTechnicianNotes(e.target.value)} rows={5}/>
                </div>
                <div>
                    <Label>Customer Signature</Label>
                    <div className="mt-2 p-4 border rounded-md">
                        <SignaturePad onSave={setSignatureDataUrl} onClear={() => setSignatureDataUrl(null)} />
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={() => mutation.mutate({ notes: technicianNotes, signatureUrl: workOrder.customer_signature_url })} disabled={!signatureDataUrl || mutation.isPending} className="w-full h-12 text-lg">
                    {mutation.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin"/>}
                    {mutation.isPending ? 'Completing...' : 'Mark as Complete'}
                </Button>
            </CardFooter>
        </Card>
    </main>
  );
}

