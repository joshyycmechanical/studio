import type { ModulePermissions } from './role'; // Re-import if needed, although less likely in module definition

/**
 * Represents a core module definition within the OpSite platform.
 * This data might be stored in code (like roles-data.ts) or in a 'modules' Firestore collection.
 */
export interface Module {
  id: string; // Unique identifier for the module document/definition
  slug: string; // Unique slug used in URLs and permissions (e.g., "work-orders", "customers")
  name: string; // Display name (e.g., "Work Orders")
  icon: string; // Lucide icon name string (e.g., "Briefcase")
  is_internal?: boolean; // If true, typically hidden from standard navigation/installation options
  is_platform_module?: boolean; // If true, only available to platform admins
  default_path: string; // The default route path for accessing this module (e.g., "/work-orders")
  group: 'dashboard' | 'modules' | 'company_settings' | 'platform_admin'; // Grouping for sidebar/UI organization
  order?: number; // Display order within the group
  // description?: string; // Optional description of the module's purpose
}
