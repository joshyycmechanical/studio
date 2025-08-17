
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { ChecklistInstance } from '@/types/checklist';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest, { params }: { params: { instanceId: string } }) {
    const routePath = `/api/checklist-instances/${params.instanceId} GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, 'checklists:view');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId } = authResult;

    try {
        if (!dbAdmin) throw new Error("dbAdmin is not initialized.");
        const instanceRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_INSTANCES).doc(params.instanceId);
        const docSnap = await instanceRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Checklist instance not found' }, { status: 404 });
        }

        const instance = { id: docSnap.id, ...docSnap.data() } as ChecklistInstance;
        return NextResponse.json(instance, { status: 200 });
    } catch (error: any) {
        console.error(`[${routePath}] Error fetching checklist instance:`, error);
        return NextResponse.json({ message: 'Failed to fetch checklist instance', detail: error.message }, { status: 500 });
    }
}


export async function PUT(request: NextRequest, { params }: { params: { instanceId: string } }) {
    const routePath = `/api/checklist-instances/${params.instanceId} PUT`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    const authResult = await verifyUserRole(request, 'checklists:edit');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId, userId } = authResult;

    try {
        if (!dbAdmin) throw new Error("dbAdmin is not initialized.");
        const updateData = await request.json();
        const instanceRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_INSTANCES).doc(params.instanceId);
        const docSnap = await instanceRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Checklist instance not found' }, { status: 404 });
        }
        
        // Add audit trail fields
        updateData.updated_at = Timestamp.now();
        updateData.updated_by = userId;

        await instanceRef.update(updateData);
        
        const updatedDoc = await instanceRef.get();
        const updatedInstance = { id: updatedDoc.id, ...updatedDoc.data() };
        
        return NextResponse.json(updatedInstance, { status: 200 });

    } catch (error: any) {
        console.error(`[${routePath}] Error updating checklist instance:`, error);
        return NextResponse.json({ message: 'Failed to update checklist instance', detail: error.message }, { status: 500 });
    }
}
