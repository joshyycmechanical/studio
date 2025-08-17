
'use client'; 

import { db } from '@/lib/firebase/config';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { TimeEntry, TimeEntryStatus } from '@/types/time-entry';
import type { UserProfile } from '@/types/user'; 

// --- Firestore Service Functions for Time Entries ---

// Helper to convert Firestore data to TimeEntry type
const mapDocToTimeEntry = (docSnap: import('firebase/firestore').DocumentSnapshot): TimeEntry => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    
    // Calculate duration in minutes if not stored
    let durationMinutes = data.duration_minutes ?? 0;
    if (!durationMinutes && data.clock_in_time && data.clock_out_time) {
        const start = (data.clock_in_time as Timestamp).toMillis();
        const end = (data.clock_out_time as Timestamp).toMillis();
        durationMinutes = Math.round((end - start) / 60000);
    }
    
    return {
        id: docSnap.id,
        company_id: data.company_id,
        user_id: data.user_id,
        work_order_id: data.work_order_id ?? null,
        clock_in_time: (data.clock_in_time as Timestamp)?.toDate() ?? new Date(),
        clock_out_time: (data.clock_out_time as Timestamp)?.toDate() ?? null,
        duration_minutes: durationMinutes,
        status: data.status,
        notes: data.notes ?? null,
        clock_in_location: data.clock_in_location ?? null,
        clock_out_location: data.clock_out_location ?? null,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
    };
};

/**
 * Fetches all time entries belonging to a specific company.
 * Optionally filter by user ID and date range.
 * @param companyId The ID of the company whose time entries to fetch.
 * @param userId Optional: Filter by a specific user ID.
 * @param startDate Optional: Filter entries starting from this date.
 * @param endDate Optional: Filter entries up to this date.
 * @returns A promise that resolves to an array of TimeEntry objects.
 */
export async function fetchCompanyTimeEntries(
    companyId: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<TimeEntry[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching time entries for company: ${companyId}${userId ? `, user: ${userId}` : ''}${startDate ? `, from: ${startDate}` : ''}${endDate ? `, to: ${endDate}` : ''}`);

    const timeEntriesCollection = collection(db, COLLECTIONS.TIME_ENTRIES);
    const queryConstraints: any[] = [ 
        where('company_id', '==', companyId),
    ];

    if (userId) {
        queryConstraints.push(where('user_id', '==', userId));
    }
    if (startDate) {
        queryConstraints.push(where('clock_in_time', '>=', Timestamp.fromDate(startDate)));
    }
    if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        queryConstraints.push(where('clock_in_time', '<=', Timestamp.fromDate(endOfDay)));
    }

    const q = query(timeEntriesCollection, ...queryConstraints);
    const querySnapshot = await getDocs(q);
    const entries = querySnapshot.docs.map(mapDocToTimeEntry);
    
    return entries.sort((a,b) => new Date(b.clock_in_time).getTime() - new Date(a.clock_in_time).getTime());
}

/**
 * Fetches all time entries associated with a specific work order.
 * @param companyId The ID of the company.
 * @param workOrderId The ID of the work order.
 * @returns A promise that resolves to an array of TimeEntry objects.
 */
export async function fetchTimeEntriesByWorkOrderId(companyId: string, workOrderId: string): Promise<TimeEntry[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !workOrderId) return [];

    const timeEntriesCollection = collection(db, COLLECTIONS.TIME_ENTRIES);
    const q = query(
        timeEntriesCollection,
        where('company_id', '==', companyId),
        where('work_order_id', '==', workOrderId)
    );
    
    const querySnapshot = await getDocs(q);
    const entries = querySnapshot.docs.map(mapDocToTimeEntry);
    return entries.sort((a, b) => new Date(a.clock_in_time).getTime() - new Date(b.clock_in_time).getTime());
}


/**
 * Fetches a single time entry by its ID, ensuring it belongs to the specified company.
 * @param companyId The ID of the company the time entry should belong to.
 * @param entryId The ID of the time entry to fetch.
 * @returns A promise that resolves to the TimeEntry object or null if not found or doesn't belong to the company.
 */
export async function fetchTimeEntryById(companyId: string, entryId: string): Promise<TimeEntry | null> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !entryId) return null;
    console.log(`[Firestore Service] Fetching time entry ${entryId} for company ${companyId}`);
    const entryRef = doc(db, COLLECTIONS.TIME_ENTRIES, entryId);
    const docSnap = await getDoc(entryRef);

    if (!docSnap.exists()) {
        console.warn(`[Firestore Service] Time entry ${entryId} not found.`);
        return null;
    }
    const data = docSnap.data();
    if (data.company_id !== companyId) {
         console.error(`[Firestore Service] Security violation: Attempted to fetch time entry ${entryId} belonging to company ${data.company_id} from context of company ${companyId}`);
         return null;
    }
    return mapDocToTimeEntry(docSnap);
}


/**
 * Updates the status of a time entry document in Firestore.
 * @param companyId The company the time entry belongs to (for verification).
 * @param entryId The ID of the time entry to update.
 * @param status The new status ('approved' or 'rejected').
 * @param approverUserId The ID of the user approving/rejecting.
 * @returns A promise that resolves when the update is complete.
 */
export async function updateTimeEntryStatus(companyId: string, entryId: string, status: 'approved' | 'rejected', approverUserId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !entryId || !approverUserId) throw new Error("Company ID, Entry ID, and Approver User ID are required.");
    console.log(`[Firestore Service] Updating time entry ${entryId} status to ${status} for company ${companyId} by user ${approverUserId}`);

    const entryRef = doc(db, COLLECTIONS.TIME_ENTRIES, entryId);

    const currentDoc = await getDoc(entryRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Time entry not found or access denied.");
    }
     if (currentDoc.data().status !== 'pending_approval') {
        console.warn(`[Firestore Service] Attempted to change status of entry ${entryId} which is not 'pending_approval' (current: ${currentDoc.data().status})`);
        return; 
    }

    const updateData = {
        status: status,
        updated_at: serverTimestamp(),
    };

    await updateDoc(entryRef, updateData);
    console.log(`[Firestore Service] Time entry ${entryId} status updated to ${status}.`);
}

/**
 * Deletes a time entry document from Firestore.
 * @param companyId The company the time entry belongs to (for verification).
 * @param entryId The ID of the time entry to delete.
 * @returns A promise that resolves when the deletion is complete.
 */
export async function deleteTimeEntry(companyId: string, entryId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !entryId) throw new Error("Company ID and Entry ID are required.");
    console.log(`[Firestore Service] Deleting time entry ${entryId} for company ${companyId}`);

    const entryRef = doc(db, COLLECTIONS.TIME_ENTRIES, entryId);

    const currentDoc = await getDoc(entryRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Time entry not found or access denied.");
    }

    await deleteDoc(entryRef);
    console.log(`[Firestore Service] Time entry ${entryId} deleted.`);
}

export { fetchCompanyUsers } from './users';
