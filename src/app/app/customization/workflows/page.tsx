
'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, AlertCircle, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { WorkflowStatusConfig, WorkflowTrigger, WorkflowActionType } from '@/types/workflow';
import { fetchWorkflowStatuses, fetchWorkflowTriggers, createWorkflowTrigger, updateWorkflowTrigger, deleteWorkflowTrigger } from '@/services/workflows';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const triggerSchema = z.object({
    name: z.string().min(1, "Trigger name is required."),
    trigger_event: z.enum(['on_enter', 'on_exit']),
    action_type: z.string().min(1, "Action is required."),
});
type TriggerFormData = z.infer<typeof triggerSchema>;

const TriggerDialog = ({ status, trigger, onSave }: { status?: WorkflowStatusConfig, trigger?: WorkflowTrigger, onSave: () => void }) => {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);

    const { control, handleSubmit, reset } = useForm<TriggerFormData>({
        resolver: zodResolver(triggerSchema),
        defaultValues: trigger ? {
            name: trigger.name,
            trigger_event: trigger.trigger_event,
            action_type: trigger.action.type,
        } : { trigger_event: 'on_enter' }
    });
    
    const mutation = useMutation({
        mutationFn: async (data: TriggerFormData) => {
            const payload: Omit<WorkflowTrigger, 'id' | 'company_id' | 'created_at' | 'created_by'> = {
                name: data.name,
                workflow_status_name: trigger?.workflow_status_name || status!.name,
                trigger_event: data.trigger_event,
                action: { type: data.action_type as WorkflowActionType, params: {} }
            };
            if (trigger) {
                await updateWorkflowTrigger(trigger.id, payload);
            } else {
                await createWorkflowTrigger(payload);
            }
        },
        onSuccess: () => {
            toast({ title: "Success", description: `Workflow trigger ${trigger ? 'updated' : 'created'}.` });
            onSave();
            reset();
            setOpen(false);
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? (
                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                ) : (
                    <Button size="sm" variant="outline"><PlusCircle className="mr-2 h-4 w-4"/>Add Trigger</Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>{trigger ? 'Edit' : 'Add'} Trigger to "{status?.name || trigger?.workflow_status_name}"</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
                    <div><Label>Trigger Name</Label><Controller name="name" control={control} render={({ field }) => <Input {...field} />} /></div>
                    <div><Label>Event</Label><Controller name="trigger_event" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="on_enter">On Enter</SelectItem><SelectItem value="on_exit">On Exit</SelectItem></SelectContent></Select>} /></div>
                    <div><Label>Action</Label><Controller name="action_type" control={control} render={({ field }) => <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="create_invoice_draft">Create Invoice Draft</SelectItem><SelectItem value="notify_customer">Notify Customer</SelectItem></SelectContent></Select>} /></div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={mutation.isPending}>Save</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default function WorkflowSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const canView = !authLoading && hasPermission(user, 'customization', 'view');
    const canEdit = !authLoading && hasPermission(user, 'customization', 'edit');
    
    const { data: statuses = [], isLoading: isLoadingStatuses, error: errorStatuses } = useQuery<WorkflowStatusConfig[]>({
        queryKey: ['workflowStatuses'], queryFn: fetchWorkflowStatuses, enabled: canView,
    });
    const { data: triggers = [], isLoading: isLoadingTriggers, error: errorTriggers } = useQuery<WorkflowTrigger[]>({
        queryKey: ['workflowTriggers'], queryFn: fetchWorkflowTriggers, enabled: canView,
    });
    
    const deleteMutation = useMutation({
        mutationFn: deleteWorkflowTrigger,
        onSuccess: () => {
            toast({ title: "Success", description: "Workflow trigger deleted." });
            queryClient.invalidateQueries({ queryKey: ['workflowTriggers'] });
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        },
    });

    const isLoading = authLoading || isLoadingStatuses || isLoadingTriggers;
    const error = errorStatuses || errorTriggers;

    if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2/></div>;
    if (!canView || error) return <Alert variant="destructive"><AlertCircle/><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error)?.message || "Access Denied."}</AlertDescription></Alert>;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 md:gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Workflow Automation</CardTitle>
                    <CardDescription>Define actions that trigger when a work order's status changes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {statuses.map(status => (
                        <div key={status.id}>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-semibold" style={{ color: status.color }}>{status.name}</h3>
                                {canEdit && <TriggerDialog status={status} onSave={() => queryClient.invalidateQueries({ queryKey: ['workflowTriggers'] })} />}
                            </div>
                            <div className="border-l-4 pl-4 space-y-2" style={{ borderColor: status.color }}>
                                {triggers.filter(t => t.workflow_status_name === status.name).map(trigger => (
                                    <Card key={trigger.id} className="p-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-semibold">{trigger.name}</p>
                                                <p className="text-sm text-muted-foreground">When: {trigger.trigger_event === 'on_enter' ? 'Entering' : 'Exiting'} | Action: {trigger.action.type.replace(/_/g, ' ')}</p>
                                            </div>
                                            {canEdit && <div className="space-x-2">
                                                <TriggerDialog trigger={trigger} onSave={() => queryClient.invalidateQueries({ queryKey: ['workflowTriggers'] })} />
                                                <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the trigger "{trigger.name}".</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(trigger.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </main>
    )
}
