
'use client';

import type { Role } from '@/types/role';
import { auth } from '@/lib/firebase/config';

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
    if (response.status === 204) return null; // Handle No Content
    return response.json();
}

/**
 * Fetches all roles for a specific company via the API.
 * Requires platform admin privileges.
 * @param idToken The Firebase ID token of the authenticated user.
 * @param companyId The ID of the company whose roles to fetch.
 */
export async function fetchCompanyRolesApi(idToken: string, companyId: string): Promise<Role[]> {
    if (!idToken || !companyId) return [];
    console.log(`[API Service] Fetching roles via API for company: ${companyId}`);
    const response = await fetch(`/api/roles?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const roles = await handleApiResponse(response);
    return roles.map((r: any) => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at) : new Date(),
    }));
}

/**
 * Creates a new role for a company via the API.
 * Requires platform admin privileges.
 * @param idToken The Firebase ID token of the authenticated user.
 * @param companyId The ID of the company to create the role in.
 * @param roleData The data for the new role.
 */
export async function createRoleApi(idToken: string, companyId: string, roleData: { name: string; description?: string; permissions: any }): Promise<Role> {
    console.log(`[API Service] Creating role "${roleData.name}" for company ${companyId}`);
    const response = await fetch(`/api/roles?companyId=${companyId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
    });
    return handleApiResponse(response);
}

/**
 * Updates an existing role for a company via the API.
 * Requires platform admin privileges.
 * @param idToken The Firebase ID token of the authenticated user.
 * @param companyId The ID of the company where the role exists.
 * @param roleId The ID of the role to update.
 * @param roleData The updated data for the role.
 */
export async function updateRoleApi(idToken: string, companyId: string, roleId: string, roleData: { name?: string; description?: string | null; permissions?: any }): Promise<Role> {
    console.log(`[API Service] Updating role ${roleId} for company ${companyId}`);
    const response = await fetch(`/api/roles/${roleId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
    });
    return handleApiResponse(response);
}

/**
 * Deletes a role for a company via the API.
 * Requires platform admin privileges.
 * @param idToken The Firebase ID token of the authenticated user.
 * @param companyId The ID of the company where the role exists.
 * @param roleId The ID of the role to delete.
 */
export async function deleteRoleApi(idToken: string, companyId: string, roleId: string): Promise<void> {
    console.log(`[API Service] Deleting role ${roleId} for company ${companyId}`);
    const response = await fetch(`/api/roles/${roleId}?companyId=${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    await handleApiResponse(response);
}


/**
 * Fetches all roles for the current user's company using their auth token.
 * This is the primary function for client-side components within the company context.
 * @param companyId The ID of the company whose roles to fetch.
 * @returns A promise that resolves to an array of Role objects.
 */
export async function fetchCompanyRoles(companyId: string): Promise<Role[]> {
    if (!auth.currentUser) {
        throw new Error("User not authenticated.");
    }
    if (!companyId) {
        console.warn("[Service: fetchCompanyRoles] companyId is missing.");
        return [];
    }
    console.log(`[Service] Fetching roles for company: ${companyId}`);
    const idToken = await auth.currentUser.getIdToken();
    // Re-use the API function which has the correct logic
    return fetchCompanyRolesApi(idToken, companyId);
}
