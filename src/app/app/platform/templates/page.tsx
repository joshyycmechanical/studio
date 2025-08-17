
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import TemplateList from '@/components/platform/TemplateList'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { ChecklistTemplate } from '@/types/checklist';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { fetchPlatformChecklistTemplates, createPlatformChecklistTemplate, deletePlatformChecklistTemplate } from '@/services/checklists';

const newTemplateSchema = z.object({
  name: z.string().min(1, 'Template Name is required'),
  description: z.string().optional(),
});
type NewTemplateFormData = z.infer<typeof newTemplateSchema>;


export default function PlatformTemplatesPage() {
  const { user: currentUser, loading: authLoading, firebaseUser } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<NewTemplateFormData>({
    resolver: zodResolver(newTemplateSchema),
    defaultValues: { name: '', description: '' },
  });

  const canManageTemplates = !authLoading && hasPermission(currentUser, 'platform-templates', 'manage');
  
  const fetchData = React.useCallback(async () => {
    if (!canManageTemplates || !firebaseUser) {
        if (!authLoading) setError("You do not have permission to manage platform templates.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    try {
        const idToken = await firebaseUser.getIdToken();
        const fetchedTemplates = await fetchPlatformChecklistTemplates(idToken);
        setTemplates(fetchedTemplates);
    } catch (err: any) {
        setError(err.message || "Failed to load templates.");
        toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
        setLoading(false);
    }
  }, [canManageTemplates, firebaseUser, authLoading, toast]);
  
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTemplate = async (data: NewTemplateFormData) => {
    if (!firebaseUser) return;
    try {
        const idToken = await firebaseUser.getIdToken();
        const newTemplateData = {
            name: data.name,
            description: data.description || null,
            fields: [], // Start with empty fields
        };
        await createPlatformChecklistTemplate(idToken, newTemplateData);
        toast({ title: 'Template Created', description: `Template "${data.name}" has been created.` });
        reset();
        setDialogOpen(false);
        fetchData();
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Creation Failed', description: err.message });
    }
  };
  
  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!firebaseUser) return;
    try {
        const idToken = await firebaseUser.getIdToken();
        await deletePlatformChecklistTemplate(idToken, templateId);
        toast({ title: "Template Deleted", description: `Template "${templateName}" has been deleted.` });
        fetchData(); // Refetch list
    } catch (err: any) {
        toast({ variant: "destructive", title: "Delete Failed", description: err.message });
    }
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!canManageTemplates) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>{error || 'You do not have permission to manage platform templates.'}</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                    <DialogTrigger asChild>
                        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add New Template</Button>
                    </DialogTrigger>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : error ? (
                    <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
                ) : (
                    <TemplateList templates={templates} onDelete={handleDeleteTemplate} />
                )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
                Total Templates: {templates.length}
            </CardFooter>
        </Card>
      </main>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleCreateTemplate)}>
          <DialogHeader>
            <DialogTitle>Add New Checklist Template</DialogTitle>
            <DialogDescription>Create a new platform-wide checklist template. Fields can be added after creation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} placeholder="e.g., Standard HVAC PM" />} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Controller name="description" control={control} render={({ field }) => <Textarea id="description" {...field} placeholder="(Optional) Describe what this template is for." />} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
