
import type { Timestamp } from 'firebase/firestore';
import type { ChecklistInstance } from './checklist'; 

/**
 * Represents the status of a work order.
 */
export type WorkOrderStatus =
  | 'new'
  | 'scheduled'
  | 'traveling' 
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'invoiced' 
  | 'cancelled';

/**
 * Represents the priority of a work order.
 */
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'emergency';

/**
 * Represents a single line item within a work order's line_items array/subcollection.
 */
export interface WorkOrderLineItem {
  id: string; // Unique ID for the line item (can be generated client-side or server-side)
  description: string;
  quantity: number;
  unit_price: number; // Price per unit
  item_type: 'service' | 'part' | 'labor' | 'other';
  inventory_item_id?: string | null; // Optional reference to 'inventory_items' collection
  // cost_basis?: number | null; // Optional: Internal cost for profitability tracking
}

/**
 * Represents a single note on a work order.
 */
export interface WorkOrderNote {
    id: string;
    content: string;
    authorId: string;
    authorName: string; // Denormalized for easy display
    timestamp: Date;
    type: 'public' | 'internal';
}


/**
 * Represents a file attachment associated with a work order.
 */
export interface WorkOrderAttachment {
    id: string; // A unique ID for the attachment (e.g., Firestore document ID or a UUID)
    file_name: string;
    file_type: string;
    download_url: string; // URL to the file in Firebase Storage
    uploaded_by: string; // User ID
    uploaded_at: Date;
}


/**
 * Represents a work order document in the 'work_orders' Firestore collection.
 */
export interface WorkOrder {
  id: string; // Firestore document ID
  company_id: string; // Reference to the 'companies' collection document ID
  customer_id: string; // Reference to the 'customers' collection document ID
  location_id: string; // Reference to the 'locations' collection document ID
  equipment_id?: string | null; // Optional reference to 'equipment' collection document ID
  assigned_technician_id?: string | null; // Optional reference to 'users' collection (technician's user ID)
  work_order_number: string; // User-facing identifier, potentially generated sequentially per company
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  summary: string; // Brief description of the job
  description?: string | null; // Detailed description or scope of work
  type?: string; // Type of work order, e.g., "Installation", "Repair"
  scheduled_date?: Date | null; 
  estimated_duration_hours?: number | null;
  started_at?: Date | null;
  completed_date?: Date | null;
  created_at: Date;
  created_by: string; // User ID of the creator
  updated_at?: Date | null;
  updated_by?: string | null; // User ID of the last updater
  line_items?: WorkOrderLineItem[]; 
  public_notes?: WorkOrderNote[] | null; // Changed to array of notes
  internal_notes?: WorkOrderNote[] | null; // Changed to array of notes
  technician_notes?: string | null; // Technician summary notes on completion
  customer_signature_url?: string | null;
  related_estimate_id?: string | null;
  related_invoice_id?: string | null;
  related_deficiency_ids?: string[];
  custom_fields?: { [key: string]: any };
  generated_image_url?: string | null;
  checklist_instances?: Pick<ChecklistInstance, 'id' | 'template_name' | 'status'>[]; // Array of checklist instances
  attachments?: WorkOrderAttachment[]; // Array of file attachments
  active_time_entry_id?: string | null; // To track the active time entry for this job

  // Time tracking fields for technician workflow
  travel_started_at?: Date | null;
  on_site_at?: Date | null;
  travel_ended_at?: Date | null;

  // Denormalized/populated fields for display purposes
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  location_name?: string;
  location_address?: string;
  location_site_contact?: string;
  assigned_to?: string[];
}
