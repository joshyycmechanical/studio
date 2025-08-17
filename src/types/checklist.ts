
import type { Timestamp } from 'firebase/firestore';

/**
 * Defines the type of a field in a checklist template.
 */
export type ChecklistFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'number'
  | 'date'
  | 'photo'
  | 'signature'
  | 'rating' // e.g., 1-5 stars
  | 'instruction' // Read-only text
  | 'deficiency'; // Field to log a new deficiency

/**
 * Represents a single field within a checklist template.
 */
export interface ChecklistTemplateField {
  id: string; // Unique within the template
  label: string;
  field_type: ChecklistFieldType;
  is_required: boolean;
  position: number;
  options?: string[] | null; // For select or radio types
  placeholder?: string | null;
  description?: string | null; // Helper text
  default_value?: any | null;
  supports_attachment?: boolean; // If a photo can be attached to this specific field
  rating_scale?: number | null; // For rating type (e.g., 5 for 5 stars)
}

/**
 * Represents a template for creating checklists, stored in 'checklist_templates'.
 */
export interface ChecklistTemplate {
  id: string;
  company_id: string | null; // Null if it's a platform-level template
  name: string;
  description?: string | null;
  fields: ChecklistTemplateField[];
  created_by: string;
  created_at: Date;
  updated_at?: Date | null;
  is_platform_template?: boolean;
}

/**
 * Represents an answer for a specific field in a checklist instance.
 */
export interface ChecklistInstanceAnswer {
    field_id: string;
    value: any;
    notes?: string | null;
    attachment_url?: string | null; // Added to match usage in page.tsx
    related_deficiency_id?: string | null; // Added to match usage in page.tsx
}

/**
 * Represents an instance of a checklist being filled out, linked to a work order.
 */
export interface ChecklistInstance {
    id: string; // Firestore document ID
    company_id: string;
    work_order_id: string;
    template_id: string;
    template_name: string; // Denormalized for easy display
    status: 'pending' | 'in-progress' | 'completed';
    answers: ChecklistInstanceAnswer[];
    created_at: Date;
    created_by: string;
    completed_by?: string | null; // User ID
    completed_at?: Date | null;
    updated_at?: Date | null;
    location_id?: string; // Added, as LogDeficiencyField needs it
    equipment_id?: string | null; // Added, as LogDeficiencyField needs it
}
