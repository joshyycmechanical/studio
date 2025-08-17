
'use client'; // Mark as client component

import { db } from '@/lib/firebase/config';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { CustomField, FieldTemplate, CustomFieldEntityType } from '@/types/custom-field';

// --- Custom Field Helpers ---
const mapDocToCustomField = (docSnap: import('firebase/firestore').DocumentSnapshot): CustomField => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        company_id: data.company_id,
        entity_type: data.entity_type,
        name: data.name,
        label: data.label ?? data.name, // Use label or fallback to name
        field_type: data.field_type,
        is_required: data.is_required,
        sort_order: data.sort_order,
        options: data.options ?? undefined,
        placeholder: data.placeholder ?? null,
        description: data.description ?? null,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
    };
};

// --- Field Template Helpers ---
const mapDocToFieldTemplate = (docSnap: import('firebase/firestore').DocumentSnapshot): FieldTemplate => {
    const data = docSnap.data();
    if (!data) throw new Error(`Document data not found for doc ID: ${docSnap.id}`);
    return {
        id: docSnap.id,
        company_id: data.company_id,
        entity_type: data.entity_type,
        name: data.name,
        description: data.description ?? null,
        custom_field_ids: data.custom_field_ids || [],
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
        is_platform_template: data.is_platform_template ?? false,
    };
};

// --- Custom Field Service Functions ---

/**
 * Fetches all custom fields for a specific company and optionally by entity type.
 */
export async function fetchCompanyCustomFields(companyId: string, entityType?: CustomFieldEntityType): Promise<CustomField[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching custom fields for company: ${companyId}${entityType ? `, entity: ${entityType}` : ''}`);
    const fieldsCollection = collection(db, COLLECTIONS.CUSTOM_FIELDS);
    const constraints: any[] = [
        where('company_id', '==', companyId),
    ];
    if (entityType && entityType !== 'all') { // Added 'all' check
        constraints.push(where('entity_type', '==', entityType));
    }
    const q = query(fieldsCollection, ...constraints);
    const querySnapshot = await getDocs(q);
    const fields = querySnapshot.docs.map(mapDocToCustomField);
    // Sort client-side to avoid needing composite index
    return fields.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * Creates a new custom field document.
 */
export async function createCustomField(companyId: string, data: Omit<CustomField, 'id' | 'company_id' | 'created_at' | 'updated_at'>): Promise<CustomField> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    // TODO: Add check for duplicate programmatic name within entity_type + company_id
    console.log(`[Firestore Service] Creating custom field "${data.name}" for company: ${companyId}`);
    const fieldsCollection = collection(db, COLLECTIONS.CUSTOM_FIELDS);
    const newFieldData = {
        ...data,
        company_id: companyId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };
    const docRef = await addDoc(fieldsCollection, newFieldData);
    const newDocSnap = await getDoc(docRef);
    return mapDocToCustomField(newDocSnap);
}

/**
 * Updates an existing custom field document.
 */
export async function updateCustomField(companyId: string, fieldId: string, data: Partial<Omit<CustomField, 'id' | 'company_id' | 'created_at' | 'name' | 'entity_type'>>): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !fieldId) throw new Error("Company ID and Field ID are required.");
    console.log(`[Firestore Service] Updating custom field ${fieldId} for company: ${companyId}`);
    const fieldRef = doc(db, COLLECTIONS.CUSTOM_FIELDS, fieldId);
    // Verify ownership
    const currentDoc = await getDoc(fieldRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Custom field not found or access denied.");
    }
    // Cannot update name or entity_type after creation via this function
    delete (data as any).name;
    delete (data as any).entity_type;

    await updateDoc(fieldRef, { ...data, updated_at: serverTimestamp() });
}

/**
 * Deletes a custom field document.
 */
export async function deleteCustomField(companyId: string, fieldId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !fieldId) throw new Error("Company ID and Field ID are required.");
    console.log(`[Firestore Service] Deleting custom field ${fieldId} for company: ${companyId}`);
    const fieldRef = doc(db, COLLECTIONS.CUSTOM_FIELDS, fieldId);
    // Verify ownership
    const currentDoc = await getDoc(fieldRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Custom field not found or access denied.");
    }
    // TODO: Check if field is used in any Field Templates? Handle implications.
    // TODO: Consider if deleting the field should remove values from entity documents (likely requires Cloud Function).
    await deleteDoc(fieldRef);
}

/**
 * Batch updates the sort order for multiple custom fields.
 * @param companyId The ID of the company.
 * @param fieldsToUpdate An array of objects with field ID and new sort_order.
 */
export async function updateCustomFieldsOrder(companyId: string, fieldsToUpdate: Pick<CustomField, 'id' | 'sort_order'>[]): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    if (fieldsToUpdate.length === 0) return;
    console.log(`[Firestore Service] Batch updating sort order for ${fieldsToUpdate.length} fields in company: ${companyId}`);

    const batch = writeBatch(db);

    fieldsToUpdate.forEach(field => {
        const fieldRef = doc(db, COLLECTIONS.CUSTOM_FIELDS, field.id);
        // Note: This client-side batch write assumes the calling component has already
        // verified the user has permission to edit these fields.
        batch.update(fieldRef, { sort_order: field.sort_order });
    });

    await batch.commit();
}


// --- Field Template Service Functions ---

/**
 * Fetches all field templates for a specific company.
 */
export async function fetchCompanyFieldTemplates(companyId: string): Promise<FieldTemplate[]> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) return [];
    console.log(`[Firestore Service] Fetching field templates for company: ${companyId}`);
    const templatesCollection = collection(db, COLLECTIONS.FIELD_TEMPLATES);
    const q = query(
        templatesCollection,
        where('company_id', '==', companyId),
        where('is_platform_template', '==', false)
    );
    const querySnapshot = await getDocs(q);
    const templates = querySnapshot.docs.map(mapDocToFieldTemplate);
    // Sort client-side
    return templates.sort((a,b) => a.name.localeCompare(b.name));
}

/**
 * Creates a new field template document.
 */
export async function createFieldTemplate(companyId: string, data: Omit<FieldTemplate, 'id' | 'company_id' | 'created_at' | 'is_platform_template'>): Promise<FieldTemplate> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId) throw new Error("Company ID is required.");
    console.log(`[Firestore Service] Creating field template "${data.name}" for company: ${companyId}`);
    const templatesCollection = collection(db, COLLECTIONS.FIELD_TEMPLATES);
    const newTemplateData = {
        ...data,
        company_id: companyId,
        created_at: serverTimestamp(),
        is_platform_template: false,
    };
    const docRef = await addDoc(templatesCollection, newTemplateData);
    const newDocSnap = await getDoc(docRef);
    return mapDocToFieldTemplate(newDocSnap);
}

/**
 * Updates an existing field template document.
 */
export async function updateFieldTemplate(companyId: string, templateId: string, data: Partial<Omit<FieldTemplate, 'id' | 'company_id' | 'created_at' | 'is_platform_template'>>): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !templateId) throw new Error("Company ID and Template ID are required.");
    console.log(`[Firestore Service] Updating field template ${templateId} for company: ${companyId}`);
    const templateRef = doc(db, COLLECTIONS.FIELD_TEMPLATES, templateId);
    // Verify ownership
    const currentDoc = await getDoc(templateRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Field template not found or access denied.");
    }

    await updateDoc(templateRef, { ...data /* Add updated_at if needed */ });
}

/**
 * Deletes a field template document.
 */
export async function deleteFieldTemplate(companyId: string, templateId: string): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    if (!companyId || !templateId) throw new Error("Company ID and Template ID are required.");
    console.log(`[Firestore Service] Deleting field template ${templateId} for company: ${companyId}`);
    const templateRef = doc(db, COLLECTIONS.FIELD_TEMPLATES, templateId);
    // Verify ownership
    const currentDoc = await getDoc(templateRef);
    if (!currentDoc.exists() || currentDoc.data().company_id !== companyId) {
        throw new Error("Field template not found or access denied.");
    }
    // TODO: Check if template is currently applied anywhere?
    await deleteDoc(templateRef);
}
