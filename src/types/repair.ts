
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents a single material or part used in a repair.
 */
export interface MaterialUsed {
  id: string; // Unique ID for the item entry
  description: string;
  quantity: number;
  unit_cost: number;
  inventory_item_id?: string | null; // Optional link to inventory
}


/**
 * Represents a repair record document in the 'repairs' Firestore collection.
 * These are often logged as part of a work order.
 */
export interface Repair {
  id: string; // Firestore document ID
  company_id: string; // Reference to the 'companies' collection document ID
  work_order_id?: string | null; // Optional reference to the parent 'work_orders' collection document ID
  location_id: string; // Denormalized reference to 'locations' collection (important even if linked to WO)
  equipment_id?: string | null; // Optional reference to 'equipment' collection
  technician_id: string; // User ID of the technician performing the repair
  repair_date: Timestamp | Date; // Use Timestamp for DB, Date for client manipulation
  labor_hours?: number | null; // Hours spent on labor
  materials_cost?: number | null; // Cost of materials used (can be detailed in line items elsewhere if needed)
  description: string; // Description of the repair performed
  notes?: string | null; // Additional notes about the repair
  attachments?: string[]; // Array of file paths/URLs in Firebase Storage for photos/docs
  created_at: Timestamp | Date; // Firestore Timestamp - When the repair record was logged
  updated_at?: Timestamp | Date | null;
  updated_by?: string | null;
  materials_used?: MaterialUsed[]; // Array of materials/parts used
}
