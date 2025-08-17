import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the status of a purchase order.
 */
export type PurchaseOrderStatus = 'draft' | 'pending_approval' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled' | 'closed';

/**
 * Represents a single line item within a purchase order document
 * (typically stored in a `line_items` array or subcollection).
 */
export interface PurchaseOrderLineItem {
  id: string; // Unique ID for the line item
  item_id?: string | null; // Optional reference to 'inventory_items' collection
  description: string; // Description of the item being ordered
  quantity_ordered: number;
  unit_cost: number; // Cost per unit from the vendor
  quantity_received?: number; // Quantity received so far (updated on receiving)
  // Optional: vendor_part_number
}

/**
 * Represents a purchase order document in the 'purchase_orders' Firestore collection.
 */
export interface PurchaseOrder {
  id: string; // Firestore document ID
  company_id: string; // Reference to 'companies' collection
  po_number: string; // User-facing PO number (e.g., PO-5001)
  vendor_id?: string | null; // Optional reference to a vendor/supplier collection
  vendor_name?: string; // Denormalized vendor name if no separate collection
  status: PurchaseOrderStatus;
  order_date: Timestamp; // Firestore Timestamp - Date the order was placed/created
  expected_delivery_date?: Timestamp | null; // Firestore Timestamp
  shipping_address?: string | null; // Address where items should be shipped
  line_items?: PurchaseOrderLineItem[]; // Array of items ordered (or subcollection)
  subtotal: number; // Calculated subtotal based on line items
  tax_amount?: number | null;
  shipping_cost?: number | null;
  total_amount: number; // Calculated total cost
  notes?: string | null; // Internal notes
  created_at: Timestamp; // Firestore Timestamp
  created_by: string; // User ID of creator
  approved_at?: Timestamp | null; // Firestore Timestamp
  approved_by?: string | null; // User ID of approver
  received_at?: Timestamp | null; // Firestore Timestamp - Date when fully received
  // related_work_order_id?: string | null; // Optional: If PO is for a specific job
}
