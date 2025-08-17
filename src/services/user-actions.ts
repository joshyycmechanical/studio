
'use client';

import { auth } from '@/lib/firebase/config';
import type { ActiveTimer } from '@/types/user';

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
 * Clocks in the current user for a specific work order.
 * @param workOrderId The ID of the work order to clock in for.
 * @returns The new active timer object.
 */
export async function clockIn(workOrderId: string): Promise<ActiveTimer> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch('/api/users/me/clock-in', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ work_order_id: workOrderId }),
    });
    
    const activeTimer = await handleApiResponse(response);
    return {
        ...activeTimer,
        start_time: new Date(activeTimer.start_time),
    };
}

/**
 * Clocks out the current user.
 * @param notes Optional notes for the time entry.
 */
export async function clockOut(notes?: string): Promise<void> {
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch('/api/users/me/clock-out', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
    });
    
    await handleApiResponse(response);
}
