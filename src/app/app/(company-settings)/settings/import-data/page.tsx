
'use client';

import * as React from 'react';
import Papa from 'papaparse';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { Loader2, Upload, AlertCircle, CheckCircle, FileDown, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { importCustomersApi, importLocationsApi, importEquipmentApi } from '@/services/import';

type ImportType = 'customers' | 'locations' | 'equipment';
type ImportStatus = 'idle' | 'parsing' | 'mapping' | 'uploading' | 'completed' | 'error';
interface ImportResult {
    successCount: number;
    errorCount: number;
    errors: string[];
}

// Define configuration for each import type
const IMPORT_CONFIGS = {
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

export default function DataImportPage() {
    const { user, firebaseUser, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [importType, setImportType] = React.useState<ImportType>('customers');
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [importStatus, setImportStatus] = React.useState<ImportStatus>('idle');
    const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

    // State for the mapping step
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
        // Don't reset importType here, just the file-related state
        setImportStatus('idle');
        setImportResult(null);
        setErrorMessage(null);
        setHeaders([]);
        setDataPreview([]);
        setColumnMapping({});
        setSelectedFile(null);
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
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

    if (authLoading) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!canImportData) return <div className="p-8">You do not have permission to import data.</div>;

    const isProcessing = importStatus === 'parsing' || importStatus === 'uploading';
    const currentConfig = IMPORT_CONFIGS[importType];
    const allOpSiteFields = { ...currentConfig.requiredFields, ...currentConfig.optionalFields };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="h-6 w-6"/> Data Importer
                </CardTitle>
                <CardDescription>Import data from your previous applications using a CSV file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                        <Label htmlFor="import-type">1. Select Data to Import</Label>
                        <Select value={importType} onValueChange={(value) => handleImportTypeChange(value as ImportType)} disabled={importStatus !== 'idle'}>
                            <SelectTrigger id="import-type" className="w-full md:w-[280px]">
                                <SelectValue placeholder="Select data type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(IMPORT_CONFIGS).map(key => (
                                    <SelectItem key={key} value={key} disabled={IMPORT_CONFIGS[key as ImportType].label.includes('soon')}>
                                        {IMPORT_CONFIGS[key as ImportType].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="csv-file">2. Upload Your CSV File</Label>
                        <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} className="w-full md:w-[380px]" disabled={isProcessing} />
                        <p className="text-xs text-muted-foreground">Don't have a file? You can <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleDownloadTemplate}>download a template for {currentConfig.label}</Button>.</p>
                    </div>
                </div>

                {isProcessing && (
                    <div className="flex items-center justify-center p-8 text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
                        {importStatus === 'parsing' ? 'Analyzing your file...' : 'Importing data... Please wait.'}
                    </div>
                )}
                
                {errorMessage && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                )}

                {importStatus === 'mapping' && headers.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">3. Map Your Columns</h3>
                        <p className="text-sm text-muted-foreground">Match the columns from your file to the fields in OpSite. Required fields are marked with <span className="text-destructive">*</span>.</p>
                        <div className="border rounded-md p-4 space-y-3 max-h-96 overflow-y-auto">
                            {headers.map(header => (
                                <div key={header} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                                    <Label htmlFor={`map-${header}`}>{header}</Label>
                                    <div className="flex items-center gap-2">
                                        <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block"/>
                                        <Select value={columnMapping[header] || 'ignore'} onValueChange={(value) => handleMappingChange(header, value)}>
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
                        
                        <h4 className="font-semibold pt-4">Data Preview</h4>
                        <div className="border rounded-lg overflow-auto">
                            <Table>
                                <TableHeader><TableRow>{headers.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                                <TableBody>
                                    {dataPreview.map((row, index) => (
                                        <TableRow key={`preview-${index}`}>{headers.map(h => <TableCell key={`${h}-${index}`} className="truncate max-w-[150px]">{row[h]}</TableCell>)}</TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 {importStatus === 'mapping' && (
                     <Button onClick={handleImport} disabled={isProcessing}>
                        <CheckCircle className="mr-2 h-4 w-4"/> Confirm Mapping & Start Import
                     </Button>
                 )}
                 {importStatus === 'completed' && (
                    <div className="w-full">
                        <Alert variant={importResult && importResult.errorCount > 0 ? "destructive" : "default"}>
                             {importResult && importResult.errorCount === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            <AlertTitle>Import Completed</AlertTitle>
                            <AlertDescription>
                                {importResult && <p>Successfully imported {importResult.successCount} record(s). Failed: {importResult.errorCount}.</p>}
                                {importResult && importResult.errors.length > 0 && (
                                    <ul className="mt-2 list-disc list-inside text-xs">
                                        {importResult.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                                        {importResult.errors.length > 5 && <li>...and {importResult.errors.length - 5} more errors.</li>}
                                    </ul>
                                )}
                            </AlertDescription>
                        </Alert>
                         <Button onClick={resetState} variant="outline" className="mt-4">Import Another File</Button>
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}
