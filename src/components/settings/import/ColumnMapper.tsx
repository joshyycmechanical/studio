
'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { IMPORT_CONFIGS, ImportType } from './useDataImporter';

interface ColumnMapperProps {
    importType: ImportType;
    headers: string[];
    columnMapping: { [key: string]: string };
    onMappingChange: (header: string, opSiteField: string) => void;
}

export function ColumnMapper({ importType, headers, columnMapping, onMappingChange }: ColumnMapperProps) {
    const currentConfig = IMPORT_CONFIGS[importType];
    const allOpSiteFields = { ...currentConfig.requiredFields, ...currentConfig.optionalFields };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">3. Map Your Columns</h3>
            <p className="text-sm text-muted-foreground">Match the columns from your file to the fields in OpSite. Required fields are marked with <span className="text-destructive">*</span>.</p>
            <div className="border rounded-md p-4 space-y-3 max-h-96 overflow-y-auto">
                {headers.map(header => (
                    <div key={header} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                        <Label htmlFor={`map-${header}`}>{header}</Label>
                        <div className="flex items-center gap-2">
                            <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block"/>
                            <Select value={columnMapping[header] || 'ignore'} onValueChange={(value) => onMappingChange(header, value)}>
                                <SelectTrigger id={`map-${header}`}>
                                    <SelectValue placeholder="Select OpSite field..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ignore">-- Ignore this column --</SelectItem>
                                    {Object.entries(currentConfig.requiredFields).map(([key, label]) => <SelectItem key={key} value={key}>{label} <span className="text-destructive">*</span></SelectItem>)}
                                    {Object.entries(currentConfig.optionalFields).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
