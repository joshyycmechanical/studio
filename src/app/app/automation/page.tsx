
'use client';

import * as React from 'react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Edit, Loader2, AlertCircle, PlusCircle, Palette, Zap, Play, MoveRight, Clock, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { WorkflowStatusConfig, WorkflowStatusGroup, WorkflowTrigger } from '@/types/workflow';
import { ChromePicker, ColorResult } from 'react-color';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
    fetchCompanyWorkflowStatuses,
    updateWorkflowStatus,
    fetchCompanyWorkflowTriggers
} from '@/services/automation';
import { useToast } from '@/hooks/use-toast';

export default function AutomationPage() {
  const { user, companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingStatus, setEditingStatus] = useState<WorkflowStatusConfig | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#ffffff');

  const canManageAutomation = hasPermission(user, 'automation', 'manage');

  const { data: statuses = [], isLoading: isLoadingStatuses, error: statusesError } = useQuery<WorkflowStatusConfig[]>({
    queryKey: ['workflowStatuses', companyId],
    queryFn: () => fetchCompanyWorkflowStatuses(companyId!),
    enabled: !!companyId && canManageAutomation,
  });

  const { data: triggers = [], isLoading: isLoadingTriggers, error: triggersError } = useQuery<WorkflowTrigger[]>({
    queryKey: ['workflowTriggers', companyId],
    queryFn: () => fetchCompanyWorkflowTriggers(companyId!),
    enabled: !!companyId && canManageAutomation,
  });
  
  const loadingData = isLoadingStatuses || isLoadingTriggers;
  const error = statusesError || triggersError;

  const updateMutation = useMutation({
    mutationFn: (updatedStatusData: Partial<Omit<WorkflowStatusConfig, 'id' | 'company_id'>>) => {
        if (!editingStatus || !companyId || !canManageAutomation) throw new Error("Cannot update status.");
        return updateWorkflowStatus(companyId, editingStatus.id, updatedStatusData);
    },
    onSuccess: (_, variables) => {
        toast({ title: "Status Updated", description: `Status "${variables.name}" saved.` });
        queryClient.invalidateQueries({ queryKey: ['workflowStatuses', companyId] });
        setOpenDialog(false);
        setEditingStatus(null);
    },
    onError: (err: any) => {
        toast({ variant: "destructive", title: "Save Failed", description: err.message || "Could not save status changes." });
    }
  });


  const handleOpenEditDialog = (status: WorkflowStatusConfig) => {
    setEditingStatus(status);
    setEditName(status.name);
    setEditColor(status.color);
    setOpenDialog(true);
  };

  const handleColorChange = (color: ColorResult) => {
    setEditColor(color.hex);
  };

  const handleSaveChanges = async () => {
    const updatedStatusData: Partial<Omit<WorkflowStatusConfig, 'id' | 'company_id'>> = {
      name: editName.trim(),
      color: editColor,
    };
    updateMutation.mutate(updatedStatusData);
  };
  
    // Helper to render a list of triggers for a given event type
  const renderTriggerList = (eventTriggers: WorkflowTrigger[]) => {
    if (eventTriggers.length === 0) {
      return <p className="text-xs text-muted-foreground p-2">No triggers configured for this event.</p>;
    }
    return (
      <div className="space-y-2">
        {eventTriggers.map(trigger => (
          <div key={trigger.id} className="text-sm p-2 border rounded-md bg-background">
            <p className="font-medium">{trigger.name}</p>
            {trigger.actions.length > 0 && (
                 <p className="text-xs text-muted-foreground capitalize">
                    {trigger.actions.length} action(s): {trigger.actions.map(a => a.type.replace(/_/g, ' ')).slice(0, 3).join(', ')}{trigger.actions.length > 3 ? '...' : ''}
                 </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderStatusGroup = (group: WorkflowStatusGroup, title: string) => {
    const groupStatuses = statuses.filter(s => s.group === group);
    if (groupStatuses.length === 0 && !loadingData) return null;

    return (
      <div key={group} className="mb-8">
        <h3 className="text-xl font-semibold mb-4 capitalize">{title}</h3>
        {loadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2].map(i => <Card key={`skel-${group}-${i}`} className="opacity-50 animate-pulse"><CardContent className="p-4 h-32 bg-muted rounded-md"></CardContent></Card>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {groupStatuses.map((status) => {
               const triggerCount = triggers.filter(t => t.status_id === status.id).length;
               return (
                  <Card key={status.id} className="relative group hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }}></span>
                        <span className="font-medium">{status.name}</span>
                      </div>
                       <div className="flex items-center text-xs text-muted-foreground mt-2">
                         <Zap className="h-3 w-3 mr-1" />
                         <span>{triggerCount} Automation(s)</span>
                       </div>
                      {canManageAutomation && (
                          <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleOpenEditDialog(status)} title="Edit Status & Automations">
                              <Edit className="h-4 w-4" /><span className="sr-only">Edit Status</span>
                          </Button>
                      )}
                    </CardContent>
                  </Card>
                )})}
          </div>
        )}
         {group !== 'cancelled' && <Separator className="my-8" />}
      </div>
    );
  };


  if (!canManageAutomation) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to manage workflow automation.</AlertDescription>
        </Alert>
      </main>
    );
  }
  
  if (error) {
     return <main className="flex flex-1 items-center justify-center p-4"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></main>;
  }
  
  const onEnterTriggers = editingStatus ? triggers.filter(t => t.status_id === editingStatus.id && t.event === 'on_enter') : [];
  const onExitTriggers = editingStatus ? triggers.filter(t => t.status_id === editingStatus.id && t.event === 'on_exit') : [];
  const onTimeoutTriggers = editingStatus ? triggers.filter(t => t.status_id === editingStatus.id && t.event === 'on_timeout') : [];


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 border-b">
          <CardTitle className="flex items-center gap-2"><Bot className="h-6 w-6" /> Workflow Automation</CardTitle>
          <CardDescription>Configure the status flow for your work orders and set up automated triggers and actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {renderStatusGroup('start', 'Start')}
          {renderStatusGroup('active', 'Active')}
          {renderStatusGroup('final', 'Final')}
          {renderStatusGroup('cancelled', 'Cancelled')}
           {!loadingData && statuses.length === 0 && <p className="text-muted-foreground text-center py-8">No workflow statuses found. Seed data might be needed.</p>}
        </CardContent>
      </Card>
      <Dialog open={openDialog} onOpenChange={(open) => { if (!open) setEditingStatus(null); setOpenDialog(open); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Status: {editingStatus?.name}</DialogTitle>
            <DialogDescription>Customize the display name, color, and automations for this status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <fieldset className="grid grid-cols-4 items-center gap-4 border p-4 rounded-md">
               <legend className="text-sm font-medium mb-2 px-1 -ml-1">Basic Settings</legend>
                <Label htmlFor="status-name" className="text-right col-span-1">Name</Label>
                <Input id="status-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="col-span-3" disabled={updateMutation.isPending}/>
                <Label htmlFor="status-color" className="text-right col-span-1">Color</Label>
                 <div className="col-span-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={updateMutation.isPending}>
                                <div className="w-4 h-4 rounded-full mr-2 border" style={{ backgroundColor: editColor }}></div>{editColor}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-0">
                            <ChromePicker color={editColor} onChangeComplete={handleColorChange} disableAlpha={true} />
                        </PopoverContent>
                    </Popover>
                 </div>
            </fieldset>
             <fieldset className="grid gap-4 border p-4 rounded-md">
                <legend className="text-sm font-medium mb-2 px-1 -ml-1">Automations (Triggers & Actions)</legend>
                <p className="text-xs text-muted-foreground col-span-4">Define actions that happen automatically based on this status.</p>
                 <div className="col-span-4 space-y-2">
                     <Label className="flex items-center gap-1"><Play className="h-4 w-4 text-green-600"/> On Enter</Label>
                     <Card className="bg-muted/30 p-3">{renderTriggerList(onEnterTriggers)}<Button variant="outline" size="sm" className="mt-2" disabled><PlusCircle className="h-3 w-3 mr-1"/> Add Action</Button></Card>
                 </div>
                 <div className="col-span-4 space-y-2">
                     <Label className="flex items-center gap-1"><MoveRight className="h-4 w-4 text-red-600"/> On Exit</Label>
                      <Card className="bg-muted/30 p-3">{renderTriggerList(onExitTriggers)}<Button variant="outline" size="sm" className="mt-2" disabled><PlusCircle className="h-3 w-3 mr-1"/> Add Action</Button></Card>
                 </div>
                 <div className="col-span-4 space-y-2">
                      <Label className="flex items-center gap-1"><Clock className="h-4 w-4 text-blue-600"/> On Timeout</Label>
                       <Card className="bg-muted/30 p-3">{renderTriggerList(onTimeoutTriggers)}<Button variant="outline" size="sm" className="mt-2" disabled><PlusCircle className="h-3 w-3 mr-1"/> Add Timeout Action</Button></Card>
                 </div>
            </fieldset>
             <fieldset className="grid gap-4 border p-4 rounded-md">
                <legend className="text-sm font-medium mb-2 px-1 -ml-1">Permissions (Not Implemented)</legend>
                 <div className="col-span-4 space-y-2">
                    <Label className="flex items-center gap-1"><UserCheck className="h-4 w-4"/> Roles allowed to set this status</Label>
                     <p className="text-xs text-muted-foreground">Configure which roles can transition a Work Order *into* this status.</p>
                     <Button variant="outline" size="sm" className="mt-2" disabled>Manage Permissions</Button>
                </div>
            </fieldset>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="button" onClick={handleSaveChanges} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
