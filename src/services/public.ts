
'use client';

import type { Equipment } from '@/types/equipment';

/**
 * Fetches the publicly accessible details for a single piece of equipment.
 * @param equipmentId The ID of the equipment to fetch.
 * @returns A promise that resolves to the equipment data or null if not found.
 */
export async function fetchPublicEquipmentDetails(equipmentId: string): Promise<Equipment | null> {
    const response = await fetch(`/api/public/equipment/${equipmentId}`);
    if (!response.ok) {
        if (response.status === 404) return null;
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch equipment details.');
    }
    return response.json();
}

/**
 * Submits a new service request from a public form.
 * @param equipmentId The ID of the equipment requiring service.
 * @param requestData The customer's contact info and problem description.
 */
export async function submitServiceRequest(equipmentId: string, requestData: {
    description: string;
    contact_name: string;
    contact_phone: string;
    contact_email?: string;
}): Promise<{ work_order_number: string }> {
    const response = await fetch('/api/public/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestData, equipmentId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to submit service request.');
    }
    return response.json();
}
