
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the type of work performed for a time entry.
 */
export type TimeEntryType =
  | 'regular'
  | 'overtime'
  | 'travel'
  | 'shop-time'
  | 'other';

/**
 * Represents a single time entry document in the 'time_entries' Firestore collection.
 * Each entry is a record of a block of time worked by a user.
 */
export interface TimeEntry {
  id: string; // Firestore document ID
  company_id: string; // Reference to the 'companies' collection
  user_id: string; // Reference to the 'users' collection (the user who performed the work)
  work_order_id?: string | null; // Optional reference to the 'work_orders' collection
  start_time: Date; // Use Date objects for client-side logic
  end_time: Date; // Use Date objects for client-side logic
  duration_hours: number; // Calculated duration in hours
  entry_type: TimeEntryType;
  notes?: string | null; // Optional notes about the work performed
  created_at: Date;
  updated_at?: Date | null;
}

/**
 * Represents a summarized timesheet for payroll or reporting.
 * This is typically generated on-demand (e.g., by a Cloud Function or backend query)
 * and not stored directly as a Firestore document in this exact format.
 */
export interface TimesheetSummary {
    user_id: string;
    user_name: string; // Denormalized user name
    period_start: Date; // Use regular Date objects for client-side representation
    period_end: Date;
    total_hours: number;
    regular_hours: number;
    overtime_hours: number;
    // Could include an array of relevant TimeEntry IDs or more detailed breakdown
}
