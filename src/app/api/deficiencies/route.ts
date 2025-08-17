
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Deficiency } from '@/types/deficiency';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

const deficiencySchema = z.object({
  location_id: z.string().min(1),
  equipment_id: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  notes: z.string().optional().nullable(),
  custom_fields: z.record(z.any()).optional().nullable(),
});

export async function GET(request: NextRequest) {
    const routePath = `/api/deficiencies GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, 'deficiencies:view');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId } = authResult;

    try {
        const snapshot = await dbAdmin.collection(COLLECTIONS.DEFICIENCIES)
            .where('company_id', '==', companyId)
            .get();

        const deficiencies: Deficiency[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Deficiency));

        return NextResponse.json(deficiencies, { status: 200 });
    } catch (error: any) {
        console.error(`[${routePath}] Error fetching deficiencies:`, error);
        return NextResponse.json({ message: 'Failed to fetch deficiencies', detail: error.message }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    const routePath = `/api/deficiencies POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, 'deficiencies:create');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId, userId, userProfile } = authResult;
    
    if (!companyId || !userId || !userProfile) {
         return NextResponse.json({ message: 'Authentication context is missing required data.' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const validation = deficiencySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        
        const { location_id, equipment_id, description, severity, notes, custom_fields } = validation.data;

        // Fetch customer_id from location
        const locationDoc = await dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(location_id).get();
        if (!locationDoc.exists || locationDoc.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Location not found or access denied.' }, { status: 404 });
        }
        const customer_id = locationDoc.data()?.customer_id;
        
        const newDeficiency = {
            company_id: companyId,
            customer_id: customer_id,
            location_id: location_id,
            equipment_id: equipment_id || null,
            work_order_id: null,
            reported_by: userId,
            reported_at: Timestamp.now(),
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            description: description,
            severity: severity,
            status: 'open',
            resolution_notes: null,
            resolved_at: null,
            resolved_by: null,
            attachments: [],
            related_estimate_id: null,
            custom_fields: custom_fields || {},
            notes: notes || null,
        };

        const docRef = await dbAdmin.collection(COLLECTIONS.DEFICIENCIES).add(newDeficiency);
        
        return NextResponse.json({ id: docRef.id, ...newDeficiency }, { status: 201 });

    } catch (error: any) {
        console.error(`[${routePath}] Error creating deficiency:`, error);
        return NextResponse.json({ message: 'Failed to create deficiency', detail: error.message }, { status: 500 });
    }
}
