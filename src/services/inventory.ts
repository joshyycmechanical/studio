
'use client';

import { auth, db } from '@/lib/firebase/config';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { InventoryItem } from '@/types/inventory';

// --- Firestore Service Functions for Inventory ---

// Helper to convert Firestore data to InventoryItem type
const mapDocToInventoryItem = (docSnap: import('firebase/firestore').DocumentSnapshot): InventoryItem => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        company_id: data.company_id,
        name: data.name,
        part_number: data.part_number ?? null,
        description: data.description ?? null,
        category: data.category ?? null,
        quantity_on_hand: data.quantity_on_hand ?? 0,
        unit_cost: data.unit_cost ?? null,
        unit_price: data.unit_price ?? null,
        reorder_point: data.reorder_point ?? null,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
    } as InventoryItem;
};

/**
 * Fetches all inventory items for a specific company.
 * @param companyId The ID of the company whose items to fetch.
 * @returns A promise that resolves to an array of InventoryItem objects.
 */
export async function fetchCompanyInventory(companyId: string): Promise<InventoryItem[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching inventory for company: ${companyId}`);
    const itemsCollection = collection(db, COLLECTIONS.INVENTORY);
    const q = query(itemsCollection, where('company_id', '==', companyId));
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(mapDocToInventoryItem);
    // Sort client-side
    return items.sort((a,b) => a.name.localeCompare(b.name));
}

/**
 * Creates a new inventory item document in Firestore.
 * @param companyId The ID of the company.
 * @param data The data for the new item.
 * @returns A promise that resolves to the newly created InventoryItem object.
 */
export async function createInventoryItem(companyId: string, data: Omit<InventoryItem, 'id' | 'company_id' | 'created_at' | 'updated_at'>): Promise<InventoryItem> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    console.log(`[Firestore Service] Creating inventory item "${data.name}" for company: ${companyId}`);
    
    const itemsCollection = collection(db, COLLECTIONS.INVENTORY);
    const newItemData = {
        ...data,
        company_id: companyId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };
    
    const docRef = await addDoc(itemsCollection, newItemData);
    const newDocSnap = await getDoc(docRef);
    return mapDocToInventoryItem(newDocSnap);
}


/**
 * Updates an existing inventory item document in Firestore.
 */
export async function updateInventoryItem(companyId: string, itemId: string, data: Partial<Omit<InventoryItem, 'id' | 'company_id' | 'created_at'>>): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !itemId) throw new Error("Company ID and Item ID are required.");
    console.log(`[Firestore Service] Updating inventory item ${itemId} for company: ${companyId}`);
    const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
    const currentDoc = await getDoc(itemRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Inventory item not found or access denied.");
    }
    await updateDoc(itemRef, { ...data, updated_at: serverTimestamp() });
}

/**
 * Deletes an inventory item document from Firestore.
 */
export async function deleteInventoryItem(companyId: string, itemId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !itemId) throw new Error("Company ID and Item ID are required.");
    console.log(`[Firestore Service] Deleting inventory item ${itemId} for company: ${companyId}`);
    const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
    const currentDoc = await getDoc(itemRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Inventory item not found or access denied.");
    }
    // TODO: Add check if item is used in any open work orders, etc.
    await deleteDoc(itemRef);
}
