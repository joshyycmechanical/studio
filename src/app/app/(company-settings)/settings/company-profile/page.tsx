
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Company } from '@/types/company';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Import the NEW, SECURE service functions that call the API
import { fetchMyCompanyProfile, updateMyCompanyProfile } from '@/services/companies';

const companyProfileSchema = z.object({
  name: z.string().min(1, 'Company Name is required'),
});

type CompanyProfileFormData = z.infer<typeof companyProfileSchema>;

export default function CompanyProfileSettingsPage() {
  const { user, companyId, loading: authLoading } = useAuth(); // Get auth loading state
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // The query now uses the secure API-based service function
  const { data: companyData, isLoading: loadingData, error } = useQuery<Company | null>({
    queryKey: ['myCompanyProfile'], // Unique key for this data
    queryFn: fetchMyCompanyProfile, // Use the new API service function
    enabled: !authLoading, // Only run when auth is done. The service function handles user context.
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: '',
    },
  });

  React.useEffect(() => {
    if (companyData) {
      reset({ name: companyData.name });
    }
  }, [companyData, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: CompanyProfileFormData) => {
        if (!companyId) throw new Error("Company context is missing.");
        if (!user) throw new Error("User not authenticated.");
        
        const updatePayload: Partial<Pick<Company, 'name'>> = { name: data.name.trim() };
        // Use the new API-based service function for updates
        return updateMyCompanyProfile(companyId, updatePayload);
    },
    onSuccess: () => {
        toast({ title: "Company Profile Updated", description: "Your company details have been saved." });
        queryClient.invalidateQueries({ queryKey: ['myCompanyProfile'] });
    },
    onError: (error: any) => {
        console.error("[CompanyProfile] Failed to update company profile:", error);
        toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not save changes." });
    }
  });


  const onSubmit = (data: CompanyProfileFormData) => {
    updateMutation.mutate(data);
  };

  // Show loader if auth is still resolving or the company data is being fetched
  if (authLoading || loadingData) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Show error if the query failed or if companyData is null after loading is complete
  if (error || !companyData) {
     return <div className="p-8 text-muted-foreground">Could not load company profile. Error: {error?.message || "Company data not found."}</div>;
  }

  const createdAtDate = companyData.created_at ? new Date(companyData.created_at) : new Date();

  return (
    <Card>
       <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Building className="h-5 w-5" /> Company Profile
            </CardTitle>
            <CardDescription>Update your company's basic information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name <span className="text-destructive">*</span></Label>
               <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <Input id="name" placeholder="Enter company name" {...field} />
                    )}
                />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>

             <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm font-medium">Subscription Plan</p>
                  <p className="text-muted-foreground">{companyData.subscription_plan}</p>
             </div>
             <div className="space-y-2">
                 <p className="text-sm font-medium">Status</p>
                 <p className="text-muted-foreground capitalize">{companyData.status}</p>
             </div>
             <div className="space-y-2">
                 <p className="text-sm font-medium">Created</p>
                 <p className="text-muted-foreground">
                     {createdAtDate ? format(createdAtDate, 'PPp') : 'N/A'}
                      {companyData.created_by && ` by ${companyData.created_by.substring(0,8)}...`}
                 </p>
             </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
    </Card>
  );
}
