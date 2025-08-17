
'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarTrigger, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetHeader } from "@/components/ui/sheet"; // Corrected import
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
    Search, LogOut, Bell, Settings, Menu, Loader2
} from 'lucide-react';
import *as LucideIcons from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { Module } from '@/types/module';
import { groupModulesForSidebar } from '@/lib/roles-data';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { MyStatus } from '@/components/common/MyStatus';
import RoleSwitcher from '@/components/common/RoleSwitcher'; // Import the new component

// Helper to get Lucide icon component by name
const getIcon = (name: string): React.ElementType => {
    if (!name || typeof name !== 'string') return LucideIcons.HelpCircle; // Guard against undefined/wrong type
    // Capitalize first letter, and any letter after a hyphen.
    const correctedName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    const IconComponent = (LucideIcons as any)[correctedName];
    return IconComponent || LucideIcons.HelpCircle; // Fallback icon
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    user,
    authStatus,
    authError,
    installedModules,
  } = useAuth();

  // A single, top-level useEffect to handle all authentication-based routing.
  React.useEffect(() => {
    const isAuthPage = ['/login', '/signup'].includes(pathname);
    
    if (authStatus === 'loggedOut' && !isAuthPage) {
      router.replace('/login');
    }
    
    if (authStatus === 'loggedIn' && isAuthPage) {
      router.replace('/');
    }
  }, [authStatus, pathname, router]);

  const sidebarModuleGroups = React.useMemo(() => {
    if (authStatus !== 'loggedIn' || !user || !installedModules) return null;
    return groupModulesForSidebar(installedModules);
  }, [user, authStatus, installedModules]);

  const renderSidebarGroup = (groupKey: keyof Exclude<typeof sidebarModuleGroups, null>, modules: Module[]) => {
      if (!modules || modules.length === 0) return null;
      let groupLabel = String(groupKey).replace(/_/g, ' ').replace(/(^\w|\s\w)/g, (m: string) => m.toUpperCase());
      if (groupKey === 'dashboard') groupLabel = '';
      
      const modulesToRender = modules.filter(m => {
          return !modules.some(parent => parent.slug !== m.slug && m.default_path.startsWith(parent.default_path + '/') && parent.default_path !== '/');
      });

      if (modulesToRender.length === 0) return null;

      return (
          <React.Fragment key={groupKey}>
              {groupLabel && <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>}
              <SidebarMenu>
                  {modulesToRender.map((mod) => {
                      const Icon = getIcon(mod.icon);
                      let isActive = (mod.default_path === '/') ? pathname === '/' : pathname.startsWith(mod.default_path);
                      return (
                          <SidebarMenuItem key={mod.id}>
                              <Link href={mod.default_path}>
                                  <SidebarMenuButton tooltip={mod.name} isActive={isActive}>
                                      <Icon />
                                      <span>{mod.name}</span>
                                  </SidebarMenuButton>
                              </Link>
                          </SidebarMenuItem>
                      );
                  })}
              </SidebarMenu>
              {groupKey !== 'platform_admin' && groupKey !== 'dashboard' && <Separator className="my-2 group-data-[collapsible=icon]:hidden" />}
          </React.Fragment>
      );
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (authStatus !== 'loggedIn') {
    return <>{children}</>;
  }


  // If we reach this point, the user is authenticated, and we can render the full layout.
  const isSettingsPageActive = pathname.startsWith('/settings') || pathname.startsWith('/users') || pathname.startsWith('/customization') || pathname.startsWith('/roles');

  return (
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader className="p-4">
              <Link href="/" className="flex items-center gap-2">
                <Avatar className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center">
                   <span className="font-bold">O</span>
                 </Avatar>
                <h1 className="text-xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">OpSite</h1>
              </Link>
            </SidebarHeader>
             <SidebarContent className="p-2">
                <RoleSwitcher />
                {sidebarModuleGroups?.dashboard && renderSidebarGroup('dashboard', sidebarModuleGroups.dashboard)}
                {sidebarModuleGroups?.modules && renderSidebarGroup('modules', sidebarModuleGroups.modules)}
                {sidebarModuleGroups?.platform_admin && renderSidebarGroup('platform_admin', sidebarModuleGroups.platform_admin)}
            </SidebarContent>
            {/* REMOVED Settings from sidebar footer */}
          </Sidebar>
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="hidden md:flex" />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="sm:max-w-xs flex flex-col p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Mobile Navigation Menu</SheetTitle>
                    <SheetDescription>Main navigation links for the application.</SheetDescription>
                  </SheetHeader>
                <nav className="grid gap-6 text-lg font-medium p-6">
                  <Link href="/" className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base">
                    <span className="font-bold">O</span>
                    <span className="sr-only">OpSite</span>
                  </Link>
                  {Object.entries(sidebarModuleGroups || {}).map(([group, modules]) => (
                    modules.map((mod: Module) => {
                        const Icon = getIcon(mod.icon);
                        return (<Link key={mod.id} href={mod.default_path} className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"><Icon className="h-5 w-5" />{mod.name}</Link>)
                    })
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="relative ml-auto flex-1 md:grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search..."
                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                />
            </div>
            <ThemeToggle />
            <Tooltip>
                <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                    <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profile_photo_url ?? `https://picsum.photos/seed/${user?.email ?? 'user'}/40/40`} alt={user?.full_name ?? 'User Avatar'} data-ai-hint="person avatar" />
                    <AvatarFallback>{user?.full_name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? 'U'}</AvatarFallback>
                    </Avatar>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="font-semibold">{user?.full_name ?? 'My Account'}</div>
                    <div className="text-xs text-muted-foreground font-normal">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">My Profile</Link>
                  </DropdownMenuItem>
                   <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/support">Support</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/logout">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Logout</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            </header>
             {children}
             <MyStatus />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
  );
}
