// src/app/api/work-orders/[workOrderId]/notes/[noteId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type { WorkOrderNote } from '@/types/work-order';

interface RouteParams {
  params: {
    workOrderId: string;
    noteId: string;
  };
}

// Handler for deleting a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const routePath = `/api/work-orders/${params.workOrderId}/notes/${params.noteId} DELETE`;
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  }

  const { authorized, companyId, userId } = await verifyUserRole(request, 'work-orders:edit');
  if (!authorized || !companyId || !userId) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const { workOrderId, noteId } = params;

    const workOrderRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
    const workOrderSnap = await workOrderRef.get();
    const workOrderData = workOrderSnap.data();

    if (!workOrderSnap.exists || workOrderData?.company_id !== companyId) {
      return NextResponse.json({ message: 'Work Order not found or access denied' }, { status: 404 });
    }

    const publicNoteToDelete = workOrderData.public_notes?.find((n: WorkOrderNote) => n.id === noteId);
    const internalNoteToDelete = workOrderData.internal_notes?.find((n: WorkOrderNote) => n.id === noteId);

    if (!publicNoteToDelete && !internalNoteToDelete) {
      return NextResponse.json({ message: 'Note not found on this work order' }, { status: 404 });
    }
    
    // Security check: Only allow deleting own notes (or let admins delete any)
    const noteToDelete = publicNoteToDelete || internalNoteToDelete;
    if (noteToDelete.authorId !== userId) {
        // Here you could add a check for a higher permission like 'work-orders:manage'
        // For now, we restrict to only the author.
        return NextResponse.json({ message: 'Forbidden: You can only delete your own notes.' }, { status: 403 });
    }

    const noteFieldToUpdate = publicNoteToDelete ? 'public_notes' : 'internal_notes';

    await workOrderRef.update({
      [noteFieldToUpdate]: FieldValue.arrayRemove(noteToDelete)
    });

    console.log(`[${routePath}] Note ${noteId} deleted from WO #${workOrderId} by ${userId}`);
    
    return new NextResponse(null, { status: 204 });

  } catch (error: any) {
    console.error(`[${routePath}] Error deleting note:`, error);
    return NextResponse.json({ message: 'Failed to delete note', detail: error.message }, { status: 500 });
  }
}

// Handler for updating a note
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/work-orders/${params.workOrderId}/notes/${params.noteId} PUT`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    const { authorized, companyId, userId } = await verifyUserRole(request, 'work-orders:edit');
    if (!authorized || !companyId || !userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    try {
        const { workOrderId, noteId } = params;
        const { content } = await request.json();

        if (!content || typeof content !== 'string') {
            return NextResponse.json({ message: 'Note content is required.' }, { status: 400 });
        }

        const workOrderRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
        const workOrderSnap = await workOrderRef.get();
        const workOrderData = workOrderSnap.data();

        if (!workOrderSnap.exists || workOrderData?.company_id !== companyId) {
            return NextResponse.json({ message: 'Work Order not found or access denied' }, { status: 404 });
        }

        let noteFound = false;
        const allNotes: WorkOrderNote[] = [...(workOrderData.public_notes || []), ...(workOrderData.internal_notes || [])];
        const targetNote = allNotes.find(n => n.id === noteId);

        if (!targetNote) return NextResponse.json({ message: 'Note not found' }, { status: 404 });
        if (targetNote.authorId !== userId) return NextResponse.json({ message: 'Forbidden: You can only edit your own notes.' }, { status: 403 });

        const noteFieldKey = targetNote.type === 'public' ? 'public_notes' : 'internal_notes';
        
        // Firestore doesn't support updating one item in an array directly.
        // We need to read the array, update it in memory, and write the whole array back.
        const updatedNotes = workOrderData[noteFieldKey].map((n: WorkOrderNote) => {
            if (n.id === noteId) {
                return { ...n, content: content, timestamp: Timestamp.now() }; // Update content and timestamp
            }
            return n;
        });

        await workOrderRef.update({
            [noteFieldKey]: updatedNotes,
            updated_at: Timestamp.now(),
            updated_by: userId,
        });

        console.log(`[${routePath}] Note ${noteId} updated on WO #${workOrderId} by ${userId}`);
        return NextResponse.json({ message: 'Note updated successfully' }, { status: 200 });

    } catch (error: any) {
        console.error(`[${routePath}] Error updating note:`, error);
        return NextResponse.json({ message: 'Failed to update note', detail: error.message }, { status: 500 });
    }
}
