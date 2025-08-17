
import type { Timestamp } from 'firebase/firestore';

export type EquipmentStatus = 'operational' | 'needs-repair' | 'decommissioned';

// List of common refrigerant types for dropdowns
export const REFRIGERANT_TYPES = [
  "R-22", "R-410A", "R-134a", "R-404A", "R-407C", "R-448A", "R-449A", "R-507", "R-744 (CO2)", "Other"
];

export interface Equipment {
  id: string; 
  company_id: string; 
  location_id: string; 
  customer_id: string;
  
  // Core Details
  name: string; // e.g., "Walk-in Cooler", "Main Dining HVAC"
  category: string; // Will be specialized, e.g., "refrigeration", "hvac"
  asset_tag?: string | null;
  status: EquipmentStatus;
  
  // Manufacturer Details
  manufacturer?: string | null; // e.g., "Carrier", "True", "Lennox"
  model_number?: string | null;
  serial_number?: string | null;

  // HVAC/R Specific Details
  refrigerant_type?: string | null; // e.g., "R-410A"
  voltage?: '120V' | '208V/230V' | '277V' | '460V' | '480V' | 'Other' | null;
  tonnage?: number | null;
  btu_rating?: number | null;

  // Service & Lifecycle Dates
  installation_date?: Date | null;
  last_service_date?: Date | null;
  next_service_due_date?: Date | null;
  
  // Notes & Attachments
  notes?: string | null;
  attachments?: string[]; // URLs to manuals, photos, etc.

  // System Fields
  custom_fields?: { [key: string]: any }; 
  created_at: Date;
  updated_at?: Date | null;
}
