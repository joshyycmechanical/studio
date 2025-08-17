
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Loader2, AlertCircle, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import type { Module } from '@/types/module';
import type { Company } from '@/types/company';
import { allPlatformModules } from '@/lib/roles-data';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
// Import API-based Firestore service functions
import { fetchInstalledCompanyModulesApi, updateCompanyModuleInstallationsApi } from '@/services/modules';
import { fetchCompanyByIdApi } from '@/services/companies';


export default function PlatformManageCompanyModulesPage() {
  const { user: currentUser, loading: authLoading, firebaseUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { companyId: companyIdParam } = useParams() as { companyId: string };

  const [targetCompany, setTargetCompany] = useState<Company | null>(null);
  const [installedModuleSlugs, setInstalledModuleSlugs] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManagePlatformCompanies = !authLoading && hasPermission(currentUser, 'platform-companies', 'manage');

  const availableModules = React.useMemo(() => {
    return allPlatformModules.filter(m =>
        m.group !== 'platform_admin' &&
        !m.is_internal &&
        !['dashboard', 'settings', 'profile', 'support', 'logout'].includes(m.slug) &&
        m.group !== 'company_settings'
    );
  }, []);

  const fetchData = useCallback(async () => {
    if (!companyIdParam || !canManagePlatformCompanies || !firebaseUser) {
        setError("Access Denied or missing information.");
        setLoadingData(false);
        return;
    }
    setLoadingData(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const [companyDetails, fetchedSlugs] = await Promise.all([
        fetchCompanyByIdApi(idToken, companyIdParam),
        fetchInstalledCompanyModulesApi(idToken, companyIdParam)
      ]);

      if (!companyDetails) {
        throw new Error("Company details not found.");
      }
      setTargetCompany(companyDetails);
      setInstalledModuleSlugs(new Set(fetchedSlugs));
    } catch (err: any) {
      console.error("[PlatformManageModules] Error fetching data:", err);
      setError(err.message || "Could not load module settings for this company.");
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load data." });
    } finally {
      setLoadingData(false);
    }
  }, [companyIdParam, canManagePlatformCompanies, firebaseUser, toast]);

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      fetchData();
    }
  }, [fetchData, authLoading, firebaseUser]);

  const handleModuleToggle = (moduleSlug: string, checked: boolean) => {
    setInstalledModuleSlugs(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(moduleSlug);
      else newSet.delete(moduleSlug);
      return newSet;
    });
  };

  const handleSaveChanges = async () => {
    if (!companyIdParam || !canManagePlatformCompanies || !firebaseUser) return;
    setIsSaving(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const slugsToSave = Array.from(installedModuleSlugs);
      const filteredSlugsToSave = slugsToSave.filter(slug =>
          !['dashboard', 'settings', 'profile', 'support', 'logout'].includes(slug) &&
          !allPlatformModules.find(m => m.slug === slug && m.group === 'company_settings')
      );
      await updateCompanyModuleInstallationsApi(idToken, companyIdParam, filteredSlugsToSave);
      toast({ title: "Modules Updated", description: `Installed modules for ${targetCompany?.name || 'company'} have been saved.` });
    } catch (error: any) {
      console.error("[PlatformManageModules] Error saving module settings:", error);
      toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save module settings." });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (!targetCompany && loadingData)) {
    return <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></main>;
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.push(`/platform/companies/${companyIdParam}`)} className="mt-4">Back to Company Details</Button>
        </Alert>
      </main>
    );
  }

  if (!canManagePlatformCompanies) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to manage company modules.</AlertDescription>
        </Alert>
      </main>
    );
  }


  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <Card>
            <CardHeader>
                 <Button variant="link" onClick={() => router.push(`/platform/companies/${companyIdParam}`)} className="p-0 h-auto text-sm text-muted-foreground mb-1 self-start">
                    &larr; Back to {targetCompany?.name || 'Company'} Details
                </Button>
                <CardTitle className="flex items-center gap-2">
                <Package className="h-6 w-6" /> Manage Installed Modules for: {targetCompany?.name || 'Loading...'}
                </CardTitle>
                <CardDescription>Enable or disable features (modules) for this company.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingData ? (
                <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableModules.map(module => (
                    <div key={module.id} className="flex items-center justify-between space-x-2 rounded-md border p-4">
                        <Label htmlFor={`module-${module.slug}`} className="flex flex-col space-y-1">
                        <span>{module.name}</span>
                        <span className="font-normal leading-snug text-muted-foreground text-xs">
                            Enable access to {module.name.toLowerCase()} features for {targetCompany?.name}.
                        </span>
                        </Label>
                        <Switch
                        id={`module-${module.slug}`}
                        checked={installedModuleSlugs.has(module.slug)}
                        onCheckedChange={(checked) => handleModuleToggle(module.slug, checked)}
                        aria-label={`Toggle ${module.name}`}
                        disabled={isSaving}
                        />
                    </div>
                    ))}
                    {availableModules.length === 0 && (
                        <p className="text-muted-foreground col-span-full text-center">No optional modules available for companies.</p>
                    )}
                </div>
                )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
                <Button onClick={handleSaveChanges} disabled={isSaving || loadingData}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Module Settings for {targetCompany?.name}
                </Button>
            </CardFooter>
        </Card>
    </main>
  );
}
