
'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Edit, Trash2, Warehouse, Loader2, AlertCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { InventoryItem } from '@/types/inventory';
import { fetchCompanyInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '@/services/inventory';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const itemSchema = z.object({
    name: z.string().min(1, 'Item name is required.'),
    part_number: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    quantity_on_hand: z.coerce.number().min(0, 'Quantity cannot be negative.'),
    unit_cost: z.coerce.number().min(0, 'Cost cannot be negative.').optional().nullable(),
    unit_price: z.coerce.number().min(0, 'Price cannot be negative.').optional().nullable(),
    reorder_point: z.coerce.number().min(0, 'Reorder point cannot be negative.').optional().nullable(),
});
type ItemFormData = z.infer<typeof itemSchema>;

function ItemDialog({ item, onSave, onOpenChange, open }: { item: InventoryItem | null, onSave: (data: any) => void, onOpenChange: (open: boolean) => void, open: boolean }) {
    const { handleSubmit, control, reset } = useForm<ItemFormData>({
        resolver: zodResolver(itemSchema),
        defaultValues: item ? { ...item } : { quantity_on_hand: 0 }
    });

    React.useEffect(() => {
        if (item) reset(item);
        else reset({ name: '', part_number: '', description: '', category: '', quantity_on_hand: 0, unit_cost: null, unit_price: null, reorder_point: null });
    }, [item, reset]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{item ? 'Edit Item' : 'Add New Item'}</DialogTitle>
                    <DialogDescription>Fill in the details for the inventory item.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSave)}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name*</Label>
                            <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} className="col-span-3" />} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="part_number" className="text-right">Part #</Label>
                            <Controller name="part_number" control={control} render={({ field }) => <Input id="part_number" {...field} value={field.value ?? ''} className="col-span-3" />} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="quantity_on_hand" className="text-right">Quantity*</Label>
                            <Controller name="quantity_on_hand" control={control} render={({ field }) => <Input id="quantity_on_hand" type="number" {...field} className="col-span-3" />} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="unit_price" className="text-right">Unit Price</Label>
                            <Controller name="unit_price" control={control} render={({ field }) => <Input id="unit_price" type="number" {...field} value={field.value ?? ''} className="col-span-3" />} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit"><Save className="mr-2 h-4"/>Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function InventoryPage() {
    const { user, companyId, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState<InventoryItem | null>(null);

    const canView = !authLoading && hasPermission(user, 'inventory', 'view');
    const canManage = !authLoading && hasPermission(user, 'inventory', 'manage');

    const { data: inventory = [], isLoading, error } = useQuery<InventoryItem[]>({
        queryKey: ['inventory', companyId],
        queryFn: fetchCompanyInventory,
        enabled: !!companyId && canView,
    });

    const createMutation = useMutation({
        mutationFn: (data: ItemFormData) => createInventoryItem(data as any),
        onSuccess: () => {
            toast({ title: 'Item Created' });
            queryClient.invalidateQueries({ queryKey: ['inventory', companyId] });
            setDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });

    const updateMutation = useMutation({
        mutationFn: (data: ItemFormData) => updateInventoryItem(editingItem!.id, data),
        onSuccess: () => {
            toast({ title: 'Item Updated' });
            queryClient.invalidateQueries({ queryKey: ['inventory', companyId] });
            setDialogOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
    
    const deleteMutation = useMutation({
        mutationFn: (itemId: string) => deleteInventoryItem(itemId),
        onSuccess: () => {
            toast({ title: 'Item Deleted' });
            queryClient.invalidateQueries({ queryKey: ['inventory', companyId] });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
    });


    const filteredItems = React.useMemo(() => {
        return inventory.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.part_number?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [inventory, searchTerm]);
    
    const handleSave = (data: ItemFormData) => {
        if(editingItem) {
            updateMutation.mutate(data);
        } else {
            createMutation.mutate(data);
        }
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    if (!canView) return <main className="p-4"><Alert variant="destructive"><AlertCircle /> <AlertTitle>Access Denied</AlertTitle></Alert></main>;
    if (error) return <main className="p-4"><Alert variant="destructive"><AlertCircle /> <AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></main>;

    return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 md:gap-8">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Warehouse className="h-6 w-6" /> Inventory</CardTitle>
                            <CardDescription>Manage parts, stock levels, and warehouses.</CardDescription>
                        </div>
                        {canManage && <Button size="sm" onClick={() => { setEditingItem(null); setDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>}
                    </div>
                    <div className="mt-4"><Input placeholder="Search by name or part number..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" /></div>
                </CardHeader>
                <CardContent>
                    {isLoading ? <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Part #</TableHead><TableHead>Qty On Hand</TableHead><TableHead>Unit Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredItems.length === 0 ? <TableRow><TableCell colSpan={5} className="h-24 text-center">No inventory items found.</TableCell></TableRow> : filteredItems.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{item.part_number || 'N/A'}</TableCell>
                                        <TableCell>{item.quantity_on_hand}</TableCell>
                                        <TableCell>{item.unit_price ? `$${item.unit_price.toFixed(2)}` : 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                            {canManage && <>
                                                <Button variant="outline" size="icon" onClick={() => { setEditingItem(item); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="ml-2"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the item "{item.name}".</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
                <CardFooter><p className="text-xs text-muted-foreground">Total Items: {filteredItems.length}</p></CardFooter>
            </Card>
            <ItemDialog item={editingItem} onSave={handleSave} onOpenChange={setDialogOpen} open={dialogOpen} />
        </main>
    );
}
