
import type { FormFieldConfig } from '@/types/form-fields';
import { z } from 'zod';

// Defines the standard, non-customizable fields for a Work Order.
// These will be combined with custom fields from the Field Editor.
export const standardWorkOrderFields: FormFieldConfig[] = [
  {
    name: 'summary',
    label: 'Summary',
    type: 'text',
    required: true,
    placeholder: 'e.g., Annual Maintenance Unit 1',
    sort_order: 10,
    fullWidth: true,
    is_custom: false,
  },
  {
    name: 'description',
    label: 'Description (Scope of Work)',
    type: 'textarea',
    required: false,
    placeholder: 'Add detailed scope of work or notes...',
    sort_order: 20,
    fullWidth: true,
    rows: 4,
    is_custom: false,
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    sort_order: 30,
    options: ['new', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled'],
    is_custom: false,
  },
  {
    name: 'priority',
    label: 'Priority',
    type: 'select',
    required: true,
    sort_order: 40,
    options: ['low', 'medium', 'high', 'emergency'],
    is_custom: false,
  },
  {
    name: 'customer_id',
    label: 'Customer',
    type: 'customer-select', // Special type to handle quick-add
    required: true,
    sort_order: 50,
    is_custom: false,
  },
  {
    name: 'location_id',
    label: 'Location',
    type: 'select',
    required: true,
    sort_order: 60,
    is_custom: false,
  },
  {
    name: 'equipment_id',
    label: 'Equipment (Optional)',
    type: 'select',
    required: false,
    sort_order: 70,
    is_custom: false,
  },
  {
    name: 'assigned_technician_id',
    label: 'Assigned Technician (Optional)',
    type: 'select',
    required: false,
    sort_order: 80,
    is_custom: false,
  },
  {
    name: 'scheduled_date',
    label: 'Scheduled Date (Optional)',
    type: 'date',
    required: false,
    sort_order: 90,
    is_custom: false,
  },
];

// Generates a Zod schema from field configurations for form validation.
export const generateSchema = (fields: FormFieldConfig[]) => {
    const schemaObject = fields.reduce((acc, field) => {
        let zodType: z.ZodType<any, any> = z.any();
        switch (field.type) {
            case 'text':
            case 'textarea':
            case 'select':
            case 'customer-select': // Add customer-select here
                zodType = z.string().optional().nullable();
                if(field.required) zodType = z.string({ required_error: `${field.label} is required.`}).min(1, `${field.label} is required.`);
                break;
            case 'number':
            case 'currency':
                zodType = z.coerce.number().optional().nullable();
                if(field.required) zodType = z.coerce.number();
                break;
            case 'date':
                zodType = z.date().optional().nullable();
                if(field.required) zodType = z.date({ required_error: `${field.label} is required.`});
                break;
        }
        acc[field.name] = zodType;
        return acc;
    }, {} as Record<string, z.ZodType<any, any>>);

    return z.object(schemaObject);
};
