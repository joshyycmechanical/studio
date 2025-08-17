
'use client'; 

import { auth } from '@/lib/firebase/config';
import type { Deficiency } from '@/types/deficiency';

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

export async function fetchCompanyDeficiencies(companyId: string): Promise<Deficiency[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/deficiencies`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const deficiencies = await handleApiResponse(response);
    return deficiencies.map((d: any) => ({
        ...d,
        created_at: new Date(d.created_at),
        reported_at: d.reported_at ? new Date(d.reported_at) : new Date(d.created_at),
        resolved_at: d.resolved_at ? new Date(d.resolved_at) : null,
    }));
}

export async function fetchDeficiencyById(companyId: string, deficiencyId: string): Promise<Deficiency | null> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/deficiencies/${deficiencyId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    if (response.status === 404) return null;
    const deficiency = await handleApiResponse(response);
    return {
        ...deficiency,
        created_at: new Date(deficiency.created_at),
        reported_at: deficiency.reported_at ? new Date(deficiency.reported_at) : new Date(deficiency.created_at),
        resolved_at: deficiency.resolved_at ? new Date(deficiency.resolved_at) : null,
    };
}

export async function fetchDeficienciesByWorkOrderId(companyId: string, workOrderId: string): Promise<Deficiency[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !workOrderId) return [];
    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch(`/api/deficiencies?workOrderId=${workOrderId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    
    const deficiencies = await handleApiResponse(response);
    return deficiencies.map((d: any) => ({
        ...d,
        created_at: new Date(d.created_at),
        reported_at: d.reported_at ? new Date(d.reported_at) : new Date(d.created_at),
        resolved_at: d.resolved_at ? new Date(d.resolved_at) : null,
    }));
}

export async function createDeficiency(
    companyId: string,
    userId: string,
    data: Omit<Deficiency, 'id' | 'company_id' | 'created_at' | 'reported_by' | 'reported_at'>
): Promise<Deficiency> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/deficiencies`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    const newDeficiency = await handleApiResponse(response);
    
    return {
        ...newDeficiency,
        created_at: new Date(newDeficiency.created_at),
        reported_at: new Date(newDeficiency.reported_at),
    };
}
