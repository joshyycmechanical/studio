import type { Module } from '@/types/module';
import type { Role, ModulePermissions } from '@/types/role';
import type { WorkflowStatusConfig } from '@/types/workflow';

export function createFullAccess(canAccess = true): ModulePermissions {
  return {
    can_access: canAccess,
    view: canAccess,
    create: canAccess,
    edit: canAccess,
    delete: canAccess,
    assign: canAccess,
    approve: canAccess,
    send: canAccess,
    manage_status: canAccess,
    process_payment: canAccess,
    link_qr: canAccess,
    transfer: canAccess,
    ocr: canAccess,
    recurring: canAccess,
    convert: canAccess,
    fill: canAccess,
    live: canAccess,
    upload: canAccess,
    manage: canAccess,
    generate: canAccess,
    resolve: canAccess,
    impersonate: canAccess,
    export: canAccess,
  };
}

export const allPlatformModules: Module[] = [
  // Dashboard & Core
  { id: 'mod-dash', slug: 'dashboard', name: 'Dashboard', icon: 'Home', is_internal: false, default_path: '/', group: 'dashboard', order: 10 },
  { id: 'mod-prof', slug: 'profile', name: 'My Profile', icon: 'User', is_internal: false, default_path: '/profile', group: 'dashboard', order: 20 },
  { id: 'mod-todo', slug: 'todos', name: 'My Tasks', icon: 'ListTodo', is_internal: false, default_path: '/todos', group: 'dashboard', order: 30 },

  // Company Operations Modules
  { id: 'mod-wo', slug: 'work-orders', name: 'Work Orders', icon: 'Briefcase', is_internal: false, default_path: '/work-orders', group: 'modules', order: 10 },
  { id: 'mod-sched', slug: 'scheduling', name: 'Scheduling', icon: 'Calendar', is_internal: false, default_path: '/scheduling', group: 'modules', order: 20 },
  { id: 'mod-cust', slug: 'customers', name: 'Customers', icon: 'Users', is_internal: false, default_path: '/customers', group: 'modules', order: 30 },
  { id: 'mod-loc', slug: 'locations', name: 'Locations', icon: 'MapPin', is_internal: false, default_path: '/locations', group: 'modules', order: 40 },
  { id: 'mod-equip', slug: 'equipment', name: 'Equipment', icon: 'Wrench', is_internal: false, default_path: '/equipment', group: 'modules', order: 50 },
  { id: 'mod-def', slug: 'deficiencies', name: 'Deficiencies', icon: 'ShieldAlert', is_internal: false, default_path: '/deficiencies', group: 'modules', order: 60 },
  { id: 'mod-rep', slug: 'repairs', name: 'Repairs', icon: 'Construction', is_internal: false, default_path: '/repairs', group: 'modules', order: 70 },
  { id: 'mod-inv', slug: 'inventory', name: 'Inventory', icon: 'Warehouse', is_internal: false, default_path: '/inventory', group: 'modules', order: 80 },
  { id: 'mod-po', slug: 'purchase-orders', name: 'Purchase Orders', icon: 'ShoppingCart', is_internal: false, default_path: '/purchase-orders', group: 'modules', order: 90 },
  { id: 'mod-est', slug: 'estimates', name: 'Estimates', icon: 'DollarSign', is_internal: false, default_path: '/estimates', group: 'modules', order: 100 },
  { id: 'mod-invoice', slug: 'invoicing', name: 'Invoicing', icon: 'FileText', is_internal: false, default_path: '/invoicing', group: 'modules', order: 110 },
  { id: 'mod-maint', slug: 'maintenance', name: 'Maintenance', icon: 'CalendarCheck', is_internal: false, default_path: '/maintenance', group: 'modules', order: 120 },
  { id: 'mod-chk', slug: 'checklists', name: 'Checklists', icon: 'ClipboardCheck', is_internal: false, default_path: '/checklists', group: 'modules', order: 130 },
  { id: 'mod-time', slug: 'timesheets', name: 'Timesheets', icon: 'Clock', is_internal: false, default_path: '/timesheets', group: 'modules', order: 140 },
  { id: 'mod-payroll', slug: 'payroll', name: 'Payroll', icon: 'DollarSign', is_internal: false, default_path: '/payroll', group: 'modules', order: 150 },
  { id: 'mod-reports', slug: 'reports', name: 'Reports', icon: 'BarChart3', is_internal: false, default_path: '/reports', group: 'modules', order: 160 },
  { id: 'mod-files', slug: 'files', name: 'Files', icon: 'FolderOpen', is_internal: false, default_path: '/files', group: 'modules', order: 170 },
  { id: 'mod-chat', slug: 'chat', name: 'Chat', icon: 'MessageSquare', is_internal: false, default_path: '/chat', group: 'modules', order: 180 },
  { id: 'mod-gps', slug: 'gps-tracking', name: 'GPS Tracking', icon: 'Map', is_internal: true, default_path: '/gps-tracking', group: 'modules', order: 190 }, // Internal for now
  { id: 'mod-auto', slug: 'automation', name: 'Automation', icon: 'Bot', is_internal: false, default_path: '/automation', group: 'modules', order: 200 },


  // Company Settings Group
  { id: 'mod-settings', slug: 'settings', name: 'Settings', icon: 'Settings', is_internal: false, default_path: '/settings/company-profile', group: 'company_settings', order: 10 }, // Point to a default sub-page
  { id: 'mod-users', slug: 'users', name: 'Users', icon: 'Users2', is_internal: false, default_path: '/users', group: 'company_settings', order: 20 },
  { id: 'mod-roles', slug: 'roles', name: 'Roles', icon: 'UserCog', is_internal: false, default_path: '/roles', group: 'company_settings', order: 30 },
  { id: 'mod-comp-profile', slug: 'company-profile', name: 'Company Profile', icon: 'Building', is_internal: false, default_path: '/settings/company-profile', group: 'company_settings', order: 40 },
  { id: 'mod-billing', slug: 'billing', name: 'Billing', icon: 'CreditCard', is_internal: false, default_path: '/settings/billing', group: 'company_settings', order: 50 },
  { id: 'mod-cmodules', slug: 'company-modules', name: 'Installed Modules', icon: 'Package', is_internal: false, default_path: '/settings/modules', group: 'company_settings', order: 60 },
  { id: 'mod-integrations', slug: 'integrations', name: 'Integrations', icon: 'Puzzle', is_internal: false, default_path: '/settings/integrations', group: 'company_settings', order: 70 },
  { id: 'mod-customization', slug: 'customization', name: 'Customization', icon: 'SlidersHorizontal', is_internal: false, default_path: '/customization/fields', group: 'company_settings', order: 80 },
  { id: 'mod-import', slug: 'import-data', name: 'Data Import', icon: 'Upload', is_internal: false, default_path: '/settings/import-data', group: 'company_settings', order: 90 },


  // Platform Admin Modules (only accessible to platform roles)
  { id: 'mod-p-companies', slug: 'platform-companies', name: 'Manage Companies', icon: 'Building', is_internal: false, default_path: '/platform/companies', group: 'platform_admin', order: 10 },
  { id: 'mod-p-templates', slug: 'platform-templates', name: 'Manage Templates', icon: 'Database', is_internal: false, default_path: '/platform/templates', group: 'platform_admin', order: 20 },
  { id: 'mod-p-audit', slug: 'audit-logs', name: 'Audit Logs', icon: 'BookText', is_internal: false, default_path: '/audit-logs', group: 'platform_admin', order: 30 }, // Global audit log
  { id: 'mod-p-lang', slug: 'language', name: 'Language Settings', icon: 'Languages', is_internal: true, default_path: '/language', group: 'platform_admin', order: 40 },
  { id: 'mod-p-settings', slug: 'platform-settings', name: 'Platform Settings', icon: 'Settings2', is_internal: false, default_path: '/platform/settings', group: 'platform_admin', order: 50 },


  // Support & Logout (Special case, always available if logged in)
  { id: 'mod-support', slug: 'support', name: 'Support', icon: 'LifeBuoy', is_internal: false, default_path: '/support', group: 'dashboard', order: 990 },
  { id: 'mod-logout', slug: 'logout', name: 'Logout', icon: 'LogOut', is_internal: false, default_path: '/logout', group: 'dashboard', order: 1000 },
];


export const initialRoleTemplates: Role[] = [
  // Platform Roles
  {
    id: 'platform-owner',
    name: 'Platform Owner',
    description: 'Full unrestricted access to the entire OpSite platform, all companies, and all settings. Typically the founding account.',
    company_id: null,
    is_template: true,
    permissions: {
      'platform-companies': createFullAccess(),
      'platform-templates': createFullAccess(),
      'audit-logs': createFullAccess(),
      'language': createFullAccess(),
      'platform-settings': createFullAccess(), // Platform Owner has full access to platform settings
    },
  },
  {
    id: 'platform-admin',
    name: 'Platform Administrator',
    description: 'Manages platform-level operations, companies, and global templates.',
    company_id: null,
    is_template: true,
    permissions: {
      'platform-companies': createFullAccess(),
      'platform-templates': createFullAccess(),
      'audit-logs': { can_access: true, view: true, generate: true }, // Cannot delete logs
      'language': { can_access: true, edit: true },
      'platform-settings': createFullAccess(), // Platform Admin has full access to platform settings
    },
  },
  {
    id: 'platform-support',
    name: 'Platform Support Specialist',
    description: 'Assists companies and users with OpSite, troubleshoots issues.',
    company_id: null,
    is_template: true,
    permissions: {
      'platform-companies': { can_access: true, view: true }, // View companies for support context
      'platform-templates': { can_access: true, view: true }, // View templates
      'audit-logs': { can_access: true, view: true }, // View logs for troubleshooting
      'users': {can_access: true, view: true }, // View users across companies for support
      'platform-settings': { can_access: true, view: true }, // View platform settings for support
    },
  },
  {
    id: 'platform-developer',
    name: 'Platform Developer',
    description: 'Internal role for OpSite engineering and development tasks.',
    company_id: null,
    is_template: true,
    permissions: {
      // Access to specific internal/dev modules, not general company data unless needed
      'platform-companies': {can_access: true, view: true}, // Potentially view for debugging
      'dev-tools': createFullAccess(), // Hypothetical module for dev tools
      'platform-settings': {can_access: true, view: true, edit: true} // Devs may need to edit settings
    },
  },
  {
    id: 'platform-auditor',
    name: 'Platform Auditor',
    description: 'Read-only role for compliance, legal, or review purposes at the platform level.',
    company_id: null,
    is_template: true,
    permissions: {
      'platform-companies': { can_access: true, view: true },
      'audit-logs': { can_access: true, view: true },
      'users': {can_access: true, view: true},
      'platform-settings': { can_access: true, view: true }, // Auditors can view settings
      // No create/edit/delete anywhere
    },
  },

  // Company Role Templates (to be cloned for each company)
  {
    id: 'admin-template', // Company Administrator
    name: 'Administrator (Template)',
    description: 'Full access to company features and settings.',
    company_id: null, // This is a template, company_id will be set when cloned
    is_template: true,
    permissions: {
      // Grant all non-platform permissions by default
      ...allPlatformModules
        .filter(m => m.group !== 'platform_admin' && m.slug !== 'platform-settings') // Exclude platform settings from company admin
        .reduce((acc, mod) => {
          acc[mod.slug] = createFullAccess();
          return acc;
        }, {} as { [key: string]: ModulePermissions | boolean }),
        'company-profile': true, // Explicitly grant access to company profile settings
    },
  },
  {
    id: 'technician-template',
    name: 'Technician (Template)',
    description: 'Performs field work, manages assigned work orders.',
    company_id: null,
    is_template: true,
    permissions: {
      'dashboard': { can_access: true, view: true },
      'work-orders': { can_access: true, view: true, edit: true, manage_status: true, create: true }, // Added create: true
      'scheduling': { can_access: true, view: true }, // View their own schedule
      'locations': { can_access: true, view: true },
      'equipment': { can_access: true, view: true, create: true, edit: true },
      'checklists': { can_access: true, view: true, fill: true },
      'timesheets': { can_access: true, create: true, view: true, edit: true }, // Their own timesheets
      'files': {can_access: true, view: true, upload: true},
      'deficiencies': {can_access: true, view: true, create: true, edit: true, resolve: true},
      'repairs': {can_access: true, view: true, create: true, edit: true},
      'inventory': {can_access: true, view: true}, // View parts, potentially adjust van stock
      'todos': { can_access: true, manage: true },
      'profile': { can_access: true, view: true, edit: true },
      'support': { can_access: true },
      'logout': { can_access: true },
    },
  },
  {
    id: 'dispatcher-template',
    name: 'Dispatcher (Template)',
    description: 'Manages scheduling, work order assignment, and technician tracking.',
    company_id: null,
    is_template: true,
    permissions: {
      'dashboard': { can_access: true, view: true },
      'work-orders': { can_access: true, view: true, create: true, edit: true, manage_status: true, assign: true }, // Added create: true
      'scheduling': createFullAccess(),
      'customers': { can_access: true, view: true },
      'locations': { can_access: true, view: true },
      'equipment': { can_access: true, view: true },
      'users': { can_access: true, view: true }, // View technicians for assignment
      'gps-tracking': { can_access: true, live: true },
      'profile': { can_access: true, view: true, edit: true },
      'support': { can_access: true },
      'logout': { can_access: true },
    },
  },
  {
    id: 'office-manager-template',
    name: 'Office Manager (Template)',
    description: 'Handles invoicing, estimates, purchase orders, and reporting.',
    company_id: null,
    is_template: true,
    permissions: {
      'dashboard': { can_access: true, view: true },
      'work-orders': { can_access: true, view: true, edit: true, create: true }, // Added create: true
      'customers': createFullAccess(),
      'locations': { can_access: true, view: true, create: true, edit: true },
      'equipment': { can_access: true, view: true },
      'estimates': createFullAccess(),
      'invoicing': createFullAccess(),
      'purchase-orders': createFullAccess(),
      'reports': { can_access: true, view: true, generate: true },
      'users': { can_access: true, view: true }, // View users for context
      'profile': { can_access: true, view: true, edit: true },
      'support': { can_access: true },
      'logout': { can_access: true },
    },
  },
  {
    id: 'customer-portal-template', // Role for end-customers accessing the portal
    name: 'Customer Portal Access (Template)',
    description: 'Access for company clients to view their service history, equipment, and invoices.',
    company_id: null, // Template, will be company-specific when a customer user is created
    is_template: true,
    permissions: {
        // Very limited, specific to portal functionality
        'portal-dashboard': { can_access: true, view: true },
        'portal-work-orders': { can_access: true, view: true }, // View their own WOs
        'portal-equipment': { can_access: true, view: true }, // View their own equipment
        'portal-invoices': { can_access: true, view: true, process_payment: true }, // View their own invoices, make payments
        'portal-settings': { can_access: true, edit: true }, // Manage their portal contact info
        'logout': {can_access: true}, // Allow logout from portal
    },
  }
];

export function groupModulesForSidebar(modules: Module[]): { [group: string]: Module[] } {
  const grouped: { [group: string]: Module[] } = {
    dashboard: [],
    modules: [],
    company_settings: [],
    platform_admin: [],
  };

  modules.forEach(mod => {
    if (grouped[mod.group]) {
      grouped[mod.group].push(mod);
    } else {
      // Fallback for unknown groups, though ideally all modules have a defined group
      if (!grouped.modules) grouped.modules = [];
      grouped.modules.push(mod);
    }
  });

  // Sort modules within each group by the 'order' property
  for (const groupKey in grouped) {
    grouped[groupKey].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }
  return grouped;
}


// --- Default Data Definitions for Seeding ---

export const DEFAULT_COMPANY_ROLES_DATA: Array<Omit<Role, 'id' | 'company_id' | 'is_template'>> = [
    // 1. Company Administrator (Clone of admin-template)
    {
        name: 'Administrator',
        description: 'Full access to all company features and settings.',
        permissions: initialRoleTemplates.find(r => r.id === 'admin-template')?.permissions || {},
    },
    // 2. Technician (Clone of technician-template)
    {
        name: 'Technician',
        description: 'Access to assigned work orders, scheduling, and inventory usage.',
        permissions: initialRoleTemplates.find(r => r.id === 'technician-template')?.permissions || {},
    },
    // 3. Dispatcher (Clone of dispatcher-template)
     {
        name: 'Dispatcher',
        description: 'Manages scheduling, work order assignment, and technician tracking.',
        permissions: initialRoleTemplates.find(r => r.id === 'dispatcher-template')?.permissions || {},
    },
    // 4. Office Manager (Clone of office-manager-template)
    {
        name: 'Office Manager',
        description: 'Handles invoicing, estimates, purchase orders, and reporting.',
        permissions: initialRoleTemplates.find(r => r.id === 'office-manager-template')?.permissions || {},
    },
    // 5. Customer Portal User (Clone of customer-portal-template)
    // Note: This role might be managed differently, but seeding a base is useful.
    {
        name: 'Customer Portal User',
        description: 'Access for end clients to view their own data via the portal.',
        permissions: initialRoleTemplates.find(r => r.id === 'customer-portal-template')?.permissions || {},
    },
];

export const DEFAULT_WORKFLOW_STATUSES_DATA: Array<Omit<WorkflowStatusConfig, 'id' | 'company_id'>> = [
    { name: 'New', color: '#888888', group: 'start', is_final_step: false, sort_order: 10 },
    { name: 'Scheduled', color: '#3b82f6', group: 'active', is_final_step: false, sort_order: 20 },
    { name: 'In Progress', color: '#a855f7', group: 'active', is_final_step: false, sort_order: 30 },
    { name: 'On Hold', color: '#f59e0b', group: 'active', is_final_step: false, sort_order: 40 },
    { name: 'Completed', color: '#22c55e', group: 'final', is_final_step: true, sort_order: 50 },
    { name: 'Invoiced', color: '#14b8a6', group: 'final', is_final_step: true, sort_order: 60 },
    { name: 'Cancelled', color: '#ef4444', group: 'cancelled', is_final_step: true, sort_order: 70 },
];

// Updated to include all relevant module slugs for a full trial
export const DEFAULT_INSTALLED_MODULE_SLUGS_DATA: string[] = allPlatformModules
    .filter(m => !m.is_internal && m.group !== 'platform_admin')
    .map(m => m.slug);
