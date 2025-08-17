
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import type { Company } from '@/types/company';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
// Import real data service functions that call APIs
import { fetchCompanyByIdApi, updateCompanyApi } from '@/services/companies';

// Define the form schema for editable settings
const companySettingsSchema = z.object({
  default_timezone: z.string().optional().nullable(),
  // Add other editable settings here as needed
});

type CompanySettingsFormData = z.infer<typeof companySettingsSchema>;

export default function PlatformCompanySettingsPage() {
  const router = useRouter();
  const { companyId: companyIdParam } = useParams() as { companyId: string };
  const { toast } = useToast();
  const { user: currentUser, loading: authLoading, firebaseUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManagePlatformCompanies = !authLoading && hasPermission(currentUser, 'platform-companies', 'manage');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CompanySettingsFormData>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      default_timezone: '',
    },
  });

  const fetchData = useCallback(async () => {
    if (!canManagePlatformCompanies || !companyIdParam || !firebaseUser) {
      setError(canManagePlatformCompanies ? "Company ID or Firebase user missing." : "Access Denied.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const foundCompany = await fetchCompanyByIdApi(idToken, companyIdParam);

      if (!foundCompany) {
        throw new Error("Company not found or access denied.");
      }
      setCompanyData(foundCompany);
      reset({
        default_timezone: foundCompany.default_timezone ?? '',
      });
    } catch (err: any) {
      console.error("Error fetching company data:", err);
      setError(err.message || "Failed to load company data.");
      toast({ variant: "destructive", title: "Error Loading Company", description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [companyIdParam, reset, toast, canManagePlatformCompanies, firebaseUser]);

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      fetchData();
    }
  }, [fetchData, authLoading, firebaseUser]);

  const onSubmit = async (data: CompanySettingsFormData) => {
    if (!canManagePlatformCompanies || !companyData || !firebaseUser) {
      toast({ variant: "destructive", title: "Error", description: "Cannot save: Missing data or permissions." });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const updatePayload: Partial<Pick<Company, 'default_timezone'>> = {
        default_timezone: data.default_timezone?.trim() || null,
      };
      await updateCompanyApi(idToken, companyData.id, updatePayload);
      toast({ title: "Company Settings Updated", description: `${companyData.name}'s settings saved.` });
      fetchData(); // Refetch to update form and local state
    } catch (error: any) {
      console.error("Failed to update company settings:", error);
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || authLoading) {
    return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></main>;
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{error.startsWith("Access Denied") ? "Access Denied" : "Error"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.push(`/platform/companies/${companyIdParam}`)} className="mt-4">Back to Company</Button>
        </Alert>
      </main>
    );
  }

  if (!companyData) {
    return <main className="flex flex-1 items-center justify-center"><p>Company data could not be loaded.</p></main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <Button variant="link" onClick={() => router.push(`/platform/companies/${companyIdParam}`)} className="p-0 h-auto text-sm text-muted-foreground mb-1 self-start">
            &larr; Back to {companyData.name} Details
          </Button>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" /> Advanced Settings for: {companyData.name}
          </CardTitle>
          <CardDescription>Manage advanced configurations for this company.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="default_timezone">Default Timezone</Label>
              <Controller
                name="default_timezone"
                control={control}
                render={({ field }) => (
                  <Input
                    id="default_timezone"
                    placeholder="e.g., America/Denver, Europe/London"
                    {...field}
                    value={field.value ?? ''}
                  />
                )}
              />
              {errors.default_timezone && <p className="text-sm text-destructive mt-1">{errors.default_timezone.message}</p>}
              <p className="text-xs text-muted-foreground">
                Enter a valid IANA timezone identifier (e.g., America/New_York).
              </p>
            </div>
            
            {/* Placeholder for more settings */}
            <div className="pt-4 border-t">
              <p className="text-muted-foreground">More company-specific settings will appear here.</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push(`/platform/companies/${companyIdParam}`)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Settings
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
