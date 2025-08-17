
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the status of an estimate.
 */
export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'invoiced'; // When an invoice has been created from it

/**
 * Represents a single line item within an estimate.
 */
export interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  item_type: 'service' | 'part' | 'labor' | 'other';
}

/**
 * Represents an estimate document in the 'estimates' Firestore collection.
 */
export interface Estimate {
  id: string; // Firestore document ID
  company_id: string;
  customer_id: string;
  location_id: string;
  estimate_number: string; // User-facing identifier
  status: EstimateStatus;
  summary: string; // A brief summary of the estimate
  line_items: EstimateLineItem[];
  subtotal: number;
  tax_amount?: number | null;
  total_amount: number;
  notes?: string | null;
  related_deficiency_id?: string | null; // Link back to the originating deficiency
  created_at: Date;
  created_by: string;
  updated_at?: Date | null;
  sent_at?: Date | null;
  approved_at?: Date | null;
  rejected_at?: Date | null;
}
