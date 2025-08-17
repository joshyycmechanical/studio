
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users2, AlertCircle, Loader2, PlusCircle, Trash2, Edit, Send } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { fetchCompanyUsers, inviteUserApi, deleteUserApi, resendInviteApi, updateUserApi } from '@/services/users';
import { fetchCompanyRoles } from '@/services/roles';
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

const inviteUserSchema = z.object({
  email: z.string().email('A valid email is required'),
  fullName: z.string().optional(),
  roleIds: z.array(z.string()).min(1, 'At least one role must be selected'),
});
type InviteUserFormData = z.infer<typeof inviteUserSchema>;

const editUserSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  status: z.enum(['active', 'suspended']),
  roleId: z.string().min(1, 'A role must be selected'),
});
type EditUserFormData = z.infer<typeof editUserSchema>;


export default function UsersPage() {
    const { user: currentUser, companyId, loading: authLoading, firebaseUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

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
    const canViewUsers = !authLoading && hasPermission(currentUser, 'users', 'view');


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
                roleId: userToEdit.roles[0] || '', // Assumes single role for now
            });
        }
    }, [userToEdit, editForm.reset]);

    const fetchData = React.useCallback(async () => {
        if (!canViewUsers || !companyId) {
            if (!authLoading) setError("Access Denied or missing company context.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const [usersData, rolesData] = await Promise.all([
                fetchCompanyUsers(companyId),
                fetchCompanyRoles(companyId),
            ]);
            setUsers(usersData);
            setRoles(rolesData);
        } catch (err: any) {
            console.error("[Users Page] Error fetching data:", err);
            setError(err.message);
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoading(false);
        }
    }, [canViewUsers, companyId, authLoading, toast]);
    
    React.useEffect(() => {
        fetchData();
    }, [fetchData]);


    const onInviteSubmit = async (data: InviteUserFormData) => {
        if (!canManageUsers || !firebaseUser || !companyId) return;
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
        if (!canManageUsers || !userToEdit || !firebaseUser) return;
        setActionLoading(userToEdit.id);
        try {
            const idToken = await firebaseUser.getIdToken();
            await updateUserApi(idToken, userToEdit.id, {
                full_name: data.full_name,
                status: data.status,
                roleIds: [data.roleId],
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
        if (!canManageUsers || !firebaseUser) return;
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
         if (!canManageUsers || !firebaseUser) return;
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


    if (authLoading) {
      return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (!canViewUsers) {
        return (
          <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
            <Alert variant="destructive" className="m-4 max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>{error || 'You do not have permission to view users.'}</AlertDescription>
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
                        <Users2 className="h-6 w-6" /> Manage Users
                    </CardTitle>
                    <CardDescription>
                        Invite new users and manage existing user roles and status.
                    </CardDescription>
                </div>
                 {canManageUsers && (
                     <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Invite User</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Invite New User</DialogTitle>
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
                                        <Controller name="fullName" control={inviteForm.control} render={({ field }) => <Input id="fullName" {...field} value={field.value ?? ''} />} />
                                     </div>
                                      <div>
                                        <Label htmlFor="roleIds">Role <span className="text-destructive">*</span></Label>
                                         <Controller
                                            name="roleIds"
                                            control={inviteForm.control}
                                            render={({ field }) => (
                                                <Select onValueChange={(value) => field.onChange([value])} >
                                                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                                    <SelectContent>
                                                         {roles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                                                         {roles.length === 0 && <SelectItem value="" disabled>No roles found</SelectItem>}
                                                    </SelectContent>
                                                </Select>
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
                 )}
            </div>
        </CardHeader>
        <CardContent>
             {loading ? (
                 <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
             ) : error ? (
                 <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
             ) : (
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
                                        {canManageUsers && u.status === 'invited' && (
                                            <Button variant="outline" size="icon" title="Resend Invitation" onClick={() => handleResendInvite(u.id, u.email)} disabled={!!actionLoading}>
                                                 {actionLoading === u.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                                            </Button>
                                        )}
                                        {canManageUsers && (
                                         <>
                                            <Button variant="outline" size="icon" title="Edit User" disabled={!!actionLoading} onClick={() => handleOpenEditDialog(u)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="icon" title="Delete User" disabled={!!actionLoading || u.id === currentUser?.id}>
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
                <DialogDescription>Update the user's details and role.</DialogDescription>
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
                            <Label htmlFor="edit-roleId">Role <span className="text-destructive">*</span></Label>
                             <Controller
                                name="roleId"
                                control={editForm.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                                        <SelectContent>
                                             {roles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                             {editForm.formState.errors.roleId && <p className="text-sm text-destructive mt-1">{editForm.formState.errors.roleId.message}</p>}
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
