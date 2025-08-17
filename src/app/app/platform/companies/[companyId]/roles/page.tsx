
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCog, PlusCircle, Loader2, AlertCircle, Trash2, Edit } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { fetchCompanyByIdApi } from '@/services/companies';
import { fetchCompanyRolesApi, createRoleApi, updateRoleApi, deleteRoleApi } from '@/services/roles';
import type { Company } from '@/types/company';
import type { Role, ModulePermissions } from '@/types/role';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { allPlatformModules } from '@/lib/roles-data';
import { formatEnum } from '@/lib/utils';

// Generate a list of all possible permission actions from the type definition for the form
const permissionKeys: (keyof Omit<ModulePermissions, 'can_access'>)[] = ['view', 'create', 'edit', 'delete', 'assign', 'approve', 'send', 'manage_status', 'process_payment', 'link_qr', 'transfer', 'ocr', 'recurring', 'convert', 'fill', 'live', 'upload', 'manage', 'generate', 'resolve', 'impersonate', 'export'];


// Zod schema for role form validation
const roleFormSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters.'),
  description: z.string().optional(),
  permissions: z.record(z.string(), z.any()), // Permissions are dynamic, basic validation here
});

type RoleFormData = z.infer<typeof roleFormSchema>;

export default function PlatformManageCompanyRolesPage() {
  const { user: currentUser, loading: authLoading, firebaseUser } = useAuth();
  const router = useRouter();
  const { companyId } = useParams() as { companyId: string };
  const { toast } = useToast();

  const [company, setCompany] = React.useState<Company | null>(null);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);

  const canManageRoles = !authLoading && hasPermission(currentUser, 'platform-companies', 'edit');

  const { control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: '', description: '', permissions: {} },
  });

  const fetchData = React.useCallback(async () => {
    if (!canManageRoles || !firebaseUser || !companyId) {
      if (!authLoading) setError("Access Denied or missing required information.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const [companyData, rolesData] = await Promise.all([
        fetchCompanyByIdApi(idToken, companyId),
        fetchCompanyRolesApi(idToken, companyId),
      ]);
      if (!companyData) throw new Error("Company not found.");
      setCompany(companyData);
      setRoles(rolesData);
    } catch (err: any) {
      setError(err.message);
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [canManageRoles, firebaseUser, companyId, authLoading, toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (role: Role | null = null) => {
    setEditingRole(role);
    if (role) {
      reset({ name: role.name, description: role.description ?? '', permissions: role.permissions });
    } else {
      reset({ name: '', description: '', permissions: {} });
    }
    setDialogOpen(true);
  };

  const onSubmit = async (data: RoleFormData) => {
    if (!canManageRoles || !firebaseUser || !company) return;

    try {
      const idToken = await firebaseUser.getIdToken();
      if (editingRole) {
        await updateRoleApi(idToken, companyId, editingRole.id, data);
        toast({ title: 'Role Updated', description: `The role "${data.name}" has been saved.` });
      } else {
        await createRoleApi(idToken, companyId, data);
        toast({ title: 'Role Created', description: `The role "${data.name}" has been created.` });
      }
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
    }
  };
  
  const handleDeleteRole = async (roleId: string, roleName: string) => {
      if (!canManageRoles || !firebaseUser || !company) return;
      try {
          const idToken = await firebaseUser.getIdToken();
          await deleteRoleApi(idToken, companyId, roleId);
          toast({ title: "Role Deleted", description: `Role "${roleName}" was deleted.` });
          fetchData();
      } catch (err: any) {
          toast({ variant: "destructive", title: "Delete Failed", description: err.message });
      }
  }
  
  const moduleGroups = React.useMemo(() => {
    return allPlatformModules.reduce((acc, module) => {
        if(module.group === 'platform_admin' || module.is_internal) return acc;
        (acc[module.group] = acc[module.group] || []).push(module);
        return acc;
    }, {} as Record<string, typeof allPlatformModules>);
  }, []);
  
  const handleManageToggle = (moduleSlug: string, isChecked: boolean) => {
      setValue(`permissions.${moduleSlug}.manage`, isChecked);
      permissionKeys.forEach(key => {
          if (key !== 'manage') {
              setValue(`permissions.${moduleSlug}.${key}`, isChecked);
          }
      });
      setValue(`permissions.${moduleSlug}.can_access`, isChecked);
  };


  if (loading) return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  if (error) return <main className="flex flex-1 items-center justify-center p-4"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></main>;

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
                  <UserCog className="h-6 w-6" /> Manage Roles for: {company?.name}
                </CardTitle>
                <CardDescription>Create, edit, and assign permissions to roles for this company.</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Add Role</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader><TableRow><TableHead>Role Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                    {roles.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="h-24 text-center">No custom roles found for this company.</TableCell></TableRow>
                    ) : (
                        roles.map(role => (
                            <TableRow key={role.id}>
                                <TableCell className="font-medium">{role.name}</TableCell>
                                <TableCell className="text-muted-foreground">{role.description}</TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button variant="outline" size="icon" title="Edit Role" onClick={() => handleOpenDialog(role)}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" title="Delete Role"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the role "{role.name}". Users with this role will lose its permissions.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteRole(role.id, role.name)}>Delete Role</AlertDialogAction>
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
          <CardFooter><div className="text-xs text-muted-foreground">Total Roles: {roles.length}</div></CardFooter>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}</DialogTitle>
            <DialogDescription>Define the role's details and granular permissions below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
              <div className="md:col-span-1 space-y-4">
                <div>
                  <Label htmlFor="name">Role Name <span className="text-destructive">*</span></Label>
                  <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Controller name="description" control={control} render={({ field }) => <Textarea id="description" {...field} placeholder="A brief summary of this role's purpose" />} />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Permissions</Label>
                <ScrollArea className="h-96 w-full rounded-md border p-4 mt-2">
                  <Accordion type="multiple" className="w-full">
                    {Object.entries(moduleGroups).map(([groupName, modules]) => (
                      <AccordionItem value={groupName} key={groupName}>
                        <AccordionTrigger>{formatEnum(groupName)}</AccordionTrigger>
                        <AccordionContent>
                           <div className="space-y-4">
                           {modules.map(module => {
                                const watchedManage = watch(`permissions.${module.slug}.manage`);
                                return (
                                <div key={module.slug} className="p-3 border rounded-md">
                                    <h4 className="font-semibold mb-2">{module.name}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                                        <div className="flex items-center space-x-2 font-bold col-span-full sm:col-span-1">
                                            <Controller name={`permissions.${module.slug}.manage`} control={control} render={({ field }) => (
                                                <Checkbox id={`perm-${module.slug}-manage`} checked={!!field.value} onCheckedChange={(checked) => handleManageToggle(module.slug, !!checked)} />
                                            )} />
                                            <Label htmlFor={`perm-${module.slug}-manage`} className="font-bold">Manage</Label>
                                        </div>
                                        {permissionKeys.filter(key => key !== 'manage').map(key => (
                                            <div key={key} className="flex items-center space-x-2">
                                                <Controller name={`permissions.${module.slug}.${key}`} control={control} render={({ field }) => (
                                                    <Checkbox id={`perm-${module.slug}-${key}`} checked={!!field.value || !!watchedManage} disabled={!!watchedManage} onCheckedChange={field.onChange} />
                                                 )} />
                                                <Label htmlFor={`perm-${module.slug}-${key}`} className="font-normal capitalize">{formatEnum(key)}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                               )
                           })}
                           </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Role</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
