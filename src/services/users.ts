
'use client';

import { auth } from '@/lib/firebase/config';
import type { UserProfile, UserProfileWithRoles } from '@/types/user';

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
    // Handle 204 No Content for DELETE/PUT requests that don't return a body
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

/**
 * Fetches the complete profile for the currently authenticated user from a secure API endpoint.
 * This is the primary function for loading the user's session data.
 * @param idToken The Firebase ID token of the authenticated user.
 * @returns A promise that resolves to the UserProfile object or null if not found.
 */
export async function fetchUserProfileFromAPI(idToken: string): Promise<UserProfile | null> {
    const response = await fetch('/api/users/me/profile', {
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });
    if (response.status === 404) {
        // A 404 from this endpoint means the user's Firestore document doesn't exist yet.
        return null;
    }
    const profileData = await handleApiResponse(response);
    
    // The API now returns a fully-formed UserProfile object including permissions,
    // so we just need to parse the dates.
    return {
      ...profileData,
      created_at: new Date(profileData.created_at),
      last_login_at: profileData.last_login_at ? new Date(profileData.last_login_at) : null,
    };
}


/**
 * Fetches all user profiles for a given company via the API.
 * This function is intended to be called from client components.
 */
export async function fetchCompanyUsers(companyId: string): Promise<UserProfileWithRoles[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId) return [];

    console.log(`[Service] Fetching users for company ${companyId} from API.`);
    const idToken = await auth.currentUser.getIdToken();
    
    const response = await fetch(`/api/users?companyId=${companyId}`, {
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });
    
    const users = await handleApiResponse(response);
    // Convert date strings from JSON back to Date objects
    return users.map((u: any) => ({
        ...u,
        created_at: new Date(u.created_at),
        last_login: u.last_login ? new Date(u.last_login) : null,
    }));
}

/**
 * Invites a new user to a company via the API.
 */
export async function inviteUserApi(idToken: string, companyId: string, data: { email: string, fullName?: string | null, roleIds: string[] }): Promise<any> {
    const response = await fetch(`/api/users/invite?companyId=${companyId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return handleApiResponse(response);
}


/**
 * Updates a user's profile and role assignments via the API.
 */
export async function updateUserApi(idToken: string, userId: string, data: { full_name: string, status: 'active' | 'suspended', roleIds: string[] }): Promise<any> {
    const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return handleApiResponse(response);
}

/**
 * Deletes a user via the API.
 */
export async function deleteUserApi(idToken: string, userId: string): Promise<void> {
    const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    await handleApiResponse(response);
}


/**
 * Resends an invitation to a user via the API.
 */
export async function resendInviteApi(idToken: string, userId: string, email: string): Promise<void> {
    const response = await fetch(`/api/users/invite?userId=${userId}&email=${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    await handleApiResponse(response);
}
