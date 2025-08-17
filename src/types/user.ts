
import { Timestamp } from 'firebase/firestore';
import type { Role, ModulePermissions } from './role';
import type { Module } from './module';

/**
 * Represents the user's profile document stored in Firestore.
 * This is the primary object for the currently authenticated user.
 */
export interface UserProfile {
  id: string; // Firestore document ID (same as Firebase Auth UID)
  email: string; // User's email address
  full_name: string | null;
  company_id: string | null; // Null if the user is a platform admin
  companyName?: string | null; // Denormalized company name for convenience
  profile_photo_url?: string | null;
  phone_number?: string | null;
  
  // The names of the user's assigned roles for display purposes
  roleNames?: string[]; 

  // Aggregated permissions from all assigned roles.
  permissions: { [moduleSlug: string]: ModulePermissions | boolean };

  // Modules available to the user, based on their company's installations.
  modules: Module[];

  is_onboarding_complete?: boolean;
  status: 'active' | 'invited' | 'suspended';
  active_timer?: ActiveTimer | null;
  
  created_at: Timestamp | Date;
  last_login_at?: Timestamp | Date | null;
  invited_by?: string | null;
  pay_rate_hourly?: number | null;
  overtime_threshold_hours?: number;
}

/**
 * Represents the shape of the user's active timer object.
 */
export interface ActiveTimer {
    time_entry_id: string;
    work_order_id: string | null;
    started_at: Timestamp | Date;
}

/**
 * Extends the UserProfile for contexts where role details are needed.
 * NOTE: This is now less necessary as permissions are now directly on UserProfile.
 */
export interface UserProfileWithRoles extends UserProfile {
  // This can be simplified or removed, as permissions are now directly on UserProfile
}
