
'use client';

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { ImportResult } from './useDataImporter';

interface ImportResultsProps {
    importResult: ImportResult | null;
    onReset: () => void;
}

export function ImportResults({ importResult, onReset }: ImportResultsProps) {
    if (!importResult) return null;

    return (
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
             <Button onClick={onReset} variant="outline" className="mt-4">Import Another File</Button>
        </div>
    );
}
