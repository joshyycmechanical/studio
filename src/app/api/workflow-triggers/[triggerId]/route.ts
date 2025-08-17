
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';

// UPDATE a workflow trigger
export async function PUT(request: NextRequest, { params }: { params: { triggerId: string } }) {
    const routePath = `/api/workflow-triggers/${params.triggerId} PUT`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, userId, error, status } = await verifyUserRole(request, 'customization:edit');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { triggerId } = params;
        const updateData = await request.json();

        const triggerRef = dbAdmin.collection(COLLECTIONS.WORKFLOW_TRIGGERS).doc(triggerId);
        const docSnap = await triggerRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Trigger not found or access denied' }, { status: 404 });
        }

        const finalUpdateData = {
            ...updateData,
            updated_at: Timestamp.now(),
            updated_by: userId,
        };
        
        // Ensure critical fields are not changed from the client
        delete finalUpdateData.id;
        delete finalUpdateData.company_id;
        delete finalUpdateData.created_by;
        delete finalUpdateData.created_at;

        await triggerRef.update(finalUpdateData);

        const updatedDoc = await triggerRef.get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error updating workflow trigger:`, err);
        return NextResponse.json({ message: 'Failed to update workflow trigger', detail: err.message }, { status: 500 });
    }
}

// DELETE a workflow trigger
export async function DELETE(request: NextRequest, { params }: { params: { triggerId: string } }) {
    const routePath = `/api/workflow-triggers/${params.triggerId} DELETE`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, error, status } = await verifyUserRole(request, 'customization:edit');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }
    
    try {
        const { triggerId } = params;
        const triggerRef = dbAdmin.collection(COLLECTIONS.WORKFLOW_TRIGGERS).doc(triggerId);
        const docSnap = await triggerRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Trigger not found or access denied' }, { status: 404 });
        }
        
        await triggerRef.delete();
        
        return new NextResponse(null, { status: 204 }); // Success, no content
    } catch (err: any) {
        console.error(`[${routePath}] Error deleting workflow trigger:`, err);
        return NextResponse.json({ message: 'Failed to delete workflow trigger', detail: err.message }, { status: 500 });
    }
}
