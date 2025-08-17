
'use client'; // Mark as client component

import { auth } from '@/lib/firebase/config';
import type { WorkOrder } from '@/types/work-order';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import type { Invoice } from '@/types/invoice';
import type { UserProfileWithRoles } from '@/types/user';

interface DashboardData {
    workOrders: WorkOrder[];
    customers: Customer[];
    locations: Location[];
    equipment: Equipment[];
    invoices: Invoice[];
    users: Partial<UserProfileWithRoles>[];
}

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
 * Fetches all necessary data for the main dashboard from a single secure API endpoint.
 */
export async function fetchDashboardData(): Promise<DashboardData> {
    if (!auth.currentUser) {
        throw new Error("User not authenticated.");
    }
    console.log("[Dashboard Service] Fetching all dashboard data from API.");

    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/dashboard', {
        headers: {
            'Authorization': `Bearer ${idToken}`,
        },
    });

    const data = await handleApiResponse(response);

    // Convert date strings from JSON back to Date objects
    const parseDates = (item: any) => {
        const newItem = { ...item };
        const dateKeys = ['created_at', 'updated_at', 'last_login', 'scheduled_date', 'completed_date', 'issue_date', 'due_date', 'sent_at', 'last_payment_date', 'installation_date', 'last_service_date', 'next_service_due_date', 'reported_at', 'resolved_at', 'repair_date', 'start_date', 'end_date', 'valid_until', 'clock_in_time', 'clock_out_time'];
        for (const key of dateKeys) {
            if (newItem[key] && typeof newItem[key] === 'string') {
                newItem[key] = new Date(newItem[key]);
            }
        }
        return newItem;
    };
    
    return {
        workOrders: data.workOrders.map(parseDates),
        customers: data.customers.map(parseDates),
        locations: data.locations.map(parseDates),
        equipment: data.equipment.map(parseDates),
        invoices: data.invoices.map(parseDates),
        users: data.users.map(parseDates),
    };
}
