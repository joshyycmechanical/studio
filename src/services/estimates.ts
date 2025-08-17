
'use client';

import { auth } from '@/lib/firebase/config';
import type { Estimate } from '@/types/estimate';

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
 * Fetches all estimates for the user's company via the API.
 * @returns A promise that resolves to an array of estimates.
 */
export async function fetchCompanyEstimates(): Promise<Estimate[]> {
    if (!auth?.currentUser) {
        throw new Error("User not authenticated.");
    }
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/estimates', {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    const estimates = await handleApiResponse(response);
    return estimates.map((e: any) => ({
        ...e,
        created_at: new Date(e.created_at),
        updated_at: e.updated_at ? new Date(e.updated_at) : null,
        sent_at: e.sent_at ? new Date(e.sent_at) : null,
        approved_at: e.approved_at ? new Date(e.approved_at) : null,
        rejected_at: e.rejected_at ? new Date(e.rejected_at) : null,
        valid_until: e.valid_until ? new Date(e.valid_until) : null,
    }));
}

/**
 * Fetches a single estimate by its ID via the API.
 * @param estimateId - The ID of the estimate to fetch.
 * @returns A promise that resolves to the Estimate object or null if not found.
 */
export async function fetchEstimateById(estimateId: string): Promise<Estimate | null> {
    if (!auth?.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/estimates/${estimateId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (response.status === 404) return null;
    const estimate = await handleApiResponse(response);
    return {
        ...estimate,
        created_at: new Date(estimate.created_at),
        updated_at: estimate.updated_at ? new Date(estimate.updated_at) : null,
        sent_at: estimate.sent_at ? new Date(estimate.sent_at) : null,
        approved_at: estimate.approved_at ? new Date(estimate.approved_at) : null,
        rejected_at: estimate.rejected_at ? new Date(estimate.rejected_at) : null,
        valid_until: estimate.valid_until ? new Date(estimate.valid_until) : null,
    };
}


/**
 * Creates a new estimate via the API.
 * @param estimateData - The data for the new estimate.
 * @returns The newly created estimate.
 */
export async function createEstimate(estimateData: Omit<Estimate, 'id'>): Promise<Estimate> {
  if (!auth?.currentUser) {
    throw new Error('User not authenticated.');
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch('/api/estimates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(estimateData),
  });

  return handleApiResponse(response);
}

/**
 * Updates an existing estimate via the API.
 * @param estimateId - The ID of the estimate to update.
 * @param updateData - The data to update on the estimate.
 * @returns The updated estimate object.
 */
export async function updateEstimate(estimateId: string, updateData: Partial<Estimate>): Promise<Estimate> {
    if (!auth?.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/estimates/${estimateId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(updateData),
    });
    return handleApiResponse(response);
}

/**
 * Deletes a specific estimate by its ID via the API.
 * @param estimateId - The ID of the estimate to delete.
 */
export async function deleteEstimate(estimateId: string): Promise<void> {
    if (!auth?.currentUser) {
        throw new Error("User not authenticated.");
    }
    const idToken = await auth.currentUser.getIdToken();
    await fetch(`/api/estimates/${estimateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
}
