
'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Building, ShieldCheck, Users, DollarSign, Palette, Puzzle, Settings as SettingsIcon } from 'lucide-react';

const sidebarNavItems = [
  { title: "Company Profile", href: "/settings/company-profile", icon: Building },
  { title: "Users", href: "/settings/users", icon: Users },
  { title: "Roles & Permissions", href: "/settings/roles", icon: ShieldCheck },
  { title: "Billing", href: "/settings/billing", icon: DollarSign },
  { title: "Integrations", href: "/settings/integrations", icon: Puzzle },
  { title: "Appearance", href: "/customization/theme", icon: Palette },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  
  return (
    <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 p-4">
        <aside className="lg:w-1/5">
            <h2 className="text-xl font-bold tracking-tight flex items-center mb-4"><SettingsIcon className="mr-2 h-5 w-5"/> Settings</h2>
            <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
            {sidebarNavItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        "inline-flex items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground px-3 py-2",
                        pathname === item.href ? "bg-muted" : "bg-transparent"
                    )}
                >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.title}
                </Link>
            ))}
            </nav>
        </aside>
        <div className="flex-1 lg:max-w-4xl">{children}</div>
    </div>
  );
}
