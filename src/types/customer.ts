
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents a customer document in the 'customers' Firestore collection.
 * Each customer belongs to a specific company.
 */
export interface Customer {
  id: string; // Firestore document ID
  company_id: string; // Reference to the 'companies' collection document ID
  name: string; // e.g., "McDonald’s Calgary Region"
  
  // Primary contact info
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  
  // Billing specific info
  billing_email?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_province?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;

  billing_notes: string | null;
  status: 'active' | 'inactive';
  created_at: Date; // Changed to Date for client-side consistency
  updated_at?: Date | null; // Added updated_at
  updated_by?: string | null; // Added updated_by
}
