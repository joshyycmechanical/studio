
'use client';

import * as React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

interface DataPreviewProps {
    headers: string[];
    dataPreview: any[];
}

export function DataPreview({ headers, dataPreview }: DataPreviewProps) {
    return (
        <div>
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
    );
}
