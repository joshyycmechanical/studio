
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input'; // Keep Input if needed for other parts, though not directly for name in Dialog for Templates
import { PlusCircle, Edit, Trash2, FilePlus, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { FieldTemplate, CustomField, CustomFieldEntityType } from '@/types/custom-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; // Updated Dialog imports
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
// Import Firestore service functions
import {
    fetchCompanyFieldTemplates,
    createFieldTemplate,
    updateFieldTemplate,
    deleteFieldTemplate,
    fetchCompanyCustomFields
} from '@/services/customization';

const availableEntityTypes: CustomFieldEntityType[] = ['work-order', 'customer', 'location', 'equipment', 'user', 'invoice', 'estimate'];

export default function FieldTemplatesPage() {
    const { user, companyId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [templates, setTemplates] = useState<FieldTemplate[]>([]);
    const [availableFields, setAvailableFields] = useState<CustomField[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<FieldTemplate | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);

    // Form state for the dialog
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [templateEntityType, setTemplateEntityType] = useState<CustomFieldEntityType>('work-order');
    const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());

    const canManageTemplates = !authLoading && hasPermission(user, 'templates', 'manage');

    const fetchData = useCallback(async () => {
        if (!companyId || !canManageTemplates) {
            setLoadingData(false);
            setTemplates([]);
            setAvailableFields([]);
            return;
        }
        setLoadingData(true);
        try {
            console.log(`[FieldTemplatesPage] Fetching data for company ${companyId}`);
            const [fetchedTemplates, fetchedFields] = await Promise.all([
                 fetchCompanyFieldTemplates(companyId),
                 fetchCompanyCustomFields(companyId)
            ]);
            setTemplates(fetchedTemplates);
            setAvailableFields(fetchedFields);
        } catch (error: any) {
            console.error("[FieldTemplatesPage] Error fetching data:", error);
            toast({ variant: 'destructive', title: 'Error Loading Data', description: error.message || 'Could not load field templates or custom fields.' });
            setTemplates([]);
            setAvailableFields([]);
        } finally {
            setLoadingData(false);
        }
    }, [companyId, canManageTemplates, toast]);


    useEffect(() => {
        if (!authLoading) {
            fetchData();
        }
    }, [fetchData, authLoading]);

    const fieldsForEntityType = useMemo(() => {
        return availableFields.filter(f => f.entity_type === templateEntityType).sort((a,b) => a.sort_order - b.sort_order);
    }, [availableFields, templateEntityType]);

    const handleOpenDialog = (template: FieldTemplate | null = null) => {
        setDialogError(null);
        setEditingTemplate(template);
        if (template) {
            setTemplateName(template.name);
            setTemplateDescription(template.description ?? '');
            setTemplateEntityType(template.entity_type);
            setSelectedFieldIds(new Set(template.custom_field_ids));
        } else {
            setTemplateName('');
            setTemplateDescription('');
            setTemplateEntityType('work-order');
            setSelectedFieldIds(new Set());
        }
        setOpenDialog(true);
    };

     const closeDialog = () => {
        setOpenDialog(false);
         setTimeout(() => {
             setEditingTemplate(null);
             setTemplateName('');
             setTemplateDescription('');
             setTemplateEntityType('work-order');
             setSelectedFieldIds(new Set());
         }, 150);
     }

    const handleFieldSelectionChange = (fieldId: string, checked: boolean) => {
        setSelectedFieldIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(fieldId);
            } else {
                newSet.delete(fieldId);
            }
            return newSet;
        });
    };

    const handleSaveTemplate = async () => {
         setDialogError(null);
         if (!companyId || !canManageTemplates) return;
         if (!templateName.trim()) {
            const errorMsg = 'Template Name is required.';
            setDialogError(errorMsg);
             toast({ variant: 'destructive', title: 'Validation Error', description: errorMsg });
            return;
         }
          if (selectedFieldIds.size === 0) {
            const errorMsg = 'Please select at least one custom field for the template.';
            setDialogError(errorMsg);
            toast({ variant: 'destructive', title: 'Validation Error', description: errorMsg });
            return;
         }

        setIsSaving(true);
        const templateData = {
            name: templateName.trim(),
            description: templateDescription.trim() || null,
            entity_type: templateEntityType,
            custom_field_ids: Array.from(selectedFieldIds),
        };

        try {
            if (editingTemplate) {
                await updateFieldTemplate(companyId, editingTemplate.id, templateData);
                toast({ title: 'Template Updated', description: `Template "${templateData.name}" updated.` });
            } else {
                await createFieldTemplate(companyId, templateData);
                toast({ title: 'Template Created', description: `Template "${templateData.name}" created.` });
            }
            closeDialog();
            fetchData();
        } catch (error: any) {
            const errorMessage = error.message || 'Could not save the field template.';
            console.error("[FieldTemplatesPage] Error saving template:", error);
            setDialogError(errorMessage);
            toast({ variant: 'destructive', title: 'Save Failed', description: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async (templateId: string, templateName: string) => {
         if (!companyId || !canManageTemplates) return;
        setIsSaving(true);
        try {
            await deleteFieldTemplate(companyId, templateId);
            toast({ title: 'Template Deleted', description: `Template "${templateName}" deleted.`, variant: 'default' });
            fetchData();
        } catch (error: any) {
            console.error("[FieldTemplatesPage] Error deleting template:", error);
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message || 'Could not delete the field template.' });
        } finally {
            setIsSaving(false);
        }
    };


    if (authLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!canManageTemplates) {
        return (
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
                <Alert variant="destructive" className="m-4 max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>You do not have permission to manage field templates.</AlertDescription>
                </Alert>
            </main>
        );
    }

    return (
         <Dialog open={openDialog} onOpenChange={(open) => { setOpenDialog(open); if (!open) setDialogError(null); }}>
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                <Card>
                    <CardHeader>
                         <div className="flex justify-between items-center">
                             <div>
                                <CardTitle className="flex items-center gap-2"><FilePlus className="h-6 w-6" /> Field Templates</CardTitle>
                                <CardDescription>Save and apply reusable sets of custom fields to modules.</CardDescription>
                             </div>
                             <DialogTrigger asChild>
                                <Button size="sm" onClick={() => handleOpenDialog()}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Template
                                </Button>
                             </DialogTrigger>
                         </div>
                    </CardHeader>
                    <CardContent>
                        {loadingData ? (
                            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Template Name</TableHead>
                                        <TableHead>Applies To</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Fields</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {templates.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No field templates created yet.</TableCell></TableRow>
                                    ) : (
                                        templates.map(template => (
                                            <TableRow key={template.id}>
                                                <TableCell className="font-medium">{template.name}</TableCell>
                                                <TableCell className="capitalize">{template.entity_type.replace('-', ' ')}</TableCell>
                                                <TableCell className="text-muted-foreground max-w-xs truncate">{template.description || '-'}</TableCell>
                                                <TableCell className="text-center">{template.custom_field_ids.length}</TableCell>
                                                <TableCell className="text-right space-x-1">
                                                     <DialogTrigger asChild>
                                                        <Button variant="outline" size="icon" title="Edit Template" onClick={() => handleOpenDialog(template)}><Edit className="h-4 w-4" /></Button>
                                                     </DialogTrigger>
                                                     <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="destructive" size="icon" title="Delete Template" disabled={isSaving}><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>Delete template "{template.name}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                     className="bg-destructive hover:bg-destructive/90"
                                                                    onClick={() => handleDeleteTemplate(template.id, template.name)}
                                                                    disabled={isSaving}
                                                                >
                                                                     {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                     <CardFooter className="text-sm text-muted-foreground">
                        Total Templates: {templates.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    </CardFooter>
                </Card>
            </main>

             <DialogContent className="sm:max-w-[600px]">
                 <DialogHeader>
                     <DialogTitle>{editingTemplate ? 'Edit Field Template' : 'Add Field Template'}</DialogTitle>
                     <DialogDescription>Configure the template and select the custom fields it includes.</DialogDescription>
                 </DialogHeader>
                  {dialogError && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Save Failed</AlertTitle>
                        <AlertDescription>{dialogError}</AlertDescription>
                    </Alert>
                 )}
                 <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="template-name" className="text-right">Name <span className="text-destructive">*</span></Label>
                        <Input id="template-name" value={templateName} onChange={e => setTemplateName(e.target.value)} className="col-span-3" placeholder="e.g., HVAC PM Fields"/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="template-entity-type" className="text-right">Applies To <span className="text-destructive">*</span></Label>
                         <Select value={templateEntityType} onValueChange={value => setTemplateEntityType(value as CustomFieldEntityType)}>
                            <SelectTrigger id="template-entity-type" className="col-span-3 capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {availableEntityTypes.map(type => <SelectItem key={type} value={type} className="capitalize">{type.replace('-', ' ')}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="template-description" className="text-right pt-1">Description</Label>
                        <Textarea id="template-description" value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} className="col-span-3" placeholder="(Optional) Describe when to use this template"/>
                    </div>
                     <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-1">Included Fields <span className="text-destructive">*</span></Label>
                        <ScrollArea className="col-span-3 border rounded-md p-4 h-48 overflow-y-auto">
                             <div className="space-y-2">
                                 {fieldsForEntityType.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-4">No custom fields found for the selected 'Applies To' type. Create fields in the Field Editor first.</p>
                                ) : (
                                    fieldsForEntityType.map(field => (
                                        <div key={field.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`field-select-${field.id}`}
                                                checked={selectedFieldIds.has(field.id)}
                                                onCheckedChange={(checked) => handleFieldSelectionChange(field.id, !!checked)}
                                            />
                                            <Label htmlFor={`field-select-${field.id}`} className="font-normal">
                                                {field.label ?? field.name} <span className="text-xs text-muted-foreground">({field.field_type.replace('_', ' ')})</span>
                                            </Label>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                     </div>
                 </div>
                 <DialogFooter>
                     <Button type="button" variant="outline" disabled={isSaving} onClick={closeDialog}>Cancel</Button>
                     <Button type="button" onClick={handleSaveTemplate} disabled={isSaving}>
                         {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                         {editingTemplate ? 'Save Changes' : 'Create Template'}
                     </Button>
                 </DialogFooter>
             </DialogContent>
         </Dialog>
    );
}
