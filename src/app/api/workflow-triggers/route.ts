
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';

// GET all workflow triggers for a company
export async function GET(request: NextRequest) {
    const routePath = `/api/workflow-triggers GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, error, status } = await verifyUserRole(request, 'automation:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const triggersRef = dbAdmin.collection(COLLECTIONS.WORKFLOW_TRIGGERS);
        const snapshot = await triggersRef.where('company_id', '==', companyId).get();

        const triggers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        return NextResponse.json(triggers, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching workflow triggers for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch workflow triggers', detail: err.message }, { status: 500 });
    }
}

// POST a new workflow trigger
export async function POST(request: NextRequest) {
    const routePath = `/api/workflow-triggers POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, userId, error, status } = await verifyUserRole(request, 'automation:manage');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const triggerData = await request.json();

        // Basic validation
        if (!triggerData.name || !triggerData.workflow_status_name || !triggerData.trigger_event || !triggerData.action?.type) {
            return NextResponse.json({ message: 'Missing required trigger fields.' }, { status: 400 });
        }

        const newTrigger = {
            ...triggerData,
            company_id: companyId,
            created_at: Timestamp.now(),
            created_by: userId,
        };

        const docRef = await dbAdmin.collection(COLLECTIONS.WORKFLOW_TRIGGERS).add(newTrigger);
        const newDoc = await docRef.get();
        
        return NextResponse.json({ id: newDoc.id, ...newDoc.data() }, { status: 201 });

    } catch (err: any) {
        console.error(`[${routePath}] Error creating workflow trigger:`, err);
        return NextResponse.json({ message: 'Failed to create workflow trigger', detail: err.message }, { status: 500 });
    }
}
