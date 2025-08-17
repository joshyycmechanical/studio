
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents an inventory item document in the 'inventory_items' Firestore collection.
 */
export interface InventoryItem {
  id: string; // Firestore document ID
  company_id: string; // Reference to 'companies' collection
  part_number?: string | null; // Manufacturer or internal part number
  name: string; // User-friendly name
  description?: string | null;
  category?: string | null; // e.g., "Filters", "Compressors", "Refrigerant"
  unit_cost?: number | null; // Cost per unit (for internal tracking)
  unit_price?: number | null; // Default selling price per unit (can be overridden)
  preferred_vendor_id?: string | null; // Optional reference to a vendor/supplier
  quantity_on_hand: number; // This is now a required field for simplicity on the main item
  reorder_point?: number | null; // Minimum quantity before reordering is suggested
  attachments?: string[]; // URLs/paths for spec sheets, images in Storage
  created_at: Date; // Changed to Date
  updated_at?: Date | null; // Changed to Date
}

/**
 * Represents a warehouse or stock location document in the 'warehouses' Firestore collection.
 * This could also represent technician vans if they carry stock.
 */
export interface Warehouse {
  id: string; // Firestore document ID
  company_id: string; // Reference to 'companies' collection
  name: string; // e.g., "Main Warehouse", "Tech Van 101"
  address?: string | null; // Optional address for physical warehouses
  is_mobile_stock?: boolean; // Flag if this represents a mobile unit (e.g., van)
  assigned_user_id?: string | null; // Optional: User ID if it's a tech's van stock
}

/**
 * Represents the stock level document for a specific item in a specific warehouse,
 * stored in the 'inventory_stock_levels' Firestore collection.
 * (Composite key of item_id + warehouse_id might be used, or unique doc ID)
 */
export interface InventoryStockLevel {
  id: string; // Firestore document ID (or composite key representation)
  company_id: string; // Reference to 'companies' collection
  item_id: string; // Reference to 'inventory_items' collection
  warehouse_id: string; // Reference to 'warehouses' collection
  quantity_on_hand: number; // Current quantity in this specific location
  last_updated_at: Timestamp; // Firestore Timestamp
  // Optional: Bin location within the warehouse
  // bin_location?: string | null;
}

/**
 * Represents a transaction record for inventory adjustments,
 * stored in the 'inventory_transactions' Firestore collection.
 */
export interface InventoryTransaction {
  id: string; // Firestore document ID
  company_id: string;
  item_id: string;
  warehouse_id: string;
  transaction_type:
    | 'initial_stock'
    | 'purchase_order_received'
    | 'work_order_consumption'
    | 'manual_adjustment'
    | 'stock_transfer_out'
    | 'stock_transfer_in'
    | 'stock_take_adjustment';
  quantity_change: number; // Positive for increase, negative for decrease
  related_document_id?: string | null; // e.g., PO ID, WO ID, Transfer ID
  transaction_date: Timestamp; // Firestore Timestamp
  user_id: string; // User ID who performed/triggered the transaction
  notes?: string | null;
}
