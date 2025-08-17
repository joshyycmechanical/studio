
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Location } from '@/types/location';
import { z } from 'zod';

const createLocationSchema = z.object({
  name: z.string().min(1, 'Location Name is required'),
  customer_id: z.string().min(1, 'Customer is required'),
  address_line1: z.string().min(1, 'Address Line 1 is required'),
  address_line2: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province/State is required'),
  postal_code: z.string().min(1, 'Postal/Zip Code is required'),
  country: z.string().min(1, 'Country is required'),
  location_type: z.enum(['restaurant', 'warehouse', 'office', 'residential', 'other']),
});


// Helper to convert Timestamps to ISO strings for JSON serialization
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

export async function GET(request: NextRequest) {
    const routePath = `/api/locations GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, error, status } = await verifyUserRole(request, 'locations:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const locationsRef = dbAdmin.collection(COLLECTIONS.LOCATIONS);
        const snapshot = await locationsRef.where('company_id', '==', companyId).get();

        const locations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                created_at: (data.created_at as Timestamp)?.toDate()?.toISOString(),
            };
        });
        
        locations.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json(locations, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching locations for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch locations', detail: err.message }, { status: 500 });
    }
}


// POST a new location
export async function POST(request: NextRequest) {
    const routePath = `/api/locations POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    
    const { authorized, companyId, userId } = await verifyUserRole(request, 'locations:create');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    
    try {
        const body = await request.json();
        const validation = createLocationSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        
        const { customer_id, ...locationData } = validation.data;
        const customerRef = dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc(customer_id);

        const newLocationData: Omit<Location, 'id'> = {
            ...locationData,
            company_id: companyId,
            customer_id: customer_id,
            equipment_count: 0,
            created_at: Timestamp.now(),
        };
        
        const newLocationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc();

        // Use a transaction to ensure both creation and counter update succeed or fail together.
        await dbAdmin.runTransaction(async (transaction) => {
            const customerDoc = await transaction.get(customerRef);
            if (!customerDoc.exists || customerDoc.data()?.company_id !== companyId) {
                throw new Error("Customer not found or access denied.");
            }
            
            // Set the new location
            transaction.set(newLocationRef, newLocationData);
            
            // Increment the location_count on the customer document
            transaction.update(customerRef, { location_count: FieldValue.increment(1) });
        });
        
        const newDoc = await newLocationRef.get();
        return NextResponse.json(convertTimestampsToISO({ id: newDoc.id, ...newDoc.data() }), { status: 201 });
        
    } catch (err: any) {
        console.error(`[${routePath}] Error creating location:`, err);
        return NextResponse.json({ message: 'Failed to create location', detail: err.message }, { status: 500 });
    }
}
