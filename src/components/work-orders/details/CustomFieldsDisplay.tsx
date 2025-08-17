
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';
import { ClipboardList, Edit2 } from 'lucide-react';
import type { CustomField } from '@/types/custom-field';

interface CustomFieldsDisplayProps {
    customFieldsData?: { [key: string]: any } | null;
    customFieldDefs: CustomField[];
}

export function CustomFieldsDisplay({ customFieldsData, customFieldDefs }: CustomFieldsDisplayProps) {
    if (!customFieldDefs || customFieldDefs.length === 0) {
        return null; // Don't render anything if there are no custom fields defined for this entity
    }

    // Filter out fields that don't have a value in the current work order
    const fieldsWithValue = customFieldDefs.filter(def => 
        customFieldsData && customFieldsData[def.name] !== undefined && customFieldsData[def.name] !== null && customFieldsData[def.name] !== ''
    );

    if (fieldsWithValue.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ClipboardList className="h-5 w-5" />
                        Custom Fields
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No custom field data has been entered for this work order.</p>
                </CardContent>
            </Card>
        );
    }
    
    const renderValue = (field: CustomField, value: any) => {
        if (field.field_type === 'date' || field.field_type === 'datetime') {
            try {
                return format(new Date(value), 'PPp');
            } catch (e) {
                return String(value);
            }
        }
        if (field.field_type === 'toggle') {
            return value ? 'Yes' : 'No';
        }
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        return String(value);
    }

    return (
        <Card>
            <CardHeader>
                 <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardList className="h-5 w-5" />
                    Custom Fields
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {fieldsWithValue.sort((a,b) => a.sort_order - b.sort_order).map((fieldDef) => (
                    <div key={fieldDef.id} className="flex flex-col">
                        <Label className="text-muted-foreground">{fieldDef.label}</Label>
                        <p className="font-medium">{renderValue(fieldDef, customFieldsData?.[fieldDef.name])}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
