
export interface EquipmentField {
  id: string; // e.g., 'tonnage', 'voltage', 'vin_number'
  name: string; // e.g., 'Tonnage', 'Voltage', 'VIN Number'
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // For 'select' type
  placeholder?: string;
  validation: any; // Zod schema for validation
}

export interface EquipmentCategory {
  id: string; // e.g., 'hvac_unit', 'vehicle'
  name: string; // e.g., 'HVAC Unit', 'Vehicle'
  fields: EquipmentField[];
  common_issues?: string[]; // New: List of common issues for this category
}

export const equipmentCategories: EquipmentCategory[] = [
  {
    id: 'refrigeration_unit',
    name: 'Refrigeration Unit',
    fields: [
      { id: 'unit_type', name: 'Unit Type', type: 'select', options: ['Walk-in Cooler', 'Walk-in Freezer', 'Reach-in', 'Ice Machine', 'Prep Table'], validation: (z: any) => z.string().optional() },
      { id: 'refrigerant_type', name: 'Refrigerant Type', type: 'text', placeholder: 'e.g., R-404A, R-134a', validation: (z: any) => z.string().optional() },
      { id: 'temperature_range', name: 'Temp Range (°F)', type: 'text', placeholder: '-10°F to 0°F', validation: (z: any) => z.string().optional() },
    ],
    common_issues: [
      'Not Cooling to Temp',
      'Leaking Water',
      'Ice Buildup',
      'Compressor Not Running',
      'Noisy Operation',
      'Door Seal Damaged',
      'Light Out',
    ],
  },
  {
    id: 'hvac_unit',
    name: 'HVAC Unit',
    fields: [
      { id: 'tonnage', name: 'Tonnage', type: 'number', placeholder: 'e.g., 5', validation: (z: any) => z.number().positive().optional() },
      { id: 'refrigerant_type', name: 'Refrigerant Type', type: 'text', placeholder: 'e.g., R-410A', validation: (z: any) => z.string().optional() },
      { id: 'voltage', name: 'Voltage', type: 'select', options: ['120V', '208V', '240V', '480V'], validation: (z: any) => z.string().optional() },
    ],
    common_issues: [
      'Not Cooling',
      'Not Heating',
      'Airflow Issue',
      'Strange Noise',
      'Thermostat Issue',
      'Filter Change Needed',
      'Unit Not Turning On',
    ],
  },
  {
    id: 'air_handler',
    name: 'Air Handler / Fan Coil',
    fields: [
      { id: 'cfm', name: 'CFM', type: 'number', placeholder: 'e.g., 2000', validation: (z: any) => z.number().positive().optional() },
      { id: 'motor_hp', name: 'Motor HP', type: 'text', placeholder: 'e.g., 1.5 HP', validation: (z: any) => z.string().optional() },
    ],
    common_issues: [
        'Fan Motor Failure',
        'Belt Replacement',
        'Clogged Coil',
        'Vibration Issue',
        'No Airflow',
    ],
  },
  {
    id: 'vehicle',
    name: 'Vehicle',
    fields: [
      { id: 'vin_number', name: 'VIN Number', type: 'text', placeholder: 'Enter 17-digit VIN', validation: (z: any) => z.string().length(17).optional() },
      { id: 'license_plate', name: 'License Plate', type: 'text', placeholder: 'e.g., ABC-123', validation: (z: any) => z.string().optional() },
      { id: 'year', name: 'Year', type: 'number', placeholder: 'e.g., 2023', validation: (z: any) => z.number().int().min(1980).max(new Date().getFullYear() + 1).optional() },
    ],
    common_issues: [
        'Oil Change Due',
        'Tire Rotation Needed',
        'Check Engine Light On',
        'Brake Noise',
        'Battery Issue',
    ],
  },
  {
      id: 'other',
      name: 'Other / Generic',
      fields: [],
      common_issues: [
          'General Maintenance',
          'Physical Damage',
          'Power Issue',
      ]
  }
];
