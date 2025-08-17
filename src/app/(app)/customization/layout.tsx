
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, FilePlus, Palette } from 'lucide-react';
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
  { href: '/customization/theme', label: 'Theme', icon: Palette },
];

export default function CustomizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  // This check is already done by the parent settings layout, but it's good practice
  // to keep it here in case this layout is used elsewhere.
  const canManageCustomization = !authLoading && hasPermission(user, 'customization', 'manage');

  if (authLoading) {
    return <div>Loading...</div>;
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6" /> Form & Field Customization
        </CardTitle>
        <CardDescription>
            Modify forms, add custom fields, and create field templates for your modules.
        </CardDescription>
         <nav className="flex items-center space-x-2 border-t pt-4 mt-4">
            {customizationNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.label} href={item.href} passHref>
                  <Button variant={isActive ? "secondary" : "ghost"} size="sm">
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}
