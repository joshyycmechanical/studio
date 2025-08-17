
'use client';

import { auth } from '@/lib/firebase/config';
import type { Module } from '@/types/module';

// --- API Client Helper ---
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
 * Fetches the modules installed for a specific company, using an explicitly provided token.
 * This function now requires a companyId and the idToken to be passed.
 */
export async function fetchInstalledCompanyModules(companyId: string, idToken: string): Promise<Module[]> {
    if (!idToken) throw new Error("User not authenticated.");
    if (!companyId) throw new Error("Company ID is required to fetch modules.");
    
    const response = await fetch(`/api/companies/${companyId}/modules`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    
    return handleApiResponse(response);
}

/**
 * Fetches all modules designated as "platform modules", using an explicitly provided token.
 * This is intended for platform administrators.
 */
export async function fetchPlatformModules(idToken: string): Promise<Module[]> {
    if (!idToken) throw new Error("User not authenticated.");

    const response = await fetch('/api/platform/modules', {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });

    return handleApiResponse(response);
}
