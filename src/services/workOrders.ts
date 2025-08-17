
'use client'; 

import { auth, db } from '@/lib/firebase/config';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { WorkOrder, WorkOrderNote, WorkOrderPriority, WorkOrderStatus } from '@/types/work-order';

// --- API Client Helper for services ---
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
 * Fetches all work orders for the user's company via a secure API endpoint.
 */
export async function fetchCompanyWorkOrders(): Promise<WorkOrder[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/work-orders', {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const workOrders = await handleApiResponse(response);
    // Convert date strings from JSON back to Date objects
    return workOrders.map((wo: any) => ({
        ...wo,
        created_at: new Date(wo.created_at),
        scheduled_date: wo.scheduled_date ? new Date(wo.scheduled_date) : null,
        completed_date: wo.completed_date ? new Date(wo.completed_date) : null,
    }));
}

/**
 * Fetches work orders filtered by a specific customer ID.
 */
export async function fetchWorkOrdersByCustomerId(companyId: string, customerId: string): Promise<WorkOrder[]> {
     if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/work-orders?customerId=${customerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const workOrders = await handleApiResponse(response);
    return workOrders.map((wo: any) => ({
        ...wo,
        created_at: new Date(wo.created_at),
        scheduled_date: wo.scheduled_date ? new Date(wo.scheduled_date) : null,
        completed_date: wo.completed_date ? new Date(wo.completed_date) : null,
    }));
}

/**
 * Fetches work orders filtered by a specific location ID.
 */
export async function fetchWorkOrdersByLocationId(companyId: string, locationId: string): Promise<WorkOrder[]> {
     if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/work-orders?locationId=${locationId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const workOrders = await handleApiResponse(response);
    return workOrders.map((wo: any) => ({
        ...wo,
        created_at: new Date(wo.created_at),
        scheduled_date: wo.scheduled_date ? new Date(wo.scheduled_date) : null,
        completed_date: wo.completed_date ? new Date(wo.completed_date) : null,
    }));
}

/**
 * Fetches work orders filtered by a specific equipment ID.
 */
export async function fetchWorkOrdersByEquipmentId(equipmentId: string): Promise<WorkOrder[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const companyId = (await auth.currentUser.getIdTokenResult()).claims.company_id;

    if (!companyId || !equipmentId) return [];
    
    const woCollection = collection(db, COLLECTIONS.WORK_ORDERS);
    const q = query(
        woCollection,
        where('company_id', '==', companyId),
        where('equipment_id', '==', equipmentId),
        orderBy('created_at', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at.toDate(),
    })) as WorkOrder[];
}


/**
 * Fetches a single work order by its ID from the secure API endpoint.
 */
export async function fetchWorkOrderById(companyId: string, workOrderId: string): Promise<WorkOrder | null> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/work-orders/${workOrderId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    if (response.status === 404) return null;
    const workOrder = await handleApiResponse(response);
    return {
        ...workOrder,
        created_at: new Date(workOrder.created_at),
        scheduled_date: workOrder.scheduled_date ? new Date(workOrder.scheduled_date) : null,
        completed_date: workOrder.completed_date ? new Date(workOrder.completed_date) : null,
        public_notes: (workOrder.public_notes || []).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })),
        internal_notes: (workOrder.internal_notes || []).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })),
    };
}


/**
 * Creates a new work order.
 */
export async function createWorkOrder(companyId: string, userId: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/work-orders', {
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
 * Updates an existing work order.
 */
export async function updateWorkOrder(companyId: string, workOrderId: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/work-orders/${workOrderId}`, {
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
 * Adds a new note to a work order.
 */
export async function addWorkOrderNote(workOrderId: string, note: Omit<WorkOrderNote, 'id' | 'authorId' | 'authorName' | 'timestamp'>): Promise<WorkOrderNote> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/work-orders/${workOrderId}/notes`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(note),
    });
    return handleApiResponse(response);
}

/**
 * Updates an existing work order note.
 */
export async function updateWorkOrderNote(workOrderId: string, noteId: string, content: string): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/work-orders/${workOrderId}/notes/${noteId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
    });
    await handleApiResponse(response);
}

/**
 * Deletes a note from a work order.
 */
export async function deleteWorkOrderNote(workOrderId: string, noteId: string): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/work-orders/${workOrderId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    await handleApiResponse(response);
}

/**
 * Deletes a work order.
 */
export async function deleteWorkOrder(companyId: string, workOrderId: string): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
}
