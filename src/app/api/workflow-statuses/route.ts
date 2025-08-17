
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';

// GET all workflow statuses for a company
export async function GET(request: NextRequest) {
    const routePath = `/api/workflow-statuses GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    // Permission check: a user needs to manage automation to see this
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'automation:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const statusesRef = dbAdmin.collection(COLLECTIONS.WORKFLOW_STATUSES);
        const snapshot = await statusesRef.where('company_id', '==', companyId).orderBy('sort_order').get();

        if (snapshot.empty) {
            return NextResponse.json([], { status: 200 });
        }

        const statuses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        return NextResponse.json(statuses, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching workflow statuses for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch workflow statuses', detail: err.message }, { status: 500 });
    }
}
