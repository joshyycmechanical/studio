
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users2, AlertCircle, Loader2, PlusCircle, Trash2, Edit, Send, ChevronDown } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { fetchCompanyByIdApi } from '@/services/companies';
import { fetchCompanyUsers, inviteUserApi, deleteUserApi, resendInviteApi, updateUserApi } from '@/services/users';
import { fetchCompanyRolesApi } from '@/services/roles';
import type { Company } from '@/types/company';
import type { UserProfileWithRoles } from '@/types/user';
import type { Role } from '@/types/role';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


const inviteUserSchema = z.object({
  email: z.string().email('A valid email is required'),
  fullName: z.string().optional(),
  roleIds: z.array(z.string()).min(1, 'At least one role must be selected'),
});
type InviteUserFormData = z.infer<typeof inviteUserSchema>;

// Schema for editing an existing user
const editUserSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  status: z.enum(['active', 'suspended']),
  roleIds: z.array(z.string()).min(1, 'At least one role must be selected'),
});
type EditUserFormData = z.infer<typeof editUserSchema>;


export default function PlatformManageCompanyUsersPage() {
    const { user: currentUser, loading: authLoading, firebaseUser, authStatus } = useAuth();
    const router = useRouter();
    const { companyId } = useParams() as { companyId: string };
    const { toast } = useToast();

    const [company, setCompany] = React.useState<Company | null>(null);
    const [users, setUsers] = React.useState<UserProfileWithRoles[]>([]);
    const [roles, setRoles] = React.useState<Role[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false);
    
    // State for the edit dialog
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [userToEdit, setUserToEdit] = React.useState<UserProfileWithRoles | null>(null);

    const canManageUsers = !authLoading && hasPermission(currentUser, 'users', 'manage');

    const inviteForm = useForm<InviteUserFormData>({
        resolver: zodResolver(inviteUserSchema),
        defaultValues: { email: '', fullName: '', roleIds: [] },
    });
    
    const editForm = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
    });
    
    // Effect to reset edit form when dialog opens with a new user
    React.useEffect(() => {
        if (userToEdit) {
            editForm.reset({
                full_name: userToEdit.full_name ?? '',
                status: userToEdit.status === 'suspended' ? 'suspended' : 'active',
                roleIds: userToEdit.roles || [], // Populate with existing role IDs
            });
        }
    }, [userToEdit, editForm]);


    const fetchData = React.useCallback(async () => {
        if (authStatus !== 'loggedIn' || !canManageUsers || !firebaseUser || !companyId) {
            if (authStatus !== 'loading') {
                setError("Access Denied or missing required information.");
            }
            setLoading(false);
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const idToken = await firebaseUser.getIdToken();
            const [companyData, usersData, rolesData] = await Promise.all([
                fetchCompanyByIdApi(idToken, companyId),
                fetchCompanyUsers(companyId),
                fetchCompanyRolesApi(idToken, companyId),
            ]);
            
            if (!companyData) throw new Error("Company not found.");
            
            setCompany(companyData);
            setUsers(usersData);
            setRoles(rolesData);
        } catch (err: any) {
            console.error("[Platform Users Page] Error fetching data:", err);
            setError(err.message);
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    }, [canManageUsers, firebaseUser, companyId, authStatus, toast]);
    
    React.useEffect(() => {
        fetchData();
    }, [fetchData]);


    const onInviteSubmit = async (data: InviteUserFormData) => {
        if (!firebaseUser) return;
        setActionLoading('invite');
        try {
            const idToken = await firebaseUser.getIdToken();
            await inviteUserApi(idToken, companyId, data);
            toast({ title: 'User Invited', description: `${data.email} has been sent an invitation.` });
            setInviteDialogOpen(false);
            inviteForm.reset({ email: '', fullName: '', roleIds: [] });
            fetchData();
        } catch (err: any) {
             toast({ variant: 'destructive', title: 'Invite Failed', description: err.message });
        } finally {
            setActionLoading(null);
        }
    };
    
    const onEditSubmit = async (data: EditUserFormData) => {
        if (!userToEdit || !firebaseUser) return;
        setActionLoading(userToEdit.id);
        try {
            const idToken = await firebaseUser.getIdToken();
            await updateUserApi(idToken, userToEdit.id, {
                full_name: data.full_name,
                status: data.status,
                roleIds: data.roleIds,
            });
            toast({ title: 'User Updated', description: `${data.full_name}'s details have been saved.` });
            setEditDialogOpen(false);
            setUserToEdit(null);
            fetchData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleDeleteUser = async (userId: string, userName: string) => {
        if (!firebaseUser) return;
        setActionLoading(userId);
        try {
            const idToken = await firebaseUser.getIdToken();
            await deleteUserApi(idToken, userId);
            toast({ title: 'User Deleted', description: `${userName} has been deleted.` });
            fetchData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
        } finally {
            setActionLoading(null);
        }
    }
    
    const handleResendInvite = async (userId: string, email: string) => {
         if (!firebaseUser) return;
        setActionLoading(userId);
        try {
            const idToken = await firebaseUser.getIdToken();
            await resendInviteApi(idToken, userId, email);
            toast({ title: 'Invitation Resent', description: `A new invitation has been sent to ${email}.` });
        } catch (err: any)
        {
            toast({ variant: 'destructive', title: 'Failed to Resend', description: err.message });
        } finally
        {
            setActionLoading(null);
        }
    }

    const handleOpenEditDialog = (user: UserProfileWithRoles) => {
        setUserToEdit(user);
        setEditDialogOpen(true);
    };

    if (loading || authLoading) {
        return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
    }
    
    if (error) {
        return (
             <main className="flex flex-1 flex-col items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                     <Button variant="outline" size="sm" onClick={() => router.push(`/platform/companies/${companyId}`)} className="mt-4">Back to Company Details</Button>
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
                     <Button variant="link" onClick={() => router.push(`/platform/companies/${companyId}`)} className="p-0 h-auto text-sm text-muted-foreground mb-1 self-start">
                        &larr; Back to {company?.name || 'Company'} Details
                    </Button>
                    <CardTitle className="flex items-center gap-2">
                        <Users2 className="h-6 w-6" /> Manage Users for: {company?.name}
                    </CardTitle>
                    <CardDescription>
                        Invite new users and manage existing user roles and status for this company.
                    </CardDescription>
                </div>
                 <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Invite User</Button>
                    </DialogTrigger>
                     <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Invite New User to {company?.name}</DialogTitle>
                            <DialogDescription>Enter the user's details and assign a role. They will receive an email to complete their setup.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)}>
                            <div className="grid gap-4 py-4">
                                 <div>
                                    <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                                    <Controller name="email" control={inviteForm.control} render={({ field }) => <Input id="email" type="email" {...field} />} />
                                    {inviteForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{inviteForm.formState.errors.email.message}</p>}
                                 </div>
                                 <div>
                                    <Label htmlFor="fullName">Full Name (Optional)</Label>
                                    <Controller name="fullName" control={inviteForm.control} render={({ field }) => <Input id="fullName" {...field} />} />
                                 </div>
                                  <div>
                                    <Label htmlFor="roleIds">Role(s) <span className="text-destructive">*</span></Label>
                                     <Controller
                                        name="roleIds"
                                        control={inviteForm.control}
                                        render={({ field }) => (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-between">
                                                        {field.value?.length > 0 ? `${field.value.length} role(s) selected` : "Select role(s)"}
                                                        <ChevronDown className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                                    <DropdownMenuLabel>Assign Roles</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {roles.map(role => (
                                                        <DropdownMenuCheckboxItem
                                                            key={role.id}
                                                            checked={field.value?.includes(role.id)}
                                                            onCheckedChange={(checked) => {
                                                                const newValues = checked ? [...field.value, role.id] : field.value.filter(id => id !== role.id);
                                                                field.onChange(newValues);
                                                            }}
                                                        >
                                                            {role.name}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    />
                                     {inviteForm.formState.errors.roleIds && <p className="text-sm text-destructive mt-1">{inviteForm.formState.errors.roleIds.message}</p>}
                                 </div>
                            </div>
                             <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={!!actionLoading}>{actionLoading === 'invite' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Send Invitation</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                 </Dialog>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {users.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center">No users found.</TableCell></TableRow>
                    ) : (
                        users.map(u => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.full_name ?? '-'}</TableCell>
                                <TableCell>{u.email}</TableCell>
                                <TableCell><Badge variant={u.status === 'active' ? 'default' : 'secondary'} className="capitalize">{u.status}</Badge></TableCell>
                                <TableCell className="text-xs">{u.roles.map(rid => roles.find(r => r.id === rid)?.name).join(', ') || 'No Role'}</TableCell>
                                <TableCell>{format(new Date(u.created_at), 'PP')}</TableCell>
                                <TableCell className="text-right space-x-1">
                                    {u.status === 'invited' && (
                                        <Button variant="outline" size="icon" title="Resend Invitation" onClick={() => handleResendInvite(u.id, u.email)} disabled={!!actionLoading}>
                                             {actionLoading === u.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                                        </Button>
                                    )}
                                     <Button variant="outline" size="icon" title="Edit User" disabled={!!actionLoading} onClick={() => handleOpenEditDialog(u)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" title="Delete User" disabled={!!actionLoading}>
                                                 {actionLoading === u.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the user {u.full_name || u.email}.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteUser(u.id, u.full_name || u.email)}>Delete User</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </CardContent>
         <CardFooter>
            <div className="text-xs text-muted-foreground">
                Total Users: {users.length}
            </div>
        </CardFooter>
      </Card>

    </main>

    {/* Edit User Dialog */}
     <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit User: {userToEdit?.full_name}</DialogTitle>
                <DialogDescription>Update the user's details and role assignments.</DialogDescription>
            </DialogHeader>
            {userToEdit && (
                 <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
                    <div className="grid gap-4 py-4">
                         <div>
                            <Label htmlFor="edit-full-name">Full Name <span className="text-destructive">*</span></Label>
                            <Controller name="full_name" control={editForm.control} render={({ field }) => <Input id="edit-full-name" {...field} />} />
                            {editForm.formState.errors.full_name && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.full_name.message}</p>}
                         </div>
                          <div>
                            <Label htmlFor="edit-status">Status</Label>
                             <Controller
                                name="status"
                                control={editForm.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value} disabled={userToEdit.status === 'invited'}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="suspended">Suspended</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                             {userToEdit.status === 'invited' && <p className="text-xs text-muted-foreground mt-1">Status cannot be changed for an invited user.</p>}
                         </div>
                          <div>
                            <Label htmlFor="edit-roleIds">Role(s) <span className="text-destructive">*</span></Label>
                             <Controller
                                name="roleIds"
                                control={editForm.control}
                                render={({ field }) => (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between">
                                                {field.value?.length > 0 ? `${field.value.length} role(s) selected` : "Select role(s)"}
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                            {roles.map(role => (
                                                <DropdownMenuCheckboxItem
                                                    key={role.id}
                                                    checked={field.value?.includes(role.id)}
                                                    onCheckedChange={(checked) => {
                                                        const newValues = checked ? [...field.value, role.id] : field.value.filter(id => id !== role.id);
                                                        field.onChange(newValues);
                                                    }}
                                                >
                                                    {role.name}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            />
                             {editForm.formState.errors.roleIds && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.roleIds.message}</p>}
                         </div>
                    </div>
                     <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={actionLoading === userToEdit.id}>{actionLoading === userToEdit.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Changes</Button>
                    </DialogFooter>
                </form>
            )}
        </DialogContent>
     </Dialog>
    </>
  );
}

