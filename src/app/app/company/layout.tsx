
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, SlidersHorizontal, Package, Puzzle, UserCog, Upload } from 'lucide-react'; // Added Upload
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface SettingsNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: string; // Module slug for permission check
}

// Corrected hrefs to match the actual file structure
const settingsNavItems: SettingsNavItem[] = [
  { href: '/settings/company-profile', label: 'Company Profile', icon: Building, permission: 'company-profile' },
  { href: '/users', label: 'Users & Roles', icon: UserCog, permission: 'users' },
  { href: '/settings/modules', label: 'Installed Modules', icon: Package, permission: 'company-modules' },
  { href: '/settings/integrations', label: 'Integrations', icon: Puzzle, permission: 'integrations' },
  { href: '/customization/fields', label: 'Customization', icon: SlidersHorizontal, permission: 'customization' },
  { href: '/settings/import-data', label: 'Data Import', icon: Upload, permission: 'import-data' }, // New Item
  // Add other top-level settings pages here
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading: authLoading, companyId } = useAuth();
  
  // Check if user can access ANY of the settings pages
  const canAccessSettings = !authLoading && settingsNavItems.some(item => hasPermission(user, item.permission, 'view'));

  if (authLoading) {
    return <div>Loading...</div>; // Or a proper skeleton loader
  }

  if (!canAccessSettings) {
    return (
       <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have permission to access company settings.
            </AlertDescription>
          </Alert>
        </main>
    );
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] gap-6">
      {/* Settings Sidebar */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your company settings.</CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          <nav className="grid gap-1">
            {settingsNavItems.map((item) => {
              if (!hasPermission(user, item.permission, 'view')) return null;

              const isActive = pathname.startsWith(item.href);

              return (
                <Link key={item.label} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-2',
                      !isActive && 'text-muted-foreground'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div>
        {children}
      </div>
    </div>
  );
}
