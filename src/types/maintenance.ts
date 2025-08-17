import type { Timestamp } from 'firebase/firestore';

/**
 * Defines the frequency of maintenance visits.
 */
export type MaintenanceFrequency = 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'custom';

/**
 * Represents a maintenance contract document in the 'maintenance_contracts' Firestore collection.
 */
export interface MaintenanceContract {
  id: string; // Firestore document ID
  company_id: string; // Reference to 'companies' collection
  customer_id: string; // Reference to 'customers' collection
  location_ids: string[]; // Array of location document IDs from 'locations' collection
  equipment_ids?: string[] | null; // Optional array of specific equipment document IDs from 'equipment' collection
  name: string; // e.g., "Annual HVAC PM Contract"
  start_date: Timestamp | Date; // Use Timestamp for DB, Date for client manipulation
  end_date?: Timestamp | Date | null; // Use Timestamp for DB, Date for client manipulation
  frequency: MaintenanceFrequency;
  custom_frequency_details?: string | null; // Description if frequency is 'custom'
  checklist_template_id?: string | null; // Optional reference to 'checklist_templates' collection
  estimated_duration_hours?: number | null; // Optional: Estimated time for each visit
  is_active: boolean; // Whether the contract is currently active
  notes?: string | null; // Internal notes about the contract
  created_at: Timestamp | Date; // Use Timestamp for DB, Date for client manipulation
  created_by: string; // User ID of the creator
  updated_at?: Timestamp | Date | null; // Firestore Timestamp or null
  updated_by?: string | null; // User ID of last updater
}

/**
 * Represents a single scheduled maintenance visit document in the 'scheduled_maintenance_visits' Firestore collection.
 * These are typically generated automatically based on contracts.
 */
export interface ScheduledMaintenanceVisit {
  id: string; // Firestore document ID
  contract_id: string; // Reference to the 'maintenance_contracts' collection
  company_id: string; // Denormalized from contract
  customer_id: string; // Denormalized from contract
  location_id: string; // Reference to the specific 'locations' collection document ID for this visit
  equipment_ids?: string[]; // Optional: Specific equipment document IDs for this visit (subset of contract)
  scheduled_date: Timestamp | Date; // Use Timestamp for DB, Date for client manipulation
  status: 'pending' | 'scheduled' | 'skipped' | 'completed' | 'work-order-created'; // Status of this specific visit
  related_work_order_id?: string | null; // Optional reference to the 'work_orders' collection document ID generated for this visit
  completed_at?: Timestamp | Date | null; // Use Timestamp for DB, Date for client manipulation
  notes?: string | null; // Notes specific to this visit instance (e.g., reason for skipping)
}
