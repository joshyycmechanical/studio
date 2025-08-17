
'use client'; // Mark as client component because it uses the client SDK

import { db } from '@/lib/firebase/config'; // Import client Firestore instance
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Invoice } from '@/types/invoice';

// --- Firestore Service Functions for Invoices ---

// Helper to convert Firestore data to Invoice type
const mapDocToInvoice = (docSnap: import('firebase/firestore').DocumentSnapshot): Invoice => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        company_id: data.company_id,
        customer_id: data.customer_id,
        location_id: data.location_id ?? null,
        invoice_number: data.invoice_number,
        status: data.status,
        issue_date: (data.issue_date as Timestamp)?.toDate() ?? new Date(),
        due_date: (data.due_date as Timestamp)?.toDate() ?? new Date(),
        line_items: data.line_items ?? [], // Assuming line_items are stored as an array
        subtotal: data.subtotal,
        tax_amount: data.tax_amount ?? null,
        discount_amount: data.discount_amount ?? null,
        total_amount: data.total_amount,
        amount_paid: data.amount_paid ?? 0, // Default to 0 if missing
        amount_due: data.amount_due, // Should be calculated based on total and paid
        payment_terms: data.payment_terms ?? null,
        notes: data.notes ?? null,
        related_work_order_ids: data.related_work_order_ids ?? [],
        related_estimate_id: data.related_estimate_id ?? null,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        created_by: data.created_by,
        updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
        updated_by: data.updated_by ?? null,
        sent_at: (data.sent_at as Timestamp)?.toDate() ?? null,
        last_payment_date: (data.last_payment_date as Timestamp)?.toDate() ?? null,
        // pdf_url: data.pdf_url ?? null,
    };
};

/**
 * Fetches all invoices belonging to a specific company.
 * @param companyId The ID of the company whose invoices to fetch.
 * @returns A promise that resolves to an array of Invoice objects.
 */
export async function fetchCompanyInvoices(companyId: string): Promise<Invoice[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching invoices for company: ${companyId}`);
    const invoicesCollection = collection(db, COLLECTIONS.INVOICES);
    const q = query(invoicesCollection, where('company_id', '==', companyId));
    const querySnapshot = await getDocs(q);
    const invoices = querySnapshot.docs.map(mapDocToInvoice);
    // Sort client-side
    return invoices.sort((a,b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime());
}

/**
 * Fetches a single invoice by its ID, ensuring it belongs to the specified company.
 * @param companyId The ID of the company the invoice should belong to.
 * @param invoiceId The ID of the invoice to fetch.
 * @returns A promise that resolves to the Invoice object or null if not found or doesn't belong to the company.
 */
export async function fetchInvoiceById(companyId: string, invoiceId: string): Promise<Invoice | null> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !invoiceId) return null;
    console.log(`[Firestore Service] Fetching invoice ${invoiceId} for company ${companyId}`);
    const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
    const docSnap = await getDoc(invoiceRef);

    if (!docSnap.exists()) {
        console.warn(`[Firestore Service] Invoice ${invoiceId} not found.`);
        return null;
    }
    const data = docSnap.data();
    if (data.company_id !== companyId) {
         console.error(`[Firestore Service] Security violation: Attempted to fetch invoice ${invoiceId} belonging to company ${data.company_id} from context of company ${companyId}`);
         return null;
    }
    return mapDocToInvoice(docSnap);
}

/**
 * Creates a new invoice document in Firestore.
 * @param companyId The ID of the company creating the invoice.
 * @param userId The ID of the user creating the invoice.
 * @param data The data for the new invoice (excluding id, company_id, created_at, created_by, invoice_number, amount_due).
 * @returns A promise that resolves to the newly created Invoice object.
 */
export async function createInvoice(companyId: string, userId: string, data: Omit<Invoice, 'id' | 'company_id' | 'created_at' | 'created_by' | 'invoice_number' | 'amount_due'>): Promise<Invoice> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !userId) throw new Error("Company ID and User ID are required.");
    console.log(`[Firestore Service] Creating invoice for company: ${companyId} by user ${userId}`);

    // TODO: Implement robust invoice number generation
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    console.warn(`[Firestore Service] Using basic placeholder invoice number: ${invoiceNumber}`);

    const invoicesCollection = collection(db, COLLECTIONS.INVOICES);
    const newInvoiceData = {
        ...data,
        company_id: companyId,
        created_by: userId,
        created_at: serverTimestamp(),
        invoice_number: invoiceNumber,
        amount_paid: data.amount_paid ?? 0, // Ensure amount_paid defaults to 0
        amount_due: data.total_amount - (data.amount_paid ?? 0), // Calculate initial amount_due
        // Convert Dates back to Timestamps if provided
        issue_date: data.issue_date instanceof Date ? Timestamp.fromDate(data.issue_date) : data.issue_date,
        due_date: data.due_date instanceof Date ? Timestamp.fromDate(data.due_date) : data.due_date,
        sent_at: data.sent_at instanceof Date ? Timestamp.fromDate(data.sent_at) : data.sent_at,
        last_payment_date: data.last_payment_date instanceof Date ? Timestamp.fromDate(data.last_payment_date) : data.last_payment_date,
    };

    const docRef = await addDoc(invoicesCollection, newInvoiceData);
    console.log("[Firestore Service] New Invoice Added:", docRef.id);
    const newDocSnap = await getDoc(docRef);
    return mapDocToInvoice(newDocSnap);
}

/**
 * Updates an existing invoice document in Firestore.
 * @param companyId The company the invoice belongs to (for verification).
 * @param invoiceId The ID of the invoice to update.
 * @param data The partial data containing fields to update.
 * @param userId The ID of the user performing the update.
 * @returns A promise that resolves when the update is complete.
 */
export async function updateInvoice(companyId: string, invoiceId: string, data: Partial<Omit<Invoice, 'id' | 'company_id' | 'created_at' | 'created_by' | 'invoice_number'>>, userId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !invoiceId || !userId) throw new Error("Company ID, Invoice ID, and User ID are required.");
    console.log(`[Firestore Service] Updating invoice ${invoiceId} for company ${companyId} by user ${userId}`);

    const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
    const currentDoc = await getDoc(invoiceRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Invoice not found or access denied.");
    }
    const currentData = currentDoc.data();

    const updateData: { [key: string]: any } = {
        ...data,
        updated_at: serverTimestamp(),
        updated_by: userId,
    };

     // Convert Dates back to Timestamps if provided
     if (data.issue_date !== undefined) updateData.issue_date = data.issue_date instanceof Date ? Timestamp.fromDate(data.issue_date) : data.issue_date;
     if (data.due_date !== undefined) updateData.due_date = data.due_date instanceof Date ? Timestamp.fromDate(data.due_date) : data.due_date;
     if (data.sent_at !== undefined) updateData.sent_at = data.sent_at instanceof Date ? Timestamp.fromDate(data.sent_at) : data.sent_at;
     if (data.last_payment_date !== undefined) updateData.last_payment_date = data.last_payment_date instanceof Date ? Timestamp.fromDate(data.last_payment_date) : data.last_payment_date;

     // Recalculate amount_due if total_amount or amount_paid changes
     const newTotal = data.total_amount ?? currentData.total_amount;
     const newPaid = data.amount_paid ?? currentData.amount_paid;
     if (data.total_amount !== undefined || data.amount_paid !== undefined) {
        updateData.amount_due = newTotal - newPaid;
     }

     // Remove fields that shouldn't be updated directly
     delete updateData.id;
     delete updateData.company_id;
     delete updateData.created_at;
     delete updateData.created_by;
     delete updateData.invoice_number;

    await updateDoc(invoiceRef, updateData);
    console.log("[Firestore Service] Invoice Updated:", invoiceId);
}

/**
 * Deletes an invoice document from Firestore. (Consider soft delete/voiding instead)
 * @param companyId The company the invoice belongs to (for verification).
 * @param invoiceId The ID of the invoice to delete.
 * @returns A promise that resolves when the deletion is complete.
 */
export async function deleteInvoice(companyId: string, invoiceId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !invoiceId) throw new Error("Company ID and Invoice ID are required.");
    console.log(`[Firestore Service] Deleting invoice ${invoiceId} for company ${companyId}`);

    const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
    const currentDoc = await getDoc(invoiceRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Invoice not found or access denied.");
    }

    // IMPORTANT: Deleting invoices is often not recommended due to accounting practices.
    // Consider updating the status to 'void' instead.
    // If deletion is required, ensure related records (payments, etc.) are handled.
    // Example of voiding instead:
    // await updateInvoice(companyId, invoiceId, { status: 'void', amount_due: 0 }, userId);

    await deleteDoc(invoiceRef); // Hard delete
    console.log(`[Firestore Service] Invoice ${invoiceId} deleted.`);
}

/**
 * Updates the status of an invoice (e.g., to 'sent', 'paid', 'void').
 * @param companyId The company the invoice belongs to (for verification).
 * @param invoiceId The ID of the invoice to update.
 * @param status The new status.
 * @param userId The ID of the user performing the status update.
 * @returns A promise that resolves when the update is complete.
 */
export async function updateInvoiceStatus(companyId: string, invoiceId: string, status: Invoice['status'], userId: string): Promise<void> {
     if (!db) throw new Error("Firestore not initialized.");
     if (!companyId || !invoiceId || !userId) throw new Error("Company ID, Invoice ID, and User ID are required.");
     console.log(`[Firestore Service] Updating invoice ${invoiceId} status to ${status} by user ${userId}`);

     const updateData: Partial<Invoice> = { status };
     if (status === 'void') {
         updateData.amount_due = 0; // Zero out amount due when voiding
     }
     // Add other status-specific logic if needed (e.g., setting sent_at)
     if (status === 'sent') {
         updateData.sent_at = serverTimestamp();
     }

     await updateInvoice(companyId, invoiceId, updateData, userId);
}

// --- TODO: Add functions for Payments ---
// - recordInvoicePayment(companyId, invoiceId, paymentAmount, paymentDate, paymentMethod, userId)
// - fetchInvoicePayments(companyId, invoiceId)
// ----------------------------------------
