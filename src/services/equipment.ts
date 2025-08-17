
'use client'; 

import { auth, db } from '@/lib/firebase/config';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Equipment, EquipmentStatus } from '@/types/equipment';
import { useQuery } from '@tanstack/react-query';


async function handleApiResponse(response: Response) {
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: `API request failed with status ${response.status} and the response body was not valid JSON.` };
        }
        
        console.error('[API Client] Full API error response:', errorData);

        const errorMessage = (typeof errorData === 'object' && errorData !== null && errorData.message)
            ? errorData.message
            : JSON.stringify(errorData);

        throw new Error(errorMessage || `An unknown API error occurred. Status: ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

export async function fetchCompanyEquipment(companyId: string): Promise<Equipment[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId) return [];
    console.log(`[Service] Fetching equipment for company ${companyId} from API.`);
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/equipment?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const equipment = await handleApiResponse(response);
    return equipment.map((eq: any) => ({
        ...eq,
        created_at: new Date(eq.created_at),
        installation_date: eq.installation_date ? new Date(eq.installation_date) : null,
        last_service_date: eq.last_service_date ? new Date(eq.last_service_date) : null,
        next_service_due_date: eq.next_service_due_date ? new Date(eq.next_service_due_date) : null,
    }));
}

export async function fetchEquipmentByLocationId(companyId: string, locationId: string): Promise<Equipment[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !locationId) return [];
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/equipment?companyId=${companyId}&locationId=${locationId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });

    const equipment = await handleApiResponse(response);
    return equipment.map((eq: any) => ({
        ...eq,
        created_at: new Date(eq.created_at),
        installation_date: eq.installation_date ? new Date(eq.installation_date) : null,
        last_service_date: eq.last_service_date ? new Date(eq.last_service_date) : null,
        next_service_due_date: eq.next_service_due_date ? new Date(eq.next_service_due_date) : null,
    }));
}

export async function fetchEquipmentById(equipmentId: string): Promise<Equipment | null> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!equipmentId) return null;

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/equipment/${equipmentId}`, {
         headers: { 'Authorization': `Bearer ${idToken}` }
    });

    if (response.status === 404) return null;
    const eq = await handleApiResponse(response);
    return {
        ...eq,
        created_at: new Date(eq.created_at),
        installation_date: eq.installation_date ? new Date(eq.installation_date) : null,
        last_service_date: eq.last_service_date ? new Date(eq.last_service_date) : null,
        next_service_due_date: eq.next_service_due_date ? new Date(eq.next_service_due_date) : null,
    }
}

export async function createEquipment(companyId: string, userId: string, data: Omit<Equipment, 'id' | 'created_at' | 'company_id' | 'customer_id'>): Promise<Equipment> {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Authentication token not found.");

    const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, company_id: companyId }),
    });

    return handleApiResponse(response);
}

export async function updateEquipment(equipmentId: string, data: Partial<Omit<Equipment, 'id' | 'company_id' | 'location_id' | 'customer_id' | 'created_at'>>): Promise<void> {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Authentication token not found.");
    
    const response = await fetch(`/api/equipment/${equipmentId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    
    await handleApiResponse(response);
}

export async function deleteEquipment(companyId: string, equipmentId: string): Promise<void> {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error("Authentication token not found.");

    const response = await fetch(`/api/equipment/${equipmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    
    await handleApiResponse(response);
}
