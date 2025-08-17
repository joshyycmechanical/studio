
'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Save, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Role } from '@/types/role';
import { fetchRoleById, updateRolePermissions } from '@/services/roles'; // To be created
import { ALL_PERMISSIONS } from '@/lib/permissions-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function RoleEditPage() {
  const { roleId } = useParams() as { roleId: string };
  const { user, companyId, loading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const canManageRoles = !authLoading && hasPermission(user, 'roles:manage');

  const { data: role, isLoading, error } = useQuery<Role | null>({
    queryKey: ['role', roleId],
    queryFn: () => fetchRoleById(companyId!, roleId),
    enabled: !!companyId && canManageRoles && roleId !== 'new',
  });

  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({});
  const [roleName, setRoleName] = React.useState('');
  const [roleDescription, setRoleDescription] = React.useState('');

  React.useEffect(() => {
    if (role) {
      setPermissions(role.permissions || {});
      setRoleName(role.name);
      setRoleDescription(role.description || '');
    }
  }, [role]);
  
  const mutation = useMutation({
    mutationFn: (updatedData: { name: string; description: string; permissions: Record<string, boolean> }) => {
        // Here you would call a service function to either create or update a role
        // For simplicity, we'll just use the update function for now
        return updateRolePermissions(companyId!, roleId, updatedData);
    },
    onSuccess: () => {
        toast({ title: "Success", description: "Role has been updated successfully." });
        queryClient.invalidateQueries({ queryKey: ['roles', companyId] });
        router.push('/roles');
    },
    onError: (error: any) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setPermissions(prev => ({ ...prev, [permissionId]: checked }));
  };

  const onSave = () => {
    mutation.mutate({ name: roleName, description: roleDescription, permissions });
  };

  if (authLoading || (isLoading && roleId !== 'new')) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canManageRoles) {
    return <main className="p-4"><Alert variant="destructive"><AlertCircle /> <AlertTitle>Access Denied</AlertTitle></Alert></main>;
  }

  if (error) {
     return <main className="p-4"><Alert variant="destructive"><AlertCircle /> <AlertTitle>Error Loading Role</AlertTitle></Alert></main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4">
       <Button variant="ghost" size="sm" onClick={() => router.back()} className="self-start -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Roles
        </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary"/>
            {roleId === 'new' ? 'Create New Role' : `Edit Role: ${role?.name}`}
          </CardTitle>
          <CardDescription>
            {roleId === 'new' ? 'Define a new role for your organization.' : 'Modify the name, description, and permissions for this role.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input id="role-name" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="role-description">Description</Label>
                <Textarea id="role-description" value={roleDescription} onChange={(e) => setRoleDescription(e.targe.value)} />
            </div>
          {ALL_PERMISSIONS.map(category => (
            <div key={category.title} className="p-4 border rounded-lg">
              <h3 className="font-semibold text-lg mb-4">{category.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.permissions.map(p => (
                  <div key={p.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50">
                    <Checkbox
                      id={p.id}
                      checked={permissions[p.id] || false}
                      onCheckedChange={(checked) => handlePermissionChange(p.id, !!checked)}
                    />
                    <div className="grid gap-1.5 leading-none">
                       <Label htmlFor={p.id} className="font-medium cursor-pointer">{p.name}</Label>
                       <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex justify-end">
            <Button onClick={onSave} disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save Role
            </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
