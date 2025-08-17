
'use client';
import type { PlatformStats } from '@/types/platform';

// Helper to handle API responses
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
 * Fetches platform-wide statistics from the API.
 * Requires platform admin privileges.
 * @param idToken The Firebase ID token of the authenticated user.
 */
export async function fetchPlatformStats(idToken: string): Promise<PlatformStats> {
    console.log("[API Service] Fetching platform stats via API");
    const response = await fetch('/api/platform/stats', {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const stats = await handleApiResponse(response);
    return stats;
}
