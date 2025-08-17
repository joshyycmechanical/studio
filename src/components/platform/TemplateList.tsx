
'use client';

import * as React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { ChecklistTemplate } from '@/types/checklist';

interface TemplateListProps {
    templates: ChecklistTemplate[];
    onEdit: (template: ChecklistTemplate) => void;
    onDelete: (template: ChecklistTemplate) => void;
    isDeleting: boolean;
}

export default function TemplateList({ templates, onEdit, onDelete, isDeleting }: TemplateListProps) {
   const [deletingId, setDeletingId] = React.useState<string | null>(null);

   const handleDeleteClick = (template: ChecklistTemplate) => {
      setDeletingId(template.id);
      onDelete(template);
   }

  return (
    <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Fields</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 && (
                 <TableRow>
                     <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                         No platform templates found.
                     </TableCell>
                 </TableRow>
             )}
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">{template.description || '-'}</TableCell>
                <TableCell className="text-center">{template.fields?.length ?? 0}</TableCell>
                <TableCell>{new Date(template.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="outline" size="icon" onClick={() => onEdit(template)} title="Edit Template">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit Template</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button variant="destructive" size="icon" title="Delete Template" disabled={isDeleting && deletingId === template.id}>
                        {isDeleting && deletingId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        <span className="sr-only">Delete Template</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                       <AlertDialogHeader>
                         <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                         <AlertDialogDescription>
                           This action cannot be undone. This will permanently delete the template
                           "{template.name}".
                         </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                         <AlertDialogCancel>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                             className="bg-destructive hover:bg-destructive/90"
                             onClick={() => handleDeleteClick(template)}
                             disabled={isDeleting}
                          >
                            {isDeleting && deletingId === template.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                           Delete Template
                         </AlertDialogAction>
                       </AlertDialogFooter>
                     </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
