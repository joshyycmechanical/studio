
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, SlidersHorizontal, Package, Puzzle, UserCog, Upload, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface SettingsNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: string;
}

const settingsNavItems: SettingsNavItem[] = [
  { href: '/settings/company-profile', label: 'Company Profile', icon: Building, permission: 'users' }, // Any company user can see profile
  { href: '/users', label: 'Users & Roles', icon: UserCog, permission: 'users' },
  { href: '/settings/modules', label: 'Installed Modules', icon: Package, permission: 'company-modules' },
  { href: '/settings/integrations', label: 'Integrations', icon: Puzzle, permission: 'integrations' },
  { href: '/settings/import-data', label: 'Data Import', icon: Upload, permission: 'import-data' },
  { href: '/customization/fields', label: 'Customization', icon: SlidersHorizontal, permission: 'customization' },
];

export default function CompanySettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, authStatus } = useAuth();
  
  const canAccessAnySettings = settingsNavItems.some(item => hasPermission(user, item.permission, 'view'));

  if (authStatus === 'loading') {
    return <div>Loading...</div>;
  }

  if (!canAccessAnySettings) {
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
      <Card className="hidden md:block self-start">
        <CardHeader>
          <CardTitle>Company Settings</CardTitle>
          <CardDescription>Manage your company's settings and modules.</CardDescription>
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
                    className={cn('w-full justify-start gap-2', !isActive && 'text-muted-foreground')}
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
      <div>
        {children}
      </div>
    </div>
  );
}
