
'use client'; // Mark as client component because it uses the client SDK

import { db } from '@/lib/firebase/config'; // Import client Firestore instance
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { MaintenanceContract, ScheduledMaintenanceVisit } from '@/types/maintenance';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { ChecklistTemplate } from '@/types/checklist';

// --- Helper Functions ---

const mapDocToMaintenanceContract = (docSnap: import('firebase/firestore').DocumentSnapshot): MaintenanceContract => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        company_id: data.company_id,
        customer_id: data.customer_id,
        location_ids: data.location_ids || [],
        equipment_ids: data.equipment_ids || null,
        name: data.name,
        frequency: data.frequency,
        custom_frequency_details: data.custom_frequency_details || null,
        start_date: (data.start_date as Timestamp)?.toDate() ?? new Date(),
        end_date: (data.end_date as Timestamp)?.toDate() ?? null,
        is_active: data.is_active,
        notes: data.notes || null,
        checklist_template_id: data.checklist_template_id || null,
        estimated_duration_hours: data.estimated_duration_hours || null,
        created_by: data.created_by,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
        updated_by: data.updated_by || null,
    };
};

// --- Firestore Service Functions ---

/**
 * Fetches all maintenance contracts for a given company.
 */
export async function fetchCompanyMaintenanceContracts(companyId: string): Promise<MaintenanceContract[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching maintenance contracts for company: ${companyId}`);
    const contractsCollection = collection(db, COLLECTIONS.MAINTENANCE_CONTRACTS);
    const q = query(contractsCollection, where('company_id', '==', companyId));
    const querySnapshot = await getDocs(q);
    const contracts = querySnapshot.docs.map(mapDocToMaintenanceContract);
    // Sort client-side
    return contracts.sort((a,b) => a.name.localeCompare(b.name));
}

/**
 * Fetches a single maintenance contract by ID.
 */
export async function fetchMaintenanceContractById(companyId: string, contractId: string): Promise<MaintenanceContract | null> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !contractId) return null;
    console.log(`[Firestore Service] Fetching maintenance contract ${contractId} for company ${companyId}`);
    const contractRef = doc(db, COLLECTIONS.MAINTENANCE_CONTRACTS, contractId);
    const docSnap = await getDoc(contractRef);

    if (!docSnap.exists()) {
        console.warn(`[Firestore Service] Maintenance contract ${contractId} not found.`);
        return null;
    }
    const data = docSnap.data();
    if (data.company_id !== companyId) {
        console.error(`[Firestore Service] Security violation: Attempted to fetch contract ${contractId} belonging to company ${data.company_id} from context of company ${companyId}`);
        return null;
    }
    return mapDocToMaintenanceContract(docSnap);
}

/**
 * Creates a new maintenance contract.
 */
export async function createMaintenanceContract(
    companyId: string,
    userId: string,
    data: Omit<MaintenanceContract, 'id' | 'company_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'>
): Promise<MaintenanceContract> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !userId) throw new Error("Company ID and User ID are required.");
    console.log(`[Firestore Service] Creating maintenance contract for company: ${companyId} by user ${userId}`);

    const contractsCollection = collection(db, COLLECTIONS.MAINTENANCE_CONTRACTS);
    const newContractData = {
        ...data,
        company_id: companyId,
        created_by: userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        updated_by: userId,
        // Convert Date objects back to Timestamps for storage
        start_date: data.start_date instanceof Date ? Timestamp.fromDate(data.start_date) : data.start_date,
        end_date: data.end_date instanceof Date ? Timestamp.fromDate(data.end_date) : data.end_date,
    };

    const docRef = await addDoc(contractsCollection, newContractData);
    console.log("[Firestore Service] New Maintenance Contract Added:", docRef.id);
    const newDocSnap = await getDoc(docRef);
    return mapDocToMaintenanceContract(newDocSnap);
}

/**
 * Updates an existing maintenance contract.
 */
export async function updateMaintenanceContract(
    companyId: string,
    contractId: string,
    data: Partial<Omit<MaintenanceContract, 'id' | 'company_id' | 'created_at' | 'created_by'>>,
    userId: string
): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !contractId || !userId) throw new Error("Company ID, Contract ID, and User ID are required.");
    console.log(`[Firestore Service] Updating maintenance contract ${contractId} for company ${companyId} by user ${userId}`);

    const contractRef = doc(db, COLLECTIONS.MAINTENANCE_CONTRACTS, contractId);
    const currentDoc = await getDoc(contractRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Maintenance contract not found or access denied.");
    }

    const updateData: { [key: string]: any } = {
        ...data,
        updated_at: serverTimestamp(),
        updated_by: userId,
    };

    // Convert dates back to Timestamps if they exist in the update data
    if (data.start_date !== undefined) {
        updateData.start_date = data.start_date instanceof Date ? Timestamp.fromDate(data.start_date) : data.start_date;
    }
    if (data.end_date !== undefined) { // Handle null correctly
        updateData.end_date = data.end_date instanceof Date ? Timestamp.fromDate(data.end_date) : data.end_date;
    }
     // Remove fields that should not be updated directly
     delete updateData.id;
     delete updateData.company_id;
     delete updateData.created_at;
     delete updateData.created_by;

    await updateDoc(contractRef, updateData);
    console.log("[Firestore Service] Maintenance Contract Updated:", contractId);
}

/**
 * Deletes a maintenance contract.
 */
export async function deleteMaintenanceContract(companyId: string, contractId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !contractId) throw new Error("Company ID and Contract ID are required.");
    console.log(`[Firestore Service] Deleting maintenance contract ${contractId} for company ${companyId}`);

    const contractRef = doc(db, COLLECTIONS.MAINTENANCE_CONTRACTS, contractId);
    const currentDoc = await getDoc(contractRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Maintenance contract not found or access denied.");
    }

    // TODO: Consider implications: Should deleting a contract also delete future scheduled visits?
    // This might require a Cloud Function for cascading deletes.

    await deleteDoc(contractRef);
    console.log(`[Firestore Service] Maintenance contract ${contractId} deleted.`);
}


// --- Helper functions to fetch related data for dropdowns ---

/** Fetches customers (already in customer service, potentially reuse) */
export async function fetchMaintenanceCustomers(companyId: string): Promise<Customer[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    const customersCollection = collection(db, COLLECTIONS.CUSTOMERS);
    const q = query(customersCollection, where('company_id', '==', companyId), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    const customers = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        created_at: (docSnap.data().created_at as Timestamp)?.toDate() ?? new Date(),
    } as Customer));
    return customers.sort((a,b) => a.name.localeCompare(b.name));
}

/** Fetches locations for a specific customer (already in location service, potentially reuse) */
export async function fetchMaintenanceCustomerLocations(companyId: string, customerId: string): Promise<Location[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !customerId) return [];
    const locationsCollection = collection(db, COLLECTIONS.LOCATIONS);
    const q = query(locationsCollection, where('company_id', '==', companyId), where('customer_id', '==', customerId));
    const querySnapshot = await getDocs(q);
    const locations = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        created_at: (docSnap.data().created_at as Timestamp)?.toDate() ?? new Date(),
    } as Location));
    return locations.sort((a,b) => a.name.localeCompare(b.name));
}

/** Fetches available checklist templates */
export async function fetchMaintenanceChecklistTemplates(companyId: string): Promise<Pick<ChecklistTemplate, 'id' | 'name'>[]> {
     if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    const templatesCollection = collection(db, COLLECTIONS.CHECKLIST_TEMPLATES);
    // Fetch templates belonging to the company OR platform templates
    const q = query(
        templatesCollection,
        where('company_id', 'in', [companyId, null]), // Company-specific OR platform (null)
    );
    const querySnapshot = await getDocs(q);
    const templates = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        name: docSnap.data().name as string,
    }));
    // Sort client-side
    return templates.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
}

// --- TODO: Add functions for ScheduledMaintenanceVisit ---
// - fetchScheduledVisits(companyId, contractId?, dateRange?)
// - createScheduledVisit(data) - Usually done by backend function based on contract
// - updateScheduledVisitStatus(visitId, status, workOrderId?)
// - skipScheduledVisit(visitId, reason)
// -------------------------------------------------------
