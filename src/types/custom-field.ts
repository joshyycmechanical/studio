
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the modules/entities where custom fields can be applied.
 */
export type CustomFieldEntityType = 'work-order' | 'customer' | 'location' | 'equipment' | 'user' | 'invoice' | 'estimate' | 'deficiency'; // Add more as needed

/**
 * Represents the data type of a custom field.
 */
export type CustomFieldType =
  | 'text'          // Short text input
  | 'textarea'      // Long text input
  | 'number'        // Numeric input
  | 'currency'      // Currency input (stores number, formatted on client)
  | 'date'          // Date picker (stores Timestamp)
  | 'datetime'      // Date and time picker (stores Timestamp)
  | 'toggle'        // Boolean switch (true/false)
  | 'dropdown'      // Single-select dropdown
  | 'multiselect'   // Multi-select checkboxes/tags
  | 'signature'     // Stores URL to signature image in Firebase Storage
  | 'photo'         // Stores URL to photo image in Firebase Storage
  | 'file'          // Stores URL to general file in Firebase Storage
  | 'user_select'   // Link to a 'users' document ID
  | 'customer_select' // Link to a 'customers' document ID
  | 'location_select' // Link to a 'locations' document ID
  | 'equipment_select'; // Link to an 'equipment' document ID

/**
 * Represents a custom field configuration document in the 'custom_fields' Firestore collection.
 */
export interface CustomField {
  id: string; // Firestore document ID
  company_id: string; // Reference to 'companies' collection
  entity_type: CustomFieldEntityType; // Which entity this field applies to
  name: string; // Programmatic name (snake_case, unique per entity_type within company)
  label?: string; // Display label (optional, defaults to prettified name)
  field_type: CustomFieldType;
  is_required: boolean;
  sort_order: number; // Order within the entity's custom fields section
  options?: string[]; // Array of string options for dropdown/multiselect
  placeholder?: string | null;
  description?: string | null; // Help text
  // Advanced features (optional, implement as needed)
  // is_hidden?: boolean;
  // is_readonly?: boolean;
  // conditional_logic?: any | null;
  // validation_rules?: any | null; // e.g., { regex: '...', minLength: 5 }
  // formula?: string | null;
  // permissions_per_role?: { [roleId: string]: 'hidden' | 'readonly' | 'editable' } | null;
  created_at: Timestamp; // Firestore Timestamp
  updated_at?: Timestamp | null; // Firestore Timestamp
}

/**
 * Represents a saved template document in the 'field_templates' Firestore collection.
 * This groups multiple CustomField configurations.
 */
export interface FieldTemplate {
  id: string; // Firestore document ID
  company_id: string | null; // Null for platform templates, company ID otherwise
  entity_type: CustomFieldEntityType; // Which entity this template applies to
  name: string; // User-friendly name for the template
  description?: string | null;
  custom_field_ids: string[]; // Array of CustomField document IDs included in this template
  created_at: Timestamp; // Firestore Timestamp
  is_platform_template?: boolean; // Flag if it's a platform-provided template
}

/**
 * Represents the actual value stored for a custom field on a specific entity instance.
 * Option 1: Store directly within the entity document in a `custom_fields` map:
 * e.g., workOrderDoc.data().custom_fields = { my_text_field: "value", my_number_field: 123 }
 *
 * Option 2: Store in a separate 'custom_field_values' collection (better for querying values across entities):
 */
export interface CustomFieldValue {
  id: string; // Firestore document ID (if separate collection)
  company_id: string; // Reference to 'companies'
  entity_type: CustomFieldEntityType; // e.g., 'work-order'
  entity_id: string; // ID of the work order, customer, etc.
  field_id: string; // Reference to the 'custom_fields' configuration document ID
  field_name: string; // Denormalized programmatic name of the field for easier querying
  value: any; // The actual data stored (string, number, boolean, Timestamp, Storage URL, reference ID, etc.)
  updated_at: Timestamp; // Firestore Timestamp
}
