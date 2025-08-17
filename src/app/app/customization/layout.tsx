
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, FilePlus, Palette } from 'lucide-react'; // Added Palette for Theme
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface CustomizationNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

// Define navigation items for Customization
const customizationNavItems: CustomizationNavItem[] = [
  { href: '/customization/fields', label: 'Field Editor', icon: SlidersHorizontal },
  { href: '/customization/templates', label: 'Field Templates', icon: FilePlus },
  { href: '/customization/theme', label: 'Theme', icon: Palette }, // Add Theme page
];

export default function CustomizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading: authLoading, companyId } = useAuth();

  // Check permission to manage customization settings
  const canManageCustomization = !authLoading && hasPermission(user, 'customization', 'manage');

  if (authLoading) {
    return <div>Loading...</div>; // Or a proper skeleton loader
  }

  if (!canManageCustomization) {
    return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
         <Alert variant="destructive" className="m-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have permission to manage customization settings.
            </AlertDescription>
          </Alert>
        </main>
    );
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] gap-6">
      {/* Customization Sidebar */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SlidersHorizontal className="h-5 w-5" /> Customization
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <nav className="grid gap-1">
            {customizationNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href);
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
