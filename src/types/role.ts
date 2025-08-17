
import type { Timestamp } from 'firebase/firestore';

/**
 * Defines the permissions for a specific module.
 * If `can_access` is false, all other permissions are implicitly false.
 * If `manage` is true, all other permissions are implicitly true.
 */
export interface ModulePermissions {
  can_access: boolean;
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  assign?: boolean;
  approve?: boolean;
  send?: boolean;
  manage_status?: boolean;
  process_payment?: boolean;
  link_qr?: boolean;
  transfer?: boolean;
  ocr?: boolean;
  recurring?: boolean;
  convert?: boolean;
  fill?: boolean;
  live?: boolean;
  upload?: boolean;
  manage?: boolean;
  generate?: boolean;
  resolve?: boolean;
  impersonate?: boolean;
  export?: boolean;
}

/**
 * Represents a role document in the 'roles' Firestore collection.
 * Roles define a set of permissions that can be assigned to users.
 */
export interface Role {
  id: string; // Firestore document ID
  company_id: string | null; // Null for platform-level roles/templates
  name: string;
  description?: string | null;
  permissions: {
    // Key is the module slug (e.g., "work-orders")
    [moduleSlug: string]: ModulePermissions | boolean;
  };
  is_template?: boolean; // Flag if this is a template for cloning
  created_at?: Timestamp | Date;
}
