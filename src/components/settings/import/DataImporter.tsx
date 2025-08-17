
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, CheckCircle, FileDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ColumnMapper } from './ColumnMapper';
import { DataPreview } from './DataPreview';
import { ImportResults } from './ImportResults';
import { useDataImporter, IMPORT_CONFIGS, ImportType } from './useDataImporter';

export function DataImporter() {
    const {
        importType,
        handleImportTypeChange,
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
        resetState
    } = useDataImporter();

    const isProcessing = importStatus === 'parsing' || importStatus === 'uploading';
    const currentConfig = IMPORT_CONFIGS[importType];

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
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                )}

                {importStatus === 'mapping' && headers.length > 0 && (
                    <>
                        <ColumnMapper
                            importType={importType}
                            headers={headers}
                            columnMapping={columnMapping}
                            onMappingChange={handleMappingChange}
                        />
                        <DataPreview headers={headers} dataPreview={dataPreview} />
                    </>
                )}
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 {importStatus === 'mapping' && (
                     <Button onClick={handleImport} disabled={isProcessing}>
                        <CheckCircle className="mr-2 h-4 w-4"/> Confirm Mapping & Start Import
                     </Button>
                 )}
                 <ImportResults importResult={importResult} onReset={resetState} />
            </CardFooter>
        </Card>
    );
}
