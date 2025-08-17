'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings, AlertCircle, Loader2, CreditCard, Palette, ToggleRight, KeyRound, ShieldCheck, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

// TODO: Define state types for these settings when implementing real backend logic
// interface PlatformSettingsData {
//   stripePublishableKey: string;
//   stripeSecretKey: string; // Handled securely on backend
//   platformName: string;
//   platformLogoUrl: string;
//   defaultTerms: string;
//   featureFlags: { [key: string]: boolean };
//   // ... other settings
// }

export default function PlatformSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // --- Permission Check ---
  const canManagePlatformSettings = !authLoading && hasPermission(user, 'platform-settings', 'manage');

  // TODO: Fetch existing platform settings from a secure backend/config service
  React.useEffect(() => {
    if (canManagePlatformSettings) {
      // Simulate fetching settings
      setTimeout(() => {
        // setSettingsData(fetchedSettings);
        setIsLoading(false);
      }, 800);
    } else if (!authLoading) {
      setIsLoading(false); // Stop loading if no permission
    }
  }, [canManagePlatformSettings, authLoading]);

  // TODO: Implement save handlers for each section
  const handleSaveBillingSettings = async () => {
    setIsSaving(true);
    toast({ title: "Billing Settings (WIP)", description: "Saving Stripe keys..." });
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ title: "Billing Settings Updated (Simulated)" });
    setIsSaving(false);
  };

  const handleSaveBrandingSettings = async () => {
    setIsSaving(true);
    toast({ title: "Branding Settings (WIP)", description: "Saving platform name and logo..." });
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ title: "Branding Updated (Simulated)" });
    setIsSaving(false);
  };

  // --- Render Checks ---
  if (authLoading || isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!canManagePlatformSettings) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to manage platform settings.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6" /> Platform Settings
          </CardTitle>
          <CardDescription>Manage global platform configurations, integrations, and operational settings.</CardDescription>
        </CardHeader>
      </Card>

      {/* Billing & Subscription Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5"/> Billing & Subscription</CardTitle>
          <CardDescription>Configure Stripe integration for platform billing and manage subscription plans.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stripe-pk">Stripe Publishable Key</Label>
            <Input id="stripe-pk" placeholder="pk_test_xxxxxxxxxxxxxxx" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripe-sk">Stripe Secret Key</Label>
            <Input id="stripe-sk" type="password" placeholder="sk_test_xxxxxxxxxxxxxxx" />
            <p className="text-xs text-muted-foreground">Handled securely on the backend. Only enter if updating.</p>
          </div>
          {/* TODO: Add UI for managing subscription plans (Starter, Pro, Enterprise) and their features/limits */}
          <p className="text-muted-foreground text-sm">Subscription plan management UI (features, limits, pricing) will go here.</p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveBillingSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Billing Settings
          </Button>
        </CardFooter>
      </Card>

      {/* Branding & General Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Palette className="h-5 w-5"/> Branding & General</CardTitle>
          <CardDescription>Customize the platform's appearance and default terms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-name">Platform Name</Label>
            <Input id="platform-name" defaultValue="OpSite" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-logo">Platform Logo URL</Label>
            <Input id="platform-logo" placeholder="https://example.com/logo.png" />
            {/* TODO: Add file upload for logo */}
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-terms">Default Terms of Service</Label>
            <Textarea id="platform-terms" placeholder="Enter default terms and conditions for new companies..." rows={5}/>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveBrandingSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Branding
          </Button>
        </CardFooter>
      </Card>

      {/* Feature Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ToggleRight className="h-5 w-5"/> Feature Management</CardTitle>
          <CardDescription>Enable or disable platform-wide features and control rollout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TODO: Dynamically list features based on config */}
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="feature-ai-scheduling" className="text-base">AI-Powered Scheduling</Label>
              <p className="text-xs text-muted-foreground">Enable predictive scheduling and route optimization.</p>
            </div>
            <Switch id="feature-ai-scheduling" aria-label="Toggle AI Scheduling" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label htmlFor="feature-customer-surveys" className="text-base">Customer Satisfaction Surveys</Label>
              <p className="text-xs text-muted-foreground">Automatically send surveys after job completion.</p>
            </div>
            <Switch id="feature-customer-surveys" aria-label="Toggle Customer Surveys" />
          </div>
          <p className="text-muted-foreground text-sm">More feature flags and rollout controls will appear here.</p>
        </CardContent>
        <CardFooter>
          <Button disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Feature Settings
          </Button>
        </CardFooter>
      </Card>

       {/* API Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5"/> API Key Management</CardTitle>
          <CardDescription>Manage API keys for platform services and third-party integrations (e.g., Google Maps, Twilio).</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">API key management UI (view, generate, revoke) will go here.</p>
            {/* TODO:
                - List of integrated services (Google Maps, Email, SMS)
                - Input fields for relevant API keys
                - Secure storage and retrieval (backend only)
            */}
        </CardContent>
         <CardFooter>
          <Button disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save API Keys
          </Button>
        </CardFooter>
      </Card>

       {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5"/> Security Settings</CardTitle>
          <CardDescription>Configure global security policies like Multi-Factor Authentication (MFA) requirements.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Security policy configuration (e.g., MFA enforcement options) will go here.</p>
            {/* TODO:
                - Options to enforce MFA for all users / platform admins
                - Session timeout settings
                - Password complexity rules (if not handled by Firebase Auth directly)
            */}
        </CardContent>
         <CardFooter>
          <Button disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Security Settings
          </Button>
        </CardFooter>
      </Card>

    </main>
  );
}
