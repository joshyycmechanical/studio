
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// Define schema for updates. All fields are optional.
const updateDeficiencySchema = z.object({
  description: z.string().min(1).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in-progress', 'resolved', 'cancelled']).optional(),
  resolution_notes: z.string().optional().nullable(),
  custom_fields: z.record(z.any()).optional().nullable(), // For custom fields
});

// GET a single deficiency by ID
export async function GET(request: NextRequest, { params }: { params: { deficiencyId: string } }) {
    const routePath = `/api/deficiencies/${params.deficiencyId} GET`;

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId } = await verifyUserRole(request, 'deficiencies:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const { deficiencyId } = params;
        const deficiencyRef = dbAdmin.collection(COLLECTIONS.DEFICIENCIES).doc(deficiencyId);
        const docSnap = await deficiencyRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Deficiency not found' }, { status: 404 });
        }
        
        const data = docSnap.data();
        // Convert timestamps for client
        if (data?.created_at instanceof Timestamp) data.created_at = data.created_at.toDate().toISOString();
        if (data?.reported_at instanceof Timestamp) data.reported_at = data.reported_at.toDate().toISOString();
        if (data?.resolved_at instanceof Timestamp) data.resolved_at = data.resolved_at.toDate().toISOString();
        if (data?.updated_at instanceof Timestamp) data.updated_at = data.updated_at.toDate().toISOString();

        return NextResponse.json({ id: docSnap.id, ...data }, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching deficiency:`, err);
        return NextResponse.json({ message: 'Failed to fetch deficiency', detail: err.message }, { status: 500 });
    }
}

// UPDATE an existing deficiency
export async function PUT(request: NextRequest, { params }: { params: { deficiencyId: string } }) {
    const routePath = `/api/deficiencies/${params.deficiencyId} PUT`;
    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    const { authorized, companyId, userId } = await verifyUserRole(request, 'deficiencies:edit');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const { deficiencyId } = params;
        const body = await request.json();
        const validation = updateDeficiencySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        
        const deficiencyRef = dbAdmin.collection(COLLECTIONS.DEFICIENCIES).doc(deficiencyId);
        const docSnap = await deficiencyRef.get();
        if (!docSnap.exists() || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Deficiency not found or access denied' }, { status: 404 });
        }
        
        const { custom_fields, ...standardFields } = validation.data;
        const updateData: { [key: string]: any } = { ...standardFields, updated_at: Timestamp.now() };

        // Handle custom fields separately to merge them correctly
        if (custom_fields) {
            updateData.custom_fields = { ...docSnap.data()?.custom_fields, ...custom_fields };
        }

        // Handle special logic for 'resolved' status
        if (validation.data.status === 'resolved' && docSnap.data()?.status !== 'resolved') {
            updateData.resolved_at = Timestamp.now();
            updateData.resolved_by = userId;
        }

        await deficiencyRef.update(updateData);
        const updatedDoc = await deficiencyRef.get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });
        
    } catch (err: any) {
        console.error(`[${routePath}] Error updating deficiency:`, err);
        return NextResponse.json({ message: 'Failed to update deficiency', detail: err.message }, { status: 500 });
    }
}
