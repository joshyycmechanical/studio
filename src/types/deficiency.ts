
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the severity level of a deficiency.
 */
export type DeficiencySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Represents the status of a deficiency.
 */
export type DeficiencyStatus = 'open' | 'in-progress' | 'resolved' | 'cancelled';

/**
 * Represents a deficiency document in the 'deficiencies' Firestore collection.
 */
export interface Deficiency {
  id: string; // Firestore document ID
  company_id: string; // Reference to the 'companies' collection document ID
  customer_id: string; // Reference to the 'customers' collection document ID
  location_id: string; // Reference to the 'locations' collection document ID
  equipment_id?: string | null; // Optional reference to 'equipment' collection
  work_order_id?: string | null; // Optional: Link to the WO where deficiency was found
  reported_by: string; // User ID of the person who reported it
  reported_at: Date; // Changed from Timestamp to Date for client-side usage
  description: string; // Detailed description of the issue
  severity: DeficiencySeverity;
  status: DeficiencyStatus;
  resolution_notes?: string | null; // Notes on how it was resolved
  resolved_at?: Date | null; // Changed from Timestamp to Date
  resolved_by?: string | null; // User ID of the resolver
  attachments?: string[]; // Array of file paths/URLs in Firebase Storage for photos/docs
  related_estimate_id?: string | null; // Link to an estimate created for this deficiency
  created_at: Date; // Changed from Timestamp to Date
  updated_at?: Date | null; // Changed from Timestamp to Date
  custom_fields?: { [key: string]: any };
}
