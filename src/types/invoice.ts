import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the status of an invoice.
 */
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'partially-paid'
  | 'overdue'
  | 'void'
  | 'write-off';

/**
 * Represents a single line item within an invoice document
 * (typically stored in a `line_items` array or subcollection).
 */
export interface InvoiceLineItem {
  id: string; // Unique ID for the line item
  description: string;
  quantity: number;
  unit_price: number; // Price per unit
  item_type: 'service' | 'part' | 'labor' | 'other';
  // Optional details like related work order item, taxability
  // tax_rate_id?: string | null;
}

/**
 * Represents an invoice document in the 'invoices' Firestore collection.
 */
export interface Invoice {
  id: string; // Firestore document ID
  company_id: string; // Reference to the 'companies' collection document ID
  customer_id: string; // Reference to the 'customers' collection document ID
  location_id?: string | null; // Optional primary location reference ('locations' collection)
  invoice_number: string; // User-facing identifier (e.g., INV-2024-001)
  status: InvoiceStatus;
  issue_date: Date; // Changed from Timestamp to Date
  due_date: Date; // Changed from Timestamp to Date
  line_items?: InvoiceLineItem[]; // Array of items being invoiced (or subcollection)
  subtotal: number; // Calculated subtotal before tax/discounts
  tax_amount?: number | null;
  discount_amount?: number | null;
  total_amount: number; // Final amount due
  amount_paid: number; // Amount already paid
  amount_due: number; // Remaining balance (total_amount - amount_paid)
  payment_terms?: string | null; // e.g., "Net 30", "Due on Receipt"
  notes?: string | null; // Notes for the customer or internal reference
  related_work_order_ids?: string[]; // Optional array of related Work Order IDs
  related_estimate_id?: string | null; // Optional reference to the originating 'estimates' collection document ID
  created_at: Date; // Changed from Timestamp to Date
  created_by: string; // User ID of the creator
  updated_at?: Date | null; // Changed from Timestamp to Date
  updated_by?: string | null; // User ID of the last updater
  sent_at?: Date | null; // Changed from Timestamp to Date
  last_payment_date?: Date | null; // Changed from Timestamp to Date
  // pdf_url?: string | null; // Optional URL to generated PDF in storage
}
