
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Home, Briefcase, Wrench, FileText, Settings, LogOut, Menu, AlertCircle, Loader2
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PortalAuthProvider, usePortalAuth } from '@/context/PortalAuthContext';

interface PortalNavItem {
    href: string;
    label: string;
    icon: React.ElementType;
}

const portalNavItems: PortalNavItem[] = [
    { href: '/portal/dashboard', label: 'Dashboard', icon: Home },
    { href: '/portal/work-orders', label: 'Work Orders', icon: Briefcase },
    { href: '/portal/equipment', label: 'Equipment', icon: Wrench },
    { href: '/portal/invoices', label: 'Invoices', icon: FileText },
    { href: '/portal/settings', label: 'Settings', icon: Settings },
];

function PortalLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { customerUser, loading, error, logout } = usePortalAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading Portal...</span>
            </div>
        );
    }

    if (error) {
        return (
             <div className="flex h-screen items-center justify-center p-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    // In a real app, redirection would happen here based on auth state
    if (!customerUser) {
        return <div className="flex h-screen items-center justify-center">Redirecting to login...</div>;
    }


    const renderNavLinks = (isMobile = false) => (
        <nav className={`grid gap-2 text-lg font-medium ${isMobile ? '' : 'md:grid-flow-col md:gap-4 lg:gap-6'}`}>
            {portalNavItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/portal/dashboard' && pathname.startsWith(item.href));
                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <div className="flex min-h-screen w-full flex-col">
            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
                 <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle navigation menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="flex flex-col p-0">
                        <div className="flex h-16 items-center border-b px-6">
                            <Link href="/portal/dashboard" className="flex items-center gap-2 font-semibold">
                                 <span className="">Customer Portal</span>
                            </Link>
                        </div>
                         <div className="flex-1 overflow-auto py-2 px-4">
                            {renderNavLinks(true)}
                         </div>
                         <div className="mt-auto p-4 border-t">
                             <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
                                <LogOut className="h-4 w-4" /> Logout
                             </Button>
                         </div>
                    </SheetContent>
                </Sheet>

                 <div className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
                    <Link href="/portal/dashboard" className="flex items-center gap-2 text-lg font-semibold md:text-base mr-4">
                        <span className="">{customerUser?.companyName ?? 'Customer Portal'}</span>
                    </Link>
                     {renderNavLinks()}
                </div>

                <div className="ml-auto flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden sm:inline">{customerUser?.name}</span>
                     <Avatar className="h-8 w-8">
                        <AvatarImage src={customerUser?.avatarUrl} alt={customerUser?.name ?? 'Avatar'} data-ai-hint="person avatar" />
                        <AvatarFallback>{customerUser?.name?.charAt(0) ?? 'C'}</AvatarFallback>
                    </Avatar>
                     <Button variant="ghost" size="icon" onClick={logout} className="hidden md:flex" title="Logout">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

             <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/40">
                {children}
             </main>
        </div>
    );
}


export default function PortalLayout({ children }: { children: React.ReactNode }) {
    // If on the login page, don't wrap with provider to avoid layout flash
    const pathname = usePathname();
    if (pathname === '/portal/login') {
         return <main className="flex min-h-screen items-center justify-center bg-muted/40">{children}</main>;
    }

    return (
        <PortalAuthProvider>
            <PortalLayoutContent>{children}</PortalLayoutContent>
        </PortalAuthProvider>
    )
}
