
import type { Timestamp } from 'firebase/firestore';
import type { Module } from './module';

/**
 * Represents a company (tenant) document in the 'companies' Firestore collection.
 */
export interface Company {
  id: string; // Firestore document ID
  name: string;
  created_at: Date | Timestamp; // Firestore Timestamp type for database storage
  subscription_plan: 'Starter' | 'Pro' | 'Enterprise' | 'Trial'; // Added 'Trial'
  status: 'active' | 'paused' | 'deleted';
  created_by: string; // User ID (reference to users collection, Firebase Auth UID)
  default_timezone?: string | null;
  settings_initialized?: boolean;
  modules?: Module[];
}

/**
 * Represents the installation link document in the 'company_modules' Firestore collection.
 * (Alternative to embedding in Company type, potentially more scalable)
 */
export interface CompanyModuleInstallation {
    company_id: string; // Reference to the company document ID
    module_id: string; // Reference to the module definition (might be code-defined or in a 'modules' collection)
    installed_at: Timestamp; // Firestore Timestamp
    // Add any company-specific settings for this module if needed
}
