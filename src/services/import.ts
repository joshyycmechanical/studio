
'use client';

import { auth } from '@/lib/firebase/config';

interface ImportResult {
    successCount: number;
    errorCount: number;
    errors: string[];
}

async function handleApiResponse(response: Response) {
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: `API request failed with status ${response.status} and the response body was not valid JSON.` };
        }
        
        console.error('[API Client] Full API error response:', errorData);

        const errorMessage = (typeof errorData === 'object' && errorData !== null && (errorData as any).message)
            ? (errorData as any).message
            : JSON.stringify(errorData);

        throw new Error(errorMessage || `An unknown API error occurred. Status: ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

/**
 * Sends customer data to the backend API for bulk import.
 * @param idToken The Firebase ID token of the authenticated user.
 * @param data An array of data objects parsed from the CSV.
 * @param mapping An object mapping CSV headers to OpSite field names.
 * @returns A promise that resolves to an ImportResult object.
 */
export async function importCustomersApi(idToken: string, data: any[], mapping: { [key: string]: string }): Promise<ImportResult> {
    if (!auth.currentUser) {
        throw new Error("User not authenticated.");
    }
    console.log(`[API Service] Importing ${data.length} customers via API with mapping.`);

    const response = await fetch('/api/import/customers', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, mapping }),
    });

    return handleApiResponse(response);
}

/**
 * Sends location data to the backend API for bulk import.
 * @param idToken The Firebase ID token of the authenticated user.
 * @param data An array of data objects parsed from the CSV.
 * @param mapping An object mapping CSV headers to OpSite field names.
 * @returns A promise that resolves to an ImportResult object.
 */
export async function importLocationsApi(idToken: string, data: any[], mapping: { [key: string]: string }): Promise<ImportResult> {
    if (!auth.currentUser) {
        throw new Error("User not authenticated.");
    }
    console.log(`[API Service] Importing ${data.length} locations via API with mapping.`);

    const response = await fetch('/api/import/locations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, mapping }),
    });

    return handleApiResponse(response);
}

/**
 * Sends equipment data to the backend API for bulk import.
 * @param idToken The Firebase ID token of the authenticated user.
 * @param data An array of data objects parsed from the CSV.
 * @param mapping An object mapping CSV headers to OpSite field names.
 * @returns A promise that resolves to an ImportResult object.
 */
export async function importEquipmentApi(idToken: string, data: any[], mapping: { [key: string]: string }): Promise<ImportResult> {
    if (!auth.currentUser) {
        throw new Error("User not authenticated.");
    }
    console.log(`[API Service] Importing ${data.length} equipment via API with mapping.`);

    const response = await fetch('/api/import/equipment', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, mapping }),
    });

    return handleApiResponse(response);
}
