
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

interface RouteParams {
  params: { equipmentId: string };
}

// Zod schema for updating equipment
const updateEquipmentSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  status: z.enum(['operational', 'needs-repair', 'decommissioned']).optional(),
  asset_tag: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model_number: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  installation_date: z.date().optional().nullable(),
  last_service_date: z.date().optional().nullable(),
  next_service_due_date: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Location/Customer are not typically updated directly on equipment
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
            newObj[key] = convertTimestampsToISO(value); // Recurse for nested objects
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};

// Helper to check ownership
async function verifyOwnership(companyId: string, equipmentId: string) {
    const equipmentRef = dbAdmin.collection(COLLECTIONS.EQUIPMENT).doc(equipmentId);
    const docSnap = await equipmentRef.get();
    if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
        throw new Error("Equipment not found or access denied.");
    }
    return equipmentRef;
}

// GET a single piece of equipment by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/equipment/${params.equipmentId} GET`;
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    try {
        const { authorized, companyId } = await verifyUserRole(request, 'equipment:view');
        if (!authorized || !companyId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

        const equipmentRef = await verifyOwnership(companyId, params.equipmentId);
        const docSnap = await equipmentRef.get();

        return NextResponse.json(convertTimestampsToISO({ id: docSnap.id, ...docSnap.data() }), { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to fetch equipment', detail: err.message }, { status: 500 });
    }
}

// UPDATE an existing piece of equipment
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/equipment/${params.equipmentId} PUT`;
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    try {
        const { authorized, companyId, userId } = await verifyUserRole(request, 'equipment:edit');
        if (!authorized || !companyId || !userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

        const equipmentRef = await verifyOwnership(companyId, params.equipmentId);
        
        const body = await request.json();
        const validation = updateEquipmentSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }

        const updateData: { [key: string]: any } = { ...validation.data, updated_at: Timestamp.now(), updated_by: userId };
        
        // Convert date fields back to Timestamps
        if (updateData.installation_date) updateData.installation_date = Timestamp.fromDate(new Date(updateData.installation_date));
        if (updateData.last_service_date) updateData.last_service_date = Timestamp.fromDate(new Date(updateData.last_service_date));
        if (updateData.next_service_due_date) updateData.next_service_due_date = Timestamp.fromDate(new Date(updateData.next_service_due_date));

        await equipmentRef.update(updateData);
        
        return NextResponse.json({ message: 'Equipment updated successfully' }, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to update equipment', detail: err.message }, { status: 500 });
    }
}

// DELETE a piece of equipment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/equipment/${params.equipmentId} DELETE`;
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    try {
        const { authorized, companyId } = await verifyUserRole(request, 'equipment:delete');
        if (!authorized || !companyId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

        const equipmentRef = await verifyOwnership(companyId, params.equipmentId);
        const equipmentDoc = await equipmentRef.get();
        const locationId = equipmentDoc.data()?.location_id;

        const batch = dbAdmin.batch();
        batch.delete(equipmentRef);

        if (locationId) {
            const locationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(locationId);
            batch.update(locationRef, { equipment_count: FieldValue.increment(-1) });
        }

        await batch.commit();
        
        return new NextResponse(null, { status: 204 });
    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to delete equipment', detail: err.message }, { status: 500 });
    }
}
