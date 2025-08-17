
import type { CustomFieldType } from './custom-field';

/**
 * Represents the configuration for a single field in a dynamically generated form.
 * This can be either a standard, built-in field or a custom field.
 */
export interface FormFieldConfig {
    name: string; // The programmatic name (e.g., "summary", "custom_field_123")
    label: string; // The user-visible label
    type: CustomFieldType | 'customer-select'; // The type of input to render
    required: boolean;
    sort_order: number;
    placeholder?: string;
    options?: any[] | readonly any[]; // Options for select/dropdown fields
    fullWidth?: boolean; // If the field should take up the full width in a 2-column layout
    rows?: number; // For textarea type
    is_custom: boolean; // Flag to distinguish from standard fields
}
