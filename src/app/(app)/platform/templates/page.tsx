
'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { ChecklistTemplate } from '@/types/checklist';
import { fetchPlatformChecklistTemplates, deletePlatformChecklistTemplate } from '@/services/checklists';
import { useToast } from '@/hooks/use-toast';
import TemplateList from '@/components/platform/TemplateList';
import { PlatformTemplateDialog } from '@/components/platform/PlatformTemplateDialog';

export default function PlatformTemplatesPage() {
  const { user: currentUser, loading: authLoading, firebaseUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<ChecklistTemplate | null>(null);

  const canManageTemplates = !authLoading && hasPermission(currentUser, 'platform-templates', 'manage');
  
  const { data: templates = [], isLoading, error, refetch } = useQuery<ChecklistTemplate[]>({
    queryKey: ['platformChecklistTemplates'],
    queryFn: async () => {
      if (!firebaseUser) throw new Error("Authentication required.");
      const idToken = await firebaseUser.getIdToken();
      return fetchPlatformChecklistTemplates(idToken);
    },
    enabled: !!firebaseUser && canManageTemplates,
  });

  const deleteMutation = useMutation({
    mutationFn: async (template: ChecklistTemplate) => {
      if (!firebaseUser) throw new Error("Authentication required.");
      const idToken = await firebaseUser.getIdToken();
      return deletePlatformChecklistTemplate(idToken, template.id);
    },
    onSuccess: (_, template) => {
      toast({ title: 'Template Deleted', description: `Template "${template.name}" has been deleted.` });
      queryClient.invalidateQueries({ queryKey: ['platformChecklistTemplates'] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    },
  });

  const handleOpenDialog = (template: ChecklistTemplate | null = null) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleDialogSave = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    refetch(); // Refetch the list after saving
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!canManageTemplates) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>{error?.message || 'You do not have permission to manage platform templates.'}</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <>
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-6 w-6" /> Platform Checklist Templates
                </CardTitle>
                <CardDescription>Create and manage platform-wide checklist templates available to all companies.</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenDialog(null)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : error ? (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>
            ) : (
              <TemplateList
                templates={templates}
                onEdit={handleOpenDialog}
                onDelete={(template) => deleteMutation.mutate(template)}
                isDeleting={deleteMutation.isPending}
              />
            )}
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            Total Templates: {templates.length}
          </CardFooter>
        </Card>
      </main>
      
      <PlatformTemplateDialog
        isOpen={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTemplate(null); }}
        onSave={handleDialogSave}
        template={editingTemplate}
      />
    </>
  );
}
