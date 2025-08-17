
'use client'; 

import { auth } from '@/lib/firebase/config';
import {
    doc, getDoc, updateDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Company } from '@/types/company';

// --- API Client Functions ---

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
 * Fetches all companies from the API. Requires platform admin privileges.
 * @param idToken The Firebase ID token of the authenticated user.
 */
export async function fetchAllCompaniesApi(idToken: string): Promise<Company[]> {
    console.log("[API Service] Fetching all companies via API");
    const response = await fetch('/api/companies', {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const companies = await handleApiResponse(response);
    // Convert date strings from JSON back to Date objects
    return companies.map((c: any) => ({
        ...c,
        created_at: new Date(c.created_at),
    }));
}

/**
 * Fetches a single company by ID from the API. Requires platform admin privileges.
 * @param idToken The Firebase ID token.
 * @param companyId The ID of the company to fetch.
 */
export async function fetchCompanyByIdApi(idToken: string, companyId: string): Promise<Company | null> {
    console.log(`[API Service] Fetching company ${companyId} via API`);
    const response = await fetch(`/api/companies/${companyId}`, {
         headers: { 'Authorization': `Bearer ${idToken}` },
    });
     if (response.status === 404) return null;
    const company = await handleApiResponse(response);
    return {
        ...company,
        created_at: new Date(company.created_at),
    };
}


/**
 * Creates a new company via the API. Requires platform admin privileges.
 * @param idToken The Firebase ID token.
 * @param companyData The data for the new company.
 */
export async function createCompanyApi(idToken: string, companyData: { name: string; subscription_plan: 'Trial' | 'Starter' | 'Pro' | 'Enterprise'; adminEmail: string; adminFullName?: string | null; }): Promise<any> {
    console.log("[API Service] Creating company via API:", companyData.name);
    const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData),
    });
    return handleApiResponse(response);
}

/**
 * Updates a company via the API. Requires platform admin privileges.
 * @param idToken The Firebase ID token.
 * @param companyId The ID of the company to update.
 * @param updateData The data to update.
 */
export async function updateCompanyApi(idToken: string, companyId: string, updateData: Partial<Pick<Company, 'name' | 'status' | 'subscription_plan'>>): Promise<Company> {
    console.log(`[API Service] Updating company ${companyId} via API with:`, updateData);
    const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
    });
    const company = await handleApiResponse(response);
    return {
        ...company,
        created_at: new Date(company.created_at),
    };
}

/**
 * Deletes (soft deletes) a company via the API. Requires platform admin privileges.
 * @param idToken The Firebase ID token.
 * @param companyId The ID of the company to delete.
 */
export async function deleteCompanyApi(idToken: string, companyId: string): Promise<void> {
    console.log(`[API Service] Deleting company ${companyId} via API`);
    const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    await handleApiResponse(response);
}


// --- Client-Side Functions ---

/**
 * Fetches the profile of the currently logged-in user's company from the API.
 * This is secure as the server determines the company based on the user's token.
 * @returns A promise that resolves to the Company object or null.
 */
export async function fetchMyCompanyProfile(): Promise<Company | null> {
    if (!auth.currentUser) {
        console.warn("[Service: fetchMyCompanyProfile] User not authenticated.");
        return null;
    }
    console.log("[API Service] Fetching current user's company profile via API");

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/company/profile', {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });

    if (response.status === 404) return null;
    
    // handleApiResponse will throw for other errors
    const company = await handleApiResponse(response);

    // Convert date strings from JSON back to Date objects
    return {
        ...company,
        created_at: new Date(company.created_at),
    };
}


/**
 * Updates the current user's company profile via a secure API endpoint.
 * @param companyId The ID of the company to update (for verification).
 * @param data The data to update (e.g., company name).
 */
export async function updateMyCompanyProfile(companyId: string, data: Partial<Pick<Company, 'name'>>): Promise<void> {
    if (!auth.currentUser) {
        throw new Error("User not authenticated.");
    }
    if (!companyId) throw new Error("Company ID is required.");
    
    console.log(`[API Service] Updating own company profile ${companyId}`);

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/company/profile`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    await handleApiResponse(response);
}
