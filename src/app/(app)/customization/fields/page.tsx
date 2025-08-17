
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, Cog, Loader2, AlertCircle, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { CustomField, CustomFieldType, CustomFieldEntityType } from '@/types/custom-field';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Import Firestore service functions
import {
    fetchCompanyCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    updateCustomFieldsOrder // Import new function
} from '@/services/customization';

const availableEntityTypes: CustomFieldEntityType[] = ['work-order', 'customer', 'location', 'equipment', 'user', 'invoice', 'estimate', 'deficiency'];
const availableFieldTypes: CustomFieldType[] = ['text', 'textarea', 'number', 'currency', 'date', 'datetime', 'toggle', 'dropdown', 'multiselect', 'signature', 'photo', 'file', 'user_select', 'customer_select', 'location_select', 'equipment_select'];

// Draggable Field Card Component
const SortableFieldCard = ({ field, onEdit, onDelete }: { field: CustomField; onEdit: () => void; onDelete: () => void; }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : 'auto', opacity: isDragging ? 0.7 : 1 };

    return (
        <Card ref={setNodeRef} style={style} className="shadow-sm hover:shadow-md transition-shadow" {...attributes}>
            <div className="flex items-center p-3 gap-2">
                <Button variant="ghost" {...listeners} className="cursor-grab p-2 h-auto">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                </Button>
                <div className="flex-1 grid grid-cols-5 gap-4 items-center text-sm">
                    <div className="col-span-2 font-medium">{field.label ?? field.name}</div>
                    <div className="text-muted-foreground">{field.name}</div>
                    <div className="text-muted-foreground capitalize">{field.field_type.replace('_', ' ')}</div>
                    <div className="text-muted-foreground">{field.is_required ? 'Required' : 'Optional'}</div>
                </div>
                <div className="ml-auto flex gap-1">
                    <Button variant="outline" size="icon" title="Edit Field" onClick={onEdit}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title="Delete Field"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>Delete field "{field.label ?? field.name}"? This action cannot be undone and might affect existing data.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={onDelete}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </Card>
    );
};


export default function CustomFieldsPage() {
    const { user, companyId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [allFields, setAllFields] = useState<CustomField[]>([]); // All fields from DB
    const [localFields, setLocalFields] = useState<CustomField[]>([]); // Fields being displayed and reordered
    const [loadingData, setLoadingData] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [filterEntityType, setFilterEntityType] = useState<CustomFieldEntityType | 'all'>('all');
    const [openDialog, setOpenDialog] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [orderChanged, setOrderChanged] = useState(false);

    // Form state for the dialog
    const [fieldName, setFieldName] = useState('');
    const [fieldLabel, setFieldLabel] = useState('');
    const [fieldEntityType, setFieldEntityType] = useState<CustomFieldEntityType>('work-order');
    const [fieldType, setFieldType] = useState<CustomFieldType>('text');
    const [fieldOptions, setFieldOptions] = useState('');
    const [fieldIsRequired, setFieldIsRequired] = useState(false);
    const [fieldDescription, setFieldDescription] = useState('');
    const [fieldPlaceholder, setFieldPlaceholder] = useState('');
    const [fieldSortOrder, setFieldSortOrder] = useState<number>(10);

    const canManageFields = !authLoading && hasPermission(user, 'customization', 'manage');

    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const fetchData = useCallback(async () => {
        if (!companyId || !canManageFields) {
            setLoadingData(false); setAllFields([]); return;
        }
        setLoadingData(true);
        try {
            const fetchedFields = await fetchCompanyCustomFields(companyId);
            setAllFields(fetchedFields);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Loading Fields', description: error.message });
            setAllFields([]);
        } finally { setLoadingData(false); }
    }, [companyId, canManageFields, toast]);

    useEffect(() => { if (!authLoading) { fetchData(); } }, [fetchData, authLoading]);

    // Update local (displayed) fields when filters or source data change
    useEffect(() => {
        const filtered = filterEntityType === 'all' ? allFields : allFields.filter(f => f.entity_type === filterEntityType);
        setLocalFields(filtered);
        setOrderChanged(false); // Reset order change status when filter changes
    }, [allFields, filterEntityType]);


    const handleOpenDialog = (field: CustomField | null = null) => {
        setDialogError(null); setEditingField(field);
        if (field) {
            setFieldName(field.name); setFieldLabel(field.label ?? field.name); setFieldEntityType(field.entity_type); setFieldType(field.field_type);
            setFieldOptions(field.options?.join(', ') ?? ''); setFieldIsRequired(field.is_required); setFieldDescription(field.description ?? '');
            setFieldPlaceholder(field.placeholder ?? ''); setFieldSortOrder(field.sort_order);
        } else {
            const currentHighestOrder = localFields.reduce((max, f) => Math.max(max, f.sort_order), 0);
            setFieldName(''); setFieldLabel(''); setFieldEntityType(filterEntityType === 'all' ? 'work-order' : filterEntityType); setFieldType('text');
            setFieldOptions(''); setFieldIsRequired(false); setFieldDescription(''); setFieldPlaceholder(''); setFieldSortOrder(currentHighestOrder + 10);
        }
        setOpenDialog(true);
    };

    const closeDialog = () => { setOpenDialog(false); setTimeout(() => setEditingField(null), 150); }

    const handleSaveField = async () => {
        setDialogError(null); if (!companyId || !canManageFields) return;
        if (!fieldName.trim() || !fieldLabel.trim()) { setDialogError('Field Name and Label are required.'); return; }
        if (!/^[a-z0-9_]+$/.test(fieldName)) { setDialogError('Field Name can only contain lowercase letters, numbers, and underscores.'); return; }
        const nameExists = allFields.some(f => f.name === fieldName.trim() && f.entity_type === fieldEntityType && f.id !== editingField?.id);
        if (nameExists) { setDialogError(`A field named "${fieldName.trim()}" already exists for ${fieldEntityType.replace('-', ' ')}.`); return; }

        setIsSaving(true);
        try {
            const fieldData = {
                entity_type: fieldEntityType, name: fieldName.trim(), label: fieldLabel.trim(), field_type: fieldType,
                options: (fieldType === 'dropdown' || fieldType === 'multiselect') ? fieldOptions.split(',').map(o => o.trim()).filter(Boolean) : [],
                is_required: fieldIsRequired, description: fieldDescription.trim() || null, placeholder: fieldPlaceholder.trim() || null, sort_order: Number(fieldSortOrder),
            };
            if (editingField) {
                await updateCustomField(companyId, editingField.id, fieldData);
                toast({ title: 'Field Updated' });
            } else {
                await createCustomField(companyId, fieldData as any);
                toast({ title: 'Field Created' });
            }
            closeDialog(); fetchData();
        } catch (error: any) { setDialogError(error.message); } finally { setIsSaving(false); }
    };

    const handleDeleteField = async (fieldId: string) => {
        if (!companyId || !canManageFields) return;
        setIsSaving(true);
        try { await deleteCustomField(companyId, fieldId); toast({ title: 'Field Deleted' }); fetchData(); }
        catch (error: any) { toast({ variant: 'destructive', title: 'Delete Failed', description: error.message }); }
        finally { setIsSaving(false); }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setLocalFields((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setOrderChanged(true);
        }
    };

    const handleSaveOrder = async () => {
        if (!companyId) return;
        setIsSaving(true);
        try {
            const fieldsToUpdate = localFields.map((field, index) => ({
                id: field.id,
                sort_order: (index + 1) * 10 // Re-calculate sort order based on new position
            }));
            await updateCustomFieldsOrder(companyId, fieldsToUpdate);
            toast({ title: 'Field Order Saved', description: 'The new order has been saved successfully.' });
            setOrderChanged(false);
            fetchData(); // Refetch to confirm
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Order Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!canManageFields) return <main className="flex flex-1 items-center justify-center"><Alert variant="destructive" className="m-4 max-w-md"><AlertCircle className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle><AlertDescription>You do not have permission to manage custom fields.</AlertDescription></Alert></main>;

    return (
        <Dialog open={openDialog} onOpenChange={(open) => { setOpenDialog(open); if (!open) closeDialog(); }}>
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                                <CardTitle className="flex items-center gap-2"><Cog className="h-6 w-6" /> Custom Fields (Field Editor)</CardTitle>
                                <CardDescription>Define additional fields for various modules. Drag and drop to reorder.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {orderChanged && (
                                    <Button onClick={handleSaveOrder} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Order
                                    </Button>
                                )}
                                <DialogTrigger asChild><Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Custom Field</Button></DialogTrigger>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-4">
                            <Select value={filterEntityType} onValueChange={(value) => setFilterEntityType(value as CustomFieldEntityType | 'all')} disabled={loadingData}>
                                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by Module" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Modules</SelectItem>{availableEntityTypes.map(type => <SelectItem key={type} value={type} className="capitalize">{type.replace('-', ' ')}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingData ? <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            : localFields.length > 0 ? (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={localFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2">
                                            {localFields.map(field => (
                                                <SortableFieldCard
                                                    key={field.id}
                                                    field={field}
                                                    onEdit={() => handleOpenDialog(field)}
                                                    onDelete={() => handleDeleteField(field.id)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            ) : (<div className="h-24 text-center text-muted-foreground flex items-center justify-center">No custom fields found for this module.</div>)
                        }
                    </CardContent>
                    <CardFooter className="text-sm text-muted-foreground">Total Fields: {localFields.length} {loadingData && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}</CardFooter>
                </Card>
            </main>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader><DialogTitle>{editingField ? 'Edit Custom Field' : 'Add Custom Field'}</DialogTitle><DialogDescription>Define the properties for this custom field.</DialogDescription></DialogHeader>
                {dialogError && (<Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Save Failed</AlertTitle><AlertDescription>{dialogError}</AlertDescription></Alert>)}
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="field-label" className="text-right">Label <span className="text-destructive">*</span></Label>
                        <Input id="field-label" value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} className="col-span-3" placeholder="Visible label for the field" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="field-name" className="text-right">Field Name <span className="text-destructive">*</span></Label>
                        <Input id="field-name" value={fieldName} onChange={e => setFieldName(e.target.value)} className="col-span-3" placeholder="programmatic_name_snake_case" disabled={!!editingField} />
                        <p className="col-start-2 col-span-3 text-xs text-muted-foreground">{editingField ? 'Field Name cannot be changed after creation.' : 'Internal name (lowercase, underscores only). Cannot be changed.'}</p>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="field-entity-type" className="text-right">Applies To <span className="text-destructive">*</span></Label>
                        <Select value={fieldEntityType} onValueChange={value => setFieldEntityType(value as CustomFieldEntityType)} disabled={!!editingField}>
                            <SelectTrigger id="field-entity-type" className="col-span-3 capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent>{availableEntityTypes.map(type => <SelectItem key={type} value={type} className="capitalize">{type.replace('-', ' ')}</SelectItem>)}</SelectContent>
                        </Select>
                        {editingField && <p className="col-start-2 col-span-3 text-xs text-muted-foreground">Cannot change where the field applies after creation.</p>}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="field-type" className="text-right">Field Type <span className="text-destructive">*</span></Label>
                        <Select value={fieldType} onValueChange={value => setFieldType(value as CustomFieldType)}>
                            <SelectTrigger id="field-type" className="col-span-3 capitalize"><SelectValue /></SelectTrigger>
                            <SelectContent>{availableFieldTypes.map(type => <SelectItem key={type} value={type} className="capitalize">{type.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {(fieldType === 'dropdown' || fieldType === 'multiselect') && (<div className="grid grid-cols-4 items-start gap-4"><Label htmlFor="field-options" className="text-right pt-1">Options <span className="text-destructive">*</span></Label><Textarea id="field-options" value={fieldOptions} onChange={e => setFieldOptions(e.target.value)} className="col-span-3" placeholder="Enter options separated by commas" rows={3} /><p className="col-start-2 col-span-3 text-xs text-muted-foreground">Comma-separated list of choices.</p></div>)}
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="field-placeholder" className="text-right">Placeholder</Label><Input id="field-placeholder" value={fieldPlaceholder} onChange={e => setFieldPlaceholder(e.target.value)} className="col-span-3" placeholder="(Optional) Text shown when empty" /></div>
                    <div className="grid grid-cols-4 items-start gap-4"><Label htmlFor="field-description" className="text-right pt-1">Description</Label><Textarea id="field-description" value={fieldDescription} onChange={e => setFieldDescription(e.target.value)} className="col-span-3" placeholder="(Optional) Help text for users" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="field-sort-order" className="text-right">Sort Order</Label><Input id="field-sort-order" type="number" value={fieldSortOrder} onChange={e => setFieldSortOrder(Number(e.target.value))} className="col-span-3" placeholder="e.g., 10, 20" disabled /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Required</Label><div className="col-span-3 flex items-center space-x-2"><Checkbox id="field-is-required" checked={fieldIsRequired} onCheckedChange={checked => setFieldIsRequired(!!checked)} /><Label htmlFor="field-is-required" className="font-normal">Make this field mandatory</Label></div></div>
                </div>
                <DialogFooter><Button type="button" variant="outline" disabled={isSaving} onClick={closeDialog}>Cancel</Button><Button type="button" onClick={handleSaveField} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingField ? 'Save Changes' : 'Create Field'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
