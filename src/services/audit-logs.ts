
'use client';

import { auth } from '@/lib/firebase/config';
import type { AuditLog } from '@/types/audit-log';

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
 * Fetches audit logs from the API.
 * @param limit The number of logs to fetch.
 * @returns A promise that resolves to an array of AuditLog objects.
 */
export async function fetchAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    if (!auth.currentUser) {
        throw new Error("User not authenticated.");
    }
    console.log(`[Service] Fetching audit logs with limit: ${limit}`);
    
    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch(`/api/audit-logs?limit=${limit}`, {
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });
    
    const logs = await handleApiResponse(response);

    // Convert date strings from JSON back to Date objects
    return logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp),
    }));
}
