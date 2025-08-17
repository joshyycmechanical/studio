
'use client'; // Mark as client component

import { db } from '@/lib/firebase/config';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { WorkflowStatusConfig, WorkflowTrigger } from '@/types/workflow';

// --- Workflow Status Config Helpers ---
const mapDocToWorkflowStatusConfig = (docSnap: import('firebase/firestore').DocumentSnapshot): WorkflowStatusConfig => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        company_id: data.company_id,
        name: data.name,
        color: data.color,
        description: data.description ?? null,
        group: data.group,
        is_final_step: data.is_final_step,
        sort_order: data.sort_order,
        // Note: trigger_count is usually calculated or fetched separately if needed
    };
};

// --- Workflow Trigger Helpers ---
const mapDocToWorkflowTrigger = (docSnap: import('firebase/firestore').DocumentSnapshot): WorkflowTrigger => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        status_id: data.status_id,
        company_id: data.company_id,
        name: data.name,
        event: data.event,
        delay_minutes: data.delay_minutes ?? null,
        conditions: data.conditions ?? [],
        actions: data.actions ?? [],
        is_active: data.is_active,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
    };
};

// --- Workflow Status Config Service Functions ---

/**
 * Fetches all workflow status configurations for a specific company.
 */
export async function fetchCompanyWorkflowStatuses(companyId: string): Promise<WorkflowStatusConfig[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching workflow statuses for company: ${companyId}`);
    const statusesCollection = collection(db, COLLECTIONS.WORKFLOW_STATUSES); // Assuming collection name
    const q = query(statusesCollection, where('company_id', '==', companyId));
    const querySnapshot = await getDocs(q);
    const statuses = querySnapshot.docs.map(mapDocToWorkflowStatusConfig);
    // Sort client-side to avoid needing composite index
    return statuses.sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Creates a new workflow status configuration.
 * Note: In a real app, adding/deleting statuses might require complex migration or handling of existing WOs.
 */
export async function createWorkflowStatus(companyId: string, data: Omit<WorkflowStatusConfig, 'id' | 'company_id'>): Promise<WorkflowStatusConfig> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    console.log(`[Firestore Service] Creating workflow status "${data.name}" for company: ${companyId}`);
    const statusesCollection = collection(db, COLLECTIONS.WORKFLOW_STATUSES);
    const newStatusData = {
        ...data,
        company_id: companyId,
    };
    const docRef = await addDoc(statusesCollection, newStatusData);
    const newDocSnap = await getDoc(docRef);
    return mapDocToWorkflowStatusConfig(newDocSnap);
}

/**
 * Updates an existing workflow status configuration.
 */
export async function updateWorkflowStatus(companyId: string, statusId: string, data: Partial<Omit<WorkflowStatusConfig, 'id' | 'company_id'>>): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !statusId) throw new Error("Company ID and Status ID are required.");
    console.log(`[Firestore Service] Updating workflow status ${statusId} for company: ${companyId}`);
    const statusRef = doc(db, COLLECTIONS.WORKFLOW_STATUSES, statusId);
    // Verify ownership
    const currentDoc = await getDoc(statusRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Workflow status not found or access denied.");
    }
    await updateDoc(statusRef, data);
}

/**
 * Deletes a workflow status configuration.
 * WARNING: Deleting statuses used by active workflows or work orders can cause issues.
 * This should be handled with extreme care, possibly requiring migration logic.
 */
export async function deleteWorkflowStatus(companyId: string, statusId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !statusId) throw new Error("Company ID and Status ID are required.");
    console.warn(`[Firestore Service] Attempting to delete workflow status ${statusId} for company: ${companyId}. This can be dangerous.`);
    const statusRef = doc(db, COLLECTIONS.WORKFLOW_STATUSES, statusId);
    // Verify ownership
    const currentDoc = await getDoc(statusRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Workflow status not found or access denied.");
    }
    // TODO: Add checks here - is this status used in any triggers? Is it the current status of any WOs?
    // Block deletion or implement migration if necessary.
    await deleteDoc(statusRef);
    console.log(`[Firestore Service] Workflow status ${statusId} deleted (potentially unsafe).`);
}

// --- Workflow Trigger Service Functions ---

/**
 * Fetches all workflow triggers for a specific company, optionally filtered by status ID.
 */
export async function fetchCompanyWorkflowTriggers(companyId: string, statusId?: string): Promise<WorkflowTrigger[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching workflow triggers for company: ${companyId}${statusId ? `, status: ${statusId}` : ''}`);
    const triggersCollection = collection(db, COLLECTIONS.WORKFLOW_TRIGGERS); // Assuming collection name
    const constraints: any[] = [
        where('company_id', '==', companyId),
    ];
    if (statusId) {
        constraints.push(where('status_id', '==', statusId));
    }
    const q = query(triggersCollection, ...constraints);
    const querySnapshot = await getDocs(q);
    const triggers = querySnapshot.docs.map(mapDocToWorkflowTrigger);
    // Sort client-side
    return triggers.sort((a,b) => a.name.localeCompare(b.name));
}

/**
 * Creates a new workflow trigger.
 */
export async function createWorkflowTrigger(companyId: string, data: Omit<WorkflowTrigger, 'id' | 'company_id' | 'created_at' | 'updated_at'>): Promise<WorkflowTrigger> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !data.status_id) throw new Error("Company ID and Status ID are required.");
    console.log(`[Firestore Service] Creating workflow trigger "${data.name}" for company: ${companyId}`);
    const triggersCollection = collection(db, COLLECTIONS.WORKFLOW_TRIGGERS);
    const newTriggerData = {
        ...data,
        company_id: companyId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };
    const docRef = await addDoc(triggersCollection, newTriggerData);
    const newDocSnap = await getDoc(docRef);
    return mapDocToWorkflowTrigger(newDocSnap);
}

/**
 * Updates an existing workflow trigger.
 */
export async function updateWorkflowTrigger(companyId: string, triggerId: string, data: Partial<Omit<WorkflowTrigger, 'id' | 'company_id' | 'created_at'>>): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !triggerId) throw new Error("Company ID and Trigger ID are required.");
    console.log(`[Firestore Service] Updating workflow trigger ${triggerId} for company: ${companyId}`);
    const triggerRef = doc(db, COLLECTIONS.WORKFLOW_TRIGGERS, triggerId);
    // Verify ownership
    const currentDoc = await getDoc(triggerRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Workflow trigger not found or access denied.");
    }
    await updateDoc(triggerRef, { ...data, updated_at: serverTimestamp() });
}

/**
 * Deletes a workflow trigger.
 */
export async function deleteWorkflowTrigger(companyId: string, triggerId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !triggerId) throw new Error("Company ID and Trigger ID are required.");
    console.log(`[Firestore Service] Deleting workflow trigger ${triggerId} for company: ${companyId}`);
    const triggerRef = doc(db, COLLECTIONS.WORKFLOW_TRIGGERS, triggerId);
    // Verify ownership
    const currentDoc = await getDoc(triggerRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Workflow trigger not found or access denied.");
    }
    await deleteDoc(triggerRef);
}
