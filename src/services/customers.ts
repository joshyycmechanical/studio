
'use client';

import { auth, db } from '@/lib/firebase/config';
import {
    collection, doc, serverTimestamp, writeBatch, query, where, getDocs, addDoc, deleteDoc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Contact } from '@/types/contact';

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

        const errorMessage = (typeof errorData === 'object' && errorData !== null && (errorData as any).message)
            ? (errorData as any).message
            : JSON.stringify(errorData);

        throw new Error(errorMessage || `An unknown API error occurred. Status: ${response.status}`);
    }
    if (response.status === 204) return null; // Handle No Content for DELETE/PUT
    return response.json();
}

/**
 * Fetches all customers for the current user's company via the API.
 * This is the primary function for client components.
 */
export async function fetchCompanyCustomers(companyId: string): Promise<Customer[]> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId) return [];
    
    console.log(`[Service] Fetching customers for company ${companyId} from API.`);
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/customers', {
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });

    const customers = await handleApiResponse(response);
    
    // Convert date strings from JSON back to Date objects
    return customers.map((c: any) => ({
        ...c,
        created_at: new Date(c.created_at),
    }));
}

/**
 * Fetches a single customer by ID via the API.
 */
export async function fetchCustomerById(companyId: string, customerId: string): Promise<Customer | null> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    if (!companyId || !customerId) return null;
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/customers/${customerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    
    if (response.status === 404) return null;
    
    const customer = await handleApiResponse(response);
    return {
        ...customer,
        created_at: new Date(customer.created_at),
    };
}

/**
 * Creates a new customer with associated contacts.
 */
export async function createCustomerWithContacts(
  customerData: Omit<Customer, 'id' | 'created_at'>,
  contacts: Omit<Contact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>[]
): Promise<{ customer: Customer; location: Location | null }> {
    if (!auth.currentUser) throw new Error("User not authenticated.");

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/customers/with-location', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            customerData,
            locationData: { // This structure is expected by the API
                name: `${customerData.name} - Primary`,
                address_line1: customerData.billing_address_line1 || 'N/A',
                city: customerData.billing_city || 'N/A',
                province: customerData.billing_province || 'N/A',
                postal_code: customerData.billing_postal_code || 'N/A',
                country: customerData.billing_country || 'USA',
            },
            contacts,
        }),
    });
    return handleApiResponse(response);
}

/**
 * Creates a new customer.
 */
export async function createCustomer(customerData: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'updated_by'>): Promise<Customer> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
    });
    return handleApiResponse(response);
}


/**
 * Updates an existing customer.
 */
export async function updateCustomer(companyId: string, customerId: string, data: Partial<Omit<Customer, 'id' | 'company_id'>>): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    await handleApiResponse(response);
}

/**
 * Deletes a customer.
 */
export async function deleteCustomer(companyId: string, customerId: string): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });
    await handleApiResponse(response);
}
