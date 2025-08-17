
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Equipment } from '@/types/equipment';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type admin from 'firebase-admin';

// Helper to convert Timestamps to ISO strings for JSON serialization
const convertTimestampsToISO = (data: any): any => {
    if (!data) return null;
    const newObj: { [key: string]: any } = {};
    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            newObj[key] = value.toDate().toISOString();
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            newObj[key] = convertTimestampsToISO(value); // Recurse for nested objects
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};

// GET all equipment for a company, optionally filtered
export async function GET(request: NextRequest) {
    const routePath = `/api/equipment GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, 'equipment:view');
    if (!authResult.authorized || !authResult.companyId) {
        return NextResponse.json({ message: authResult.message || 'Forbidden' }, { status: authResult.status || 403 });
    }
    const { companyId } = authResult;

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');

    try {
        let query: admin.firestore.Query<admin.firestore.DocumentData> = dbAdmin.collection(COLLECTIONS.EQUIPMENT)
            .where('company_id', '==', companyId);

        if (locationId) {
            query = query.where('location_id', '==', locationId);
        }
        
        // Sorting in-memory to avoid needing composite indexes for every combination
        const snapshot = await query.get();

        const equipmentList = snapshot.docs.map(doc => convertTimestampsToISO({ id: doc.id, ...doc.data() }));

        equipmentList.sort((a,b) => a.name.localeCompare(b.name));

        return NextResponse.json(equipmentList, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching equipment for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch equipment', detail: err.message }, { status: 500 });
    }
}


// POST (create) new equipment
export async function POST(request: NextRequest) {
    const routePath = `/api/equipment POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    
    const authResult = await verifyUserRole(request, 'equipment:create');
    if (!authResult.authorized || !authResult.companyId || !authResult.userId) {
        return NextResponse.json({ message: authResult.message || 'Forbidden' }, { status: authResult.status || 403 });
    }
    const { companyId, userId } = authResult;
    
    try {
        const body = await request.json();
        
        // Fetch the location to get the customer_id
        const locationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(body.location_id);
        const locationSnap = await locationRef.get();
        if (!locationSnap.exists || locationSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Location not found or access denied.' }, { status: 404 });
        }
        
        const customerId = locationSnap.data()?.customer_id;
        
        const newEquipmentData: Omit<Equipment, 'id'> = {
            ...body,
            company_id: companyId,
            customer_id: customerId,
            created_at: Timestamp.now(),
            created_by: userId,
            updated_at: Timestamp.now(),
            updated_by: userId,
        };
        
        const equipmentRef = dbAdmin.collection(COLLECTIONS.EQUIPMENT).doc();
        
        // Use a transaction to create the equipment and increment the location's equipment_count
        await dbAdmin.runTransaction(async (transaction) => {
            transaction.set(equipmentRef, newEquipmentData);
            transaction.update(locationRef, { equipment_count: FieldValue.increment(1) });
        });
        
        const newDoc = await equipmentRef.get();
        return NextResponse.json(convertTimestampsToISO({ id: newDoc.id, ...newDoc.data() }), { status: 201 });
        
    } catch (err: any) {
        console.error(`[${routePath}] Error creating equipment:`, err);
        return NextResponse.json({ message: 'Failed to create equipment', detail: err.message }, { status: 500 });
    }
}
