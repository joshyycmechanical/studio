
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Location } from '@/types/location';
import admin from 'firebase-admin';

interface RouteParams {
  params: { locationId: string };
}

// Zod schema for updating a location.
const updateLocationSchema = z.object({
  name: z.string().min(1, 'Location Name is required').optional(),
  address_line1: z.string().min(1, 'Address Line 1 is required').optional(),
  address_line2: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required').optional(),
  province: z.string().min(1, 'Province/State is required').optional(),
  postal_code: z.string().min(1, 'Postal/Zip Code is required').optional(),
  country: z.string().min(1, 'Country is required').optional(),
  location_type: z.enum(['restaurant', 'warehouse', 'office', 'residential', 'other']).optional(),
});


const convertTimestampsToISO = (data: any): any => {
    if (!data) return null;
    const newObj: { [key: string]: any } = {};
    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            newObj[key] = value.toDate().toISOString();
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            newObj[key] = convertTimestampsToISO(value);
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};

// GET a single location by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/locations/${params.locationId} GET`;
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    try {
        const { authorized, companyId } = await verifyUserRole(request, 'locations:view');
        if (!authorized || !companyId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

        const locationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(params.locationId);
        const docSnap = await locationRef.get();
        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Location not found' }, { status: 404 });
        }
        
        return NextResponse.json(convertTimestampsToISO({ id: docSnap.id, ...docSnap.data() }), { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to fetch location', detail: err.message }, { status: 500 });
    }
}

// UPDATE an existing location
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/locations/${params.locationId} PUT`;
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    try {
        const { authorized, companyId, userId } = await verifyUserRole(request, 'locations:edit');
        if (!authorized || !companyId || !userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

        const locationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(params.locationId);
        const docSnap = await locationRef.get();
        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Location not found' }, { status: 404 });
        }
        
        const body = await request.json();
        const validation = updateLocationSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }

        const updateData = { ...validation.data, updated_at: Timestamp.now(), updated_by: userId };
        await locationRef.update(updateData);
        
        const updatedDoc = await locationRef.get();
        return NextResponse.json(convertTimestampsToISO({ id: updatedDoc.id, ...updatedDoc.data() }), { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to update location', detail: err.message }, { status: 500 });
    }
}

// DELETE a location
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/locations/${params.locationId} DELETE`;
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    try {
        const { authorized, companyId } = await verifyUserRole(request, 'locations:delete');
        if (!authorized || !companyId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

        const locationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(params.locationId);
        const docSnap = await locationRef.get();

        if (!docSnap.exists() || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Location not found or access denied' }, { status: 404 });
        }
        
        const locationData = docSnap.data();
        const customerId = locationData?.customer_id;

        // TODO: Add cascading delete logic for associated equipment, work orders etc.
        console.warn(`[${routePath}] Deleting location ${params.locationId}. Associated data (equipment, work orders) is NOT being deleted automatically.`);
        
        await dbAdmin.runTransaction(async (transaction) => {
            // 1. Delete the location document
            transaction.delete(locationRef);
            console.log(`[Transaction] Queued delete for location ${params.locationId}`);

            // 2. If a customer is linked, safely update their location_count
            if (customerId) {
                const customerRef = dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc(customerId);
                try {
                    const customerDoc = await transaction.get(customerRef);
                    if (customerDoc.exists) {
                        const currentCount = customerDoc.data()?.location_count || 0;
                        const newCount = Math.max(0, currentCount - 1);
                        transaction.update(customerRef, { location_count: newCount });
                        console.log(`[Transaction] Queued update for customer ${customerId} location_count to ${newCount}`);
                    } else {
                        console.warn(`[Transaction] Customer ${customerId} not found, skipping location count update.`);
                    }
                } catch(e) {
                    console.error(`[Transaction] Could not read customer ${customerId} to update count. Skipping count update.`, e);
                }
            }
        });
        
        return new NextResponse(null, { status: 204 });

    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to delete location', detail: err.message }, { status: 500 });
    }
}
