'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Module } from '@/types/module';
import { allPlatformModules } from '@/lib/roles-data'; // Use hardcoded definitions
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
// Import Firestore service functions
import { fetchInstalledCompanyModules, updateCompanyModuleInstallations } from '@/services/modules';


export default function ModulesSettingsPage() {
  const { user, companyId, loading: authLoading, installedModules: contextModules, fetchUserProfile } = useAuth();
  const { toast } = useToast();
  const [installedModuleSlugs, setInstalledModuleSlugs] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filter modules available for company installation (exclude platform/internal/dashboard/core)
  const availableModules = React.useMemo(() => {
    return allPlatformModules.filter(m =>
        m.group !== 'platform_admin' &&
        !m.is_internal &&
        !['dashboard', 'settings', 'profile', 'support', 'logout'].includes(m.slug) &&
        m.group !== 'company_settings' // Also exclude settings group modules from toggling here
    );
  }, []);

  // Fetch installed modules on load using Firestore service
  useEffect(() => {
    if (authLoading || !companyId) {
        setLoadingData(authLoading);
        return;
    }
    const fetchData = async () => {
        setLoadingData(true);
        try {
            console.log(`[ModulesSettingsPage] Fetching installed modules for company ${companyId}`);
            // Fetch installed modules (which includes core ones implicitly)
            const companyModules = await fetchInstalledCompanyModules(companyId);
            // Extract slugs from the fetched full module definitions
            const slugs = companyModules.map(mod => mod.slug);
            setInstalledModuleSlugs(new Set(slugs));
             console.log("[ModulesSettingsPage] Installed slugs:", slugs);
        } catch (error) {
            console.error("[ModulesSettingsPage] Error fetching installed modules:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load module settings." });
        } finally {
            setLoadingData(false);
        }
    };
    fetchData();
  }, [companyId, authLoading, toast]);


  const handleModuleToggle = (moduleSlug: string, checked: boolean) => {
    setInstalledModuleSlugs(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(moduleSlug);
      } else {
        newSet.delete(moduleSlug);
      }
       console.log("Updated slugs set:", newSet);
      return newSet;
    });
  };

  const handleSaveChanges = async () => {
     if (!companyId) return;
     setIsSaving(true);
     try {
        const slugsToSave = Array.from(installedModuleSlugs);
         // Filter out core slugs that shouldn't be saved in the installations collection
         const filteredSlugsToSave = slugsToSave.filter(slug =>
             !['dashboard', 'settings', 'profile', 'support', 'logout'].includes(slug) &&
             !allPlatformModules.find(m => m.slug === slug && m.group === 'company_settings')
         );
         console.log("[ModulesSettingsPage] Saving slugs:", filteredSlugsToSave);

         // Call Firestore service to update installations
         await updateCompanyModuleInstallations(companyId, filteredSlugsToSave);

        toast({ title: "Modules Updated", description: "Installed modules have been saved." });
        // Refetch user profile to update modules in context (important for sidebar)
        if(fetchUserProfile) {
            await fetchUserProfile();
             // Optionally, refetch local state to be absolutely sure, though context should handle it
             // const companyModules = await fetchInstalledCompanyModules(companyId);
             // const slugs = companyModules.map(mod => mod.slug);
             // setInstalledModuleSlugs(new Set(slugs));
        } else {
             console.warn("[ModulesSettingsPage] fetchUserProfile function not available in AuthContext.");
        }
     } catch (error: any) {
        console.error("[ModulesSettingsPage] Error saving module settings:", error);
        toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save module settings." });
     } finally {
        setIsSaving(false);
     }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" /> Installed Modules
        </CardTitle>
        <CardDescription>Enable or disable features (modules) for your company.</CardDescription>
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
                    {/* TODO: Add module descriptions */}
                    Enable access to {module.name.toLowerCase()} features.
                  </span>
                </Label>
                <Switch
                  id={`module-${module.slug}`}
                  checked={installedModuleSlugs.has(module.slug)}
                  onCheckedChange={(checked) => handleModuleToggle(module.slug, checked)}
                  aria-label={`Toggle ${module.name}`}
                   disabled={isSaving} // Disable toggle while saving
                />
              </div>
            ))}
             {availableModules.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center">No optional modules available.</p>
            )}
          </div>
        )}
      </CardContent>
       <CardFooter className="border-t px-6 py-4">
            <Button onClick={handleSaveChanges} disabled={isSaving || loadingData}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Module Settings
            </Button>
        </CardFooter>
    </Card>
  );
}
