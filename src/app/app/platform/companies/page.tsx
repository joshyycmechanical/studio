
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, PlusCircle, Loader2, AlertCircle, Users, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Company } from '@/types/company';
import type { PlatformStats } from '@/types/platform';
import CompanyList from '@/components/platform/CompanyList';
import { fetchAllCompaniesApi, createCompanyApi, deleteCompanyApi, updateCompanyApi } from '@/services/companies';
import { fetchPlatformStats } from '@/services/platform';

// Import Dialog components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Skeleton } from '@/components/ui/skeleton';

const newCompanySchema = z.object({
  name: z.string().min(1, 'Company Name is required'),
  adminEmail: z.string().email('A valid admin email is required'),
  adminFullName: z.string().min(1, "Admin's Full Name is required"),
  subscription_plan: z.enum(['Trial', 'Starter', 'Pro', 'Enterprise']),
});
type NewCompanyFormData = z.infer<typeof newCompanySchema>;

const StatCard = ({ title, value, icon, description, isLoading }: { title: string, value: string | number, icon: React.ReactNode, description: string, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <>
                    <Skeleton className="h-8 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                </>
            ) : (
                <>
                    <div className="text-2xl font-bold">{value}</div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </>
            )}
        </CardContent>
    </Card>
);

export default function PlatformDashboardPage() {
    const { user: currentUser, loading: authLoading, firebaseUser } = useAuth();
    const { toast } = useToast();
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [stats, setStats] = React.useState<PlatformStats | null>(null);
    const [loadingData, setLoadingData] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false); // For new company form
    const [dialogOpen, setDialogOpen] = React.useState(false); // Control dialog visibility
    const [dialogError, setDialogError] = React.useState<string | null>(null);

    const { control, handleSubmit, reset, formState: { errors } } = useForm<NewCompanyFormData>({
        resolver: zodResolver(newCompanySchema),
        defaultValues: {
            name: '',
            adminEmail: '',
            adminFullName: '',
            subscription_plan: 'Trial',
        },
    });

    const canManage = !authLoading && hasPermission(currentUser, 'platform-companies', 'manage');
    
    const fetchData = React.useCallback(async () => {
        if (!canManage || !firebaseUser) {
            if (!authLoading) {
                setError("You don't have permission to manage companies.");
                setLoadingData(false);
            }
            return;
        }
        setLoadingData(true);
        setError(null);
        try {
            const idToken = await firebaseUser.getIdToken();
            const [fetchedCompanies, fetchedStats] = await Promise.all([
                fetchAllCompaniesApi(idToken),
                fetchPlatformStats(idToken),
            ]);
            setCompanies(fetchedCompanies);
            setStats(fetchedStats);
        } catch (err: any) {
            setError(err.message || "Failed to load platform data.");
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setLoadingData(false);
        }
    }, [canManage, firebaseUser, authLoading, toast]);
    
    React.useEffect(() => {
        if (firebaseUser) {
            fetchData();
        }
    }, [firebaseUser, fetchData]);

    const handleCreateCompany = async (data: NewCompanyFormData) => {
        setDialogError(null);
        if (!canManage || !firebaseUser) return;
        setIsSubmitting(true);
        try {
            const idToken = await firebaseUser.getIdToken();
            await createCompanyApi(idToken, data);
            toast({ title: 'Company Created', description: `${data.name} has been successfully created and seeded.` });
            reset();
            setDialogOpen(false);
            fetchData(); // Refresh the list
        } catch (err: any) {
            const errorMessage = err.message || 'An unknown error occurred.';
            console.error("Create company failed:", err);
            setDialogError(errorMessage);
            toast({ variant: 'destructive', title: 'Creation Failed', description: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCompany = async (companyId: string, companyName: string) => {
        if (!canManage || !firebaseUser) return;
        try {
            const idToken = await firebaseUser.getIdToken();
            await deleteCompanyApi(idToken, companyId);
            toast({ title: 'Company Deleted', description: `${companyName} has been marked as deleted.` });
            fetchData();
        } catch (err: any) {
            console.error("Delete company failed:", err);
            toast({ variant: 'destructive', title: 'Deletion Failed', description: err.message });
        }
    };
    
    const handleStatusChange = async (companyId: string, currentStatus: 'active' | 'paused' | 'deleted') => {
        if (!canManage || !firebaseUser) return;
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        try {
            const idToken = await firebaseUser.getIdToken();
            await updateCompanyApi(idToken, companyId, { status: newStatus });
            toast({ title: 'Status Updated', description: `Company status changed to ${newStatus}.` });
            fetchData();
        } catch (err: any) {
             console.error("Status change failed:", err);
            toast({ variant: 'destructive', title: 'Status Update Failed', description: err.message });
        }
    };

    if (authLoading) {
        return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
    }
    
    if (!canManage) {
        return (
            <main className="flex flex-1 flex-col items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>You do not have permission to manage companies.</AlertDescription>
                </Alert>
            </main>
        );
    }
    
    return (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setDialogError(null); }}>
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
                        <p className="text-muted-foreground">High-level overview of the entire platform.</p>
                    </div>
                     <DialogTrigger asChild>
                        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Company</Button>
                    </DialogTrigger>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard 
                        title="Total Companies"
                        value={stats?.totalCompanies ?? 0}
                        description={`${stats?.activeCompanies ?? 0} active`}
                        icon={<Building className="h-4 w-4 text-muted-foreground" />}
                        isLoading={loadingData}
                    />
                     <StatCard 
                        title="Active Users"
                        value={stats?.totalActiveUsers ?? 0}
                        description="Across all companies"
                        icon={<Users className="h-4 w-4 text-muted-foreground" />}
                        isLoading={loadingData}
                    />
                     <StatCard 
                        title="Trial Subscriptions"
                        value={stats?.subscriptions?.['Trial'] ?? 0}
                        description="Active trial accounts"
                        icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                        isLoading={loadingData}
                    />
                      <StatCard 
                        title="Pro Subscriptions"
                        value={stats?.subscriptions?.['Pro'] ?? 0}
                        description="Active professional plans"
                        icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
                        isLoading={loadingData}
                    />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            All Companies
                        </CardTitle>
                        <CardDescription>View, create, and manage all companies on the platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingData && !companies.length ? (
                            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : error ? (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error Loading Data</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : (
                            <CompanyList companies={companies} onDelete={handleDeleteCompany} onStatusChange={handleStatusChange} />
                        )}
                    </CardContent>
                    <CardFooter>
                        <div className="text-xs text-muted-foreground">
                            Total Companies: {companies.length}
                        </div>
                    </CardFooter>
                </Card>
            </main>

            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit(handleCreateCompany)}>
                    <DialogHeader>
                        <DialogTitle>Create New Company</DialogTitle>
                        <DialogDescription>
                            Fill in the details to create a new company account. An invitation will be sent to the admin email.
                        </DialogDescription>
                    </DialogHeader>
                    {dialogError && (
                        <Alert variant="destructive" className="my-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Creation Failed</AlertTitle>
                            <AlertDescription>{dialogError}</AlertDescription>
                        </Alert>
                    )}
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name <span className="text-destructive">*</span></Label>
                            <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} className="col-span-3" />} />
                            {errors.name && <p className="col-span-4 text-xs text-destructive text-right">{errors.name.message}</p>}
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="adminEmail" className="text-right">Admin Email <span className="text-destructive">*</span></Label>
                            <Controller name="adminEmail" control={control} render={({ field }) => <Input id="adminEmail" {...field} type="email" className="col-span-3" />} />
                             {errors.adminEmail && <p className="col-span-4 text-xs text-destructive text-right">{errors.adminEmail.message}</p>}
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="adminFullName" className="text-right">Admin Name <span className="text-destructive">*</span></Label>
                            <Controller name="adminFullName" control={control} render={({ field }) => <Input id="adminFullName" {...field} className="col-span-3" />} />
                            {errors.adminFullName && <p className="col-span-4 text-xs text-destructive text-right">{errors.adminFullName.message}</p>}
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="subscription_plan" className="text-right">Plan <span className="text-destructive">*</span></Label>
                             <Controller name="subscription_plan" control={control} render={({ field }) => (
                                 <Select onValueChange={field.onChange} value={field.value}>
                                     <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a plan" /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="Trial">Trial</SelectItem>
                                         <SelectItem value="Starter">Starter</SelectItem>
                                         <SelectItem value="Pro">Pro</SelectItem>
                                         <SelectItem value="Enterprise">Enterprise</SelectItem>
                                     </SelectContent>
                                 </Select>
                             )} />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Company
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
