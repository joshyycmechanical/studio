
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { WorkOrderNote } from '@/types/work-order';

const newNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty.'),
  type: z.enum(['public', 'internal']),
});

export async function POST(request: NextRequest, { params }: { params: { workOrderId: string } }) {
    const routePath = `/api/work-orders/${params.workOrderId}/notes POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, 'work-orders:edit');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId, userId, userProfile } = authResult;

    if (!companyId || !userId) {
        return NextResponse.json({ message: 'User or company context is missing.' }, { status: 400 });
    }

    try {
        const { workOrderId } = params;
        const body = await request.json();
        const validation = newNoteSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }

        const { content, type } = validation.data;
        
        const workOrderRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
        const workOrderSnap = await workOrderRef.get();
        if (!workOrderSnap.exists || workOrderSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Work Order not found or access denied' }, { status: 404 });
        }

        const newNote: WorkOrderNote = {
            id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            content,
            authorId: userId,
            authorName: userProfile?.full_name ?? 'System',
            timestamp: Timestamp.now() as any,
            type,
        };
        
        const noteFieldToUpdate = type === 'public' ? 'public_notes' : 'internal_notes';

        await workOrderRef.update({
            [noteFieldToUpdate]: FieldValue.arrayUnion(newNote),
            updated_at: Timestamp.now(),
            updated_by: userId,
        });

        console.log(`[${routePath}] New ${type} note added to WO #${workOrderId} by ${userId}`);
        
        const updatedDoc = await workOrderRef.get();
        const updatedNotes = updatedDoc.data()?.[noteFieldToUpdate] || [];
        const savedNote = updatedNotes.find((n: WorkOrderNote) => n.id === newNote.id);
        
        return NextResponse.json({ ...savedNote, timestamp: new Date() }, { status: 201 });

    } catch (error: any) {
        console.error(`[${routePath}] Error adding note:`, error);
        return NextResponse.json({ message: 'Failed to add note', detail: error.message }, { status: 500 });
    }
}
