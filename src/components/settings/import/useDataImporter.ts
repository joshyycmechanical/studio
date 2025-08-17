
'use client';

import * as React from 'react';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { importCustomersApi, importLocationsApi, importEquipmentApi } from '@/services/import';

export type ImportType = 'customers' | 'locations' | 'equipment';
export type ImportStatus = 'idle' | 'parsing' | 'mapping' | 'uploading' | 'completed' | 'error';
export interface ImportResult {
    successCount: number;
    errorCount: number;
    errors: string[];
}

export const IMPORT_CONFIGS = {
    customers: {
        label: 'Customers',
        requiredFields: { name: 'Customer Name' },
        optionalFields: {
            contact_name: 'Contact Name',
            contact_email: 'Contact Email',
            contact_phone: 'Contact Phone',
            billing_notes: 'Billing Notes',
            status: 'Status (active/inactive)',
        },
        templateHeaders: ['name', 'contact_name', 'contact_email', 'contact_phone', 'billing_notes', 'status'],
    },
    locations: {
        label: 'Locations',
        requiredFields: {
            customer_name: 'Parent Customer Name',
            name: 'Location Name',
            address_line1: 'Address Line 1',
            city: 'City',
            province: 'Province/State',
            postal_code: 'Postal/Zip Code',
        },
        optionalFields: {
            address_line2: 'Address Line 2',
            country: 'Country (e.g., USA)',
            location_type: 'Location Type (restaurant, office, etc.)',
        },
        templateHeaders: ['customer_name', 'name', 'address_line1', 'address_line2', 'city', 'province', 'postal_code', 'country', 'location_type'],
    },
    equipment: {
        label: 'Equipment',
        requiredFields: {
            customer_name: 'Parent Customer Name',
            location_name: 'Parent Location Name',
            name: 'Equipment Name',
        },
        optionalFields: {
            asset_tag: 'Asset Tag',
            manufacturer: 'Manufacturer',
            model_number: 'Model Number',
            serial_number: 'Serial Number',
            equipment_type: 'Equipment Type (e.g., HVAC)',
            status: 'Status (operational, needs-repair, decommissioned)',
            notes: 'Notes',
        },
        templateHeaders: ['customer_name', 'location_name', 'name', 'asset_tag', 'manufacturer', 'model_number', 'serial_number', 'equipment_type', 'status', 'notes'],
    },
};

export function useDataImporter() {
    const { user, firebaseUser, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [importType, setImportType] = React.useState<ImportType>('customers');
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [importStatus, setImportStatus] = React.useState<ImportStatus>('idle');
    const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [headers, setHeaders] = React.useState<string[]>([]);
    const [dataPreview, setDataPreview] = React.useState<any[]>([]);
    const [columnMapping, setColumnMapping] = React.useState<{ [key: string]: string }>({});

    const canImportData = !authLoading && hasPermission(user, 'import-data', 'create');

    const resetState = React.useCallback(() => {
        setImportStatus('idle');
        setImportResult(null);
        setErrorMessage(null);
        setHeaders([]);
        setDataPreview([]);
        setColumnMapping({});
        setSelectedFile(null);
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }, []);
    
    const handleImportTypeChange = (type: ImportType) => {
        resetState();
        setImportType(type);
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        resetState();
        const file = event.target.files?.[0];
        if (file) {
            if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
                toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please select a valid CSV file.' });
                return;
            }
            setSelectedFile(file);
            setImportStatus('parsing');
            
            const currentConfig = IMPORT_CONFIGS[importType];
            const allOpSiteFields = { ...currentConfig.requiredFields, ...currentConfig.optionalFields };

            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                preview: 5,
                complete: (results) => {
                    const detectedHeaders = results.meta.fields || [];
                    if (detectedHeaders.length === 0) {
                        setErrorMessage("Could not detect any columns in the CSV file. Please ensure it's a valid CSV with headers.");
                        setImportStatus('error');
                        return;
                    }
                    setHeaders(detectedHeaders);
                    setDataPreview(results.data);
                    
                    const initialMapping: { [key: string]: string } = {};
                    detectedHeaders.forEach(header => {
                        const headerLower = header.toLowerCase().replace(/[\s_-]/g, '');
                        for (const [opSiteKey, opSiteLabel] of Object.entries(allOpSiteFields)) {
                            const opSiteLabelLower = opSiteLabel.toLowerCase().replace(/[\s_-]/g, '').replace(/\(.*\)/g, '');
                            if (headerLower.includes(opSiteLabelLower) || opSiteLabelLower.includes(headerLower)) {
                                initialMapping[header] = opSiteKey;
                                break;
                            }
                        }
                    });
                    setColumnMapping(initialMapping);
                    setImportStatus('mapping');
                },
                error: (error: Error) => {
                    setErrorMessage(`CSV Parsing Error: ${error.message}`);
                    setImportStatus('error');
                }
            });
        }
    };
    
    const handleMappingChange = (header: string, opSiteField: string) => {
        setColumnMapping(prev => ({
            ...prev,
            [header]: opSiteField === 'ignore' ? '' : opSiteField,
        }));
    };
    
    const handleDownloadTemplate = () => {
        const currentConfig = IMPORT_CONFIGS[importType];
        if (!currentConfig || currentConfig.templateHeaders.length === 0) {
            toast({ variant: 'destructive', title: 'No Template Available' });
            return;
        }
        
        const csvContent = "data:text/csv;charset=utf-8," + currentConfig.templateHeaders.join(',');
        const filename = `${importType}_import_template.csv`;
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    const handleImport = async () => {
        if (!selectedFile || !canImportData || !firebaseUser) return;
        
        const currentConfig = IMPORT_CONFIGS[importType];
        const mappedOpSiteFields = Object.values(columnMapping);
        for (const reqKey of Object.keys(currentConfig.requiredFields)) {
            if (!mappedOpSiteFields.includes(reqKey)) {
                toast({ variant: 'destructive', title: 'Mapping Incomplete', description: `Please map a column to the required field: "${currentConfig.requiredFields[reqKey as keyof typeof currentConfig.requiredFields]}".` });
                return;
            }
        }
        
        setImportStatus('uploading');
        setErrorMessage(null);
        setImportResult(null);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const dataToImport = results.data;
                if(dataToImport.length === 0){
                    setErrorMessage('The selected CSV file is empty or has no data rows.');
                    setImportStatus('error');
                    return;
                }
                try {
                    const idToken = await firebaseUser.getIdToken();
                    let result;
                    switch (importType) {
                        case 'customers':
                            result = await importCustomersApi(idToken, dataToImport, columnMapping);
                            break;
                        case 'locations':
                             result = await importLocationsApi(idToken, dataToImport, columnMapping);
                             break;
                         case 'equipment':
                             result = await importEquipmentApi(idToken, dataToImport, columnMapping);
                             break;
                        default:
                            throw new Error('Selected import type is not supported.');
                    }
                    setImportResult(result);
                    setImportStatus('completed');
                    toast({ title: 'Import Complete', description: `${result.successCount} of ${dataToImport.length} records imported.` });
                } catch (error: any) {
                    setImportStatus('error');
                    setErrorMessage(error.message);
                    toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
                }
            }
        });
    };
    
    return {
        importType,
        handleImportTypeChange,
        selectedFile,
        handleFileChange,
        importStatus,
        importResult,
        errorMessage,
        headers,
        dataPreview,
        columnMapping,
        handleMappingChange,
        handleDownloadTemplate,
        handleImport,
        authLoading,
        canImportData,
        resetState
    };
}
