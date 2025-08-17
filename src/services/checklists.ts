
'use client'; 

import { auth } from '@/lib/firebase/config';
import {
    doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, collection, serverTimestamp, query, where, getDocs,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { ChecklistTemplate, ChecklistInstance, ChecklistInstanceAnswer } from '@/types/checklist';
import { db } from '@/lib/firebase/config';

// Helper to map a Firestore document to a ChecklistInstance object
const mapDocToChecklistInstance = (docSnap: import('firebase/firestore').DocumentSnapshot): ChecklistInstance => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        ...data,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
        completed_at: (data.completed_at as Timestamp)?.toDate() ?? null,
    } as ChecklistInstance;
};

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

        const errorMessage = (typeof errorData === 'object' && errorData !== null && errorData.message)
            ? errorData.message
            : JSON.stringify(errorData);

        throw new Error(errorMessage || `An unknown API error occurred. Status: ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

// --- Platform Admin API Functions ---

export async function fetchPlatformChecklistTemplates(idToken: string): Promise<ChecklistTemplate[]> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    const response = await fetch('/api/platform/checklist-templates', {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const templates = await handleApiResponse(response);
    return templates.map((t: any) => ({
        ...t,
        created_at: new Date(t.created_at),
        updated_at: t.updated_at ? new Date(t.updated_at) : null,
    }));
}

export async function fetchPlatformChecklistTemplateById(idToken: string, templateId: string): Promise<ChecklistTemplate | null> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    const response = await fetch(`/api/platform/checklist-templates/${templateId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    if (response.status === 404) return null;
    const template = await handleApiResponse(response);
    return {
        ...template,
        created_at: new Date(template.created_at),
        updated_at: template.updated_at ? new Date(template.updated_at) : null,
    };
}

export async function createPlatformChecklistTemplate(idToken: string, data: Omit<ChecklistTemplate, 'id' | 'company_id' | 'is_platform_template' | 'created_at' | 'created_by'>): Promise<ChecklistTemplate> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    const response = await fetch('/api/platform/checklist-templates', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return handleApiResponse(response);
}

export async function updatePlatformChecklistTemplate(idToken: string, templateId: string, data: Partial<Omit<ChecklistTemplate, 'id' | 'company_id' | 'is_platform_template'>>): Promise<void> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    const response = await fetch(`/api/platform/checklist-templates/${templateId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    await handleApiResponse(response);
}

export async function deletePlatformChecklistTemplate(idToken: string, templateId: string): Promise<void> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    const response = await fetch(`/api/platform/checklist-templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    await handleApiResponse(response);
}

// --- Company Client SDK Functions ---

export async function fetchCompanyChecklistTemplates(companyId: string): Promise<ChecklistTemplate[]> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId) return [];
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/checklists`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    const templates = await handleApiResponse(response);
    return templates.map((t: any) => ({
        ...t,
        created_at: new Date(t.created_at),
        updated_at: t.updated_at ? new Date(t.updated_at) : null,
    }));
}

export async function fetchChecklistTemplateById(companyId: string, templateId: string): Promise<ChecklistTemplate | null> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !templateId) return null;
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/checklist-templates/${templateId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });

    if (response.status === 404) return null;
    const template = await handleApiResponse(response);
    
    return {
        ...template,
        created_at: new Date(template.created_at),
        updated_at: template.updated_at ? new Date(template.updated_at) : null,
    };
}

export async function fetchChecklistInstanceById(instanceId: string): Promise<ChecklistInstance | null> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/checklist-instances/${instanceId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });

    if (response.status === 404) return null;
    const instance = await handleApiResponse(response);
    
    return {
        ...instance,
        created_at: new Date(instance.created_at),
        updated_at: instance.updated_at ? new Date(instance.updated_at) : null,
        completed_at: instance.completed_at ? new Date(instance.completed_at) : null,
    };
}

/**
 * Fetches all checklist instances associated with a specific work order.
 * @param companyId The ID of the company.
 * @param workOrderId The ID of the work order.
 * @returns A promise that resolves to an array of ChecklistInstance objects.
 */
export async function fetchChecklistInstancesByWorkOrderId(companyId: string, workOrderId: string): Promise<ChecklistInstance[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !workOrderId) return [];

    const instancesCollection = collection(db, COLLECTIONS.CHECKLIST_INSTANCES);
    const q = query(
        instancesCollection,
        where('company_id', '==', companyId),
        where('work_order_id', '==', workOrderId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToChecklistInstance);
}


export async function createChecklistInstance(workOrderId: string, templateId: string): Promise<ChecklistInstance> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/checklist-instances', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ work_order_id: workOrderId, template_id: templateId }),
    });

    return handleApiResponse(response);
}

export async function updateChecklistInstanceAnswers(instanceId: string, answers: ChecklistInstanceAnswer[], status: 'in-progress' | 'completed'): Promise<void> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    
    const idToken = await auth.currentUser.getIdToken();
    await fetch(`/api/checklist-instances/${instanceId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers, status }),
    });
}
