
'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PlusCircle, Edit, Trash2, ClipboardCheck, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { ChecklistTemplate } from '@/types/checklist';
import { format } from 'date-fns';
import { fetchCompanyChecklistTemplates, deleteChecklistTemplate } from '@/services/checklists';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';


export default function ChecklistsPage() {
  const { user, companyId } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const canView = hasPermission(user, 'checklists', 'view');
  const canManage = hasPermission(user, 'checklists', 'manage');

  const { data, isLoading: loadingData, error } = useQuery<ChecklistTemplate[]>({
    queryKey: ['checklistTemplates', companyId],
    queryFn: () => fetchCompanyChecklistTemplates(companyId!),
    enabled: !!companyId && canView,
  });

  // Safely handle data: default to an empty array if data is null or undefined
  const templates = data ?? [];
  
  const deleteMutation = useMutation({
    mutationFn: ({ templateId, templateName }: { templateId: string, templateName: string }) => {
        if (!companyId) throw new Error("Company ID is missing.");
        return deleteChecklistTemplate(companyId, templateId);
    },
    onSuccess: (_, variables) => {
        toast({ title: "Template Deleted", description: `Template "${variables.templateName}" deleted.` });
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates', companyId] });
    },
    onError: (error: any) => {
        toast({ variant: "destructive", title: "Delete Failed", description: error.message || "Could not delete template." });
    }
  });


  const filteredTemplates = useMemo(() => {
    // Now that `templates` is guaranteed to be an array, this is safe.
    return templates.filter(template => {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = template.name.toLowerCase().includes(searchLower);
      const descriptionMatch = template.description?.toLowerCase().includes(searchLower);
      return nameMatch || !!descriptionMatch;
    });
  }, [templates, searchTerm]);

  const handleCreateTemplate = () => {
    if (!canManage) return;
    router.push('/checklists/new');
  };

  const handleEditTemplate = (templateId: string) => {
    if (!canManage) return;
    router.push(`/checklists/${templateId}`);
  };

   const handleDeleteTemplate = (templateId: string, templateName: string) => {
     if (!canManage) return;
     deleteMutation.mutate({ templateId, templateName });
   }
   
   if (!canView) {
       return (
           <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
             <Alert variant="destructive" className="m-4 max-w-md">
               <AlertCircle className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle>
               <AlertDescription>You do not have permission to view checklists.</AlertDescription>
             </Alert>
           </main>
        );
    }
    
    if (error) {
        return <main className="p-4"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></main>
    }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
           <div className="flex justify-between items-center gap-4 flex-wrap">
             <div className="flex-grow">
                 <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-6 w-6" /> Checklist Templates</CardTitle>
                 <CardDescription>Create and manage reusable checklists for jobs and equipment.</CardDescription>
             </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                 {canManage && (
                   <Button size="sm" onClick={handleCreateTemplate} disabled={loadingData || deleteMutation.isPending}>
                     {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                     Create Template
                   </Button>
                 )}
              </div>
           </div>
             <div className="mt-4">
                 <Input placeholder="Search by name or description..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" disabled={loadingData}/>
             </div>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Fields</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">{templates.length === 0 ? "No checklist templates found." : "No templates match your search."}</TableCell></TableRow>
                ) : (
                  filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-sm truncate">{template.description || '-'}</TableCell>
                        <TableCell className="text-center">{template.fields?.length ?? 0}</TableCell>
                        <TableCell>{format(new Date(template.created_at), 'PP')}</TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          {canManage && (
                            <>
                              <Button variant="outline" size="icon" onClick={() => handleEditTemplate(template.id)} title="Edit Template" disabled={deleteMutation.isPending}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon" title="Delete Template" disabled={deleteMutation.isPending && deleteMutation.variables?.templateId === template.id}>
                                    {deleteMutation.isPending && deleteMutation.variables?.templateId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span className="sr-only">Delete</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <VisuallyHidden><AlertDialogTitle>Delete Template</AlertDialogTitle></VisuallyHidden>
                                    <AlertDialogDescription>This action cannot be undone. This will permanently delete the template "{template.name}".</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteTemplate(template.id, template.name)} disabled={deleteMutation.isPending}>
                                      {deleteMutation.isPending && deleteMutation.variables?.templateId === template.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
         <CardFooter className="text-sm text-muted-foreground">
             Total Templates: {filteredTemplates.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
         </CardFooter>
      </Card>
    </main>
  );
}
