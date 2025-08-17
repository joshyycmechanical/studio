
'use client'; 

import { auth } from '@/lib/firebase/config';
import type { Repair } from '@/types/repair';

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
 * Creates a new repair record by calling the backend API.
 * This function is now responsible for handling the full repair payload, including materials.
 */
export async function createRepair(data: Omit<Repair, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'updated_by' | 'technician_id'>): Promise<Repair> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/repairs', { // Pointing to the new dedicated repair API
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    return handleApiResponse(response);
}


// --- Other existing service functions ---

export async function fetchCompanyRepairs(companyId: string): Promise<Repair[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId) return [];
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/repairs?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    
    const repairs = await handleApiResponse(response);
    return repairs.map((r: any) => ({
        ...r,
        repair_date: new Date(r.repair_date),
        created_at: new Date(r.created_at),
    }));
}

export async function fetchRepairsByWorkOrderId(companyId: string, workOrderId: string): Promise<Repair[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !workOrderId) return [];

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/repairs?workOrderId=${workOrderId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });

    const repairs = await handleApiResponse(response);
    return repairs.map((r: any) => ({
        ...r,
        repair_date: new Date(r.repair_date),
        created_at: new Date(r.created_at),
    }));
}

export async function fetchRepairById(companyId: string, repairId: string): Promise<Repair | null> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !repairId) return null;
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/repairs/${repairId}`, {
         headers: { 'Authorization': `Bearer ${idToken}` },
    });
     if (response.status === 404) return null;

    const repair = await handleApiResponse(response);
    return {
        ...repair,
        repair_date: new Date(repair.repair_date),
        created_at: new Date(repair.created_at),
    };
}


export async function updateRepair(companyId: string, repairId: string, data: Partial<Omit<Repair, 'id' | 'company_id' | 'created_at'>>, userId: string): Promise<void> {
    // This function can now call the new repair-specific API endpoint
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    await fetch(`/api/repairs/${repairId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function deleteRepair(companyId: string, repairId: string): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    await fetch(`/api/repairs/${repairId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
}
