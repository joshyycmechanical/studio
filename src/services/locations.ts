'use client';

import { auth, db } from '@/lib/firebase/config';
import {
    collection, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Location } from '@/types/location';

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

export async function fetchCompanyLocations(companyId: string): Promise<Location[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId) return [];
    console.log(`[Service] Fetching locations for company ${companyId} from API.`);
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/locations`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const locations = await handleApiResponse(response);
    return locations.map((loc: any) => ({
        ...loc,
        created_at: new Date(loc.created_at),
    }));
}

export async function fetchLocationsByCustomerId(companyId: string, customerId: string): Promise<Location[]> {
    const allLocations = await fetchCompanyLocations(companyId);
    return allLocations.filter(loc => loc.customer_id === customerId);
}

export async function fetchLocationById(companyId: string, locationId: string): Promise<Location | null> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !locationId) return null;
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/locations/${locationId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    if (response.status === 404) return null;
    const loc = await handleApiResponse(response);
    return {
        ...loc,
        created_at: new Date(loc.created_at),
    };
}

export async function createLocation(data: Omit<Location, 'id' | 'created_at' | 'equipment_count'>): Promise<Location> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/locations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
    });
    return handleApiResponse(response);
}


export async function updateLocation(companyId: string, locationId: string, data: Partial<Omit<Location, 'id' | 'company_id' | 'customer_id' | 'created_at' | 'equipment_count'>>): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/locations/${locationId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
    });
    await handleApiResponse(response);
}

export async function deleteLocation(companyId: string, locationId: string): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !locationId) throw new Error("IDs are required.");

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/locations/${locationId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });
    await handleApiResponse(response);
}
