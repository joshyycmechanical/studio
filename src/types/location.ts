import type { Timestamp } from 'firebase/firestore';

/**
 * Represents a service location document in the 'locations' Firestore collection.
 * Each location belongs to a specific customer and company.
 */
export interface Location {
  id: string; // Firestore document ID
  customer_id: string; // Reference to the 'customers' collection document ID
  company_id: string; // Reference to the 'companies' collection document ID
  name: string; // e.g., "McDonald’s Deerfoot Meadows"
  address_line1: string;
  address_line2?: string | null;
  city: string;
  province: string; // Or State
  postal_code: string; // Or Zip Code
  country: string;
  location_type: 'restaurant' | 'warehouse' | 'office' | 'residential' | 'other';
  equipment_count: number; // Denormalized count, update via triggers/functions if needed for performance
  created_at: Timestamp; // Firestore Timestamp
  // Optional: Geolocation coordinates
  latitude?: number | null;
  longitude?: number | null;
  // Optional: Custom fields reference
  // custom_fields?: { [key: string]: any };
}
