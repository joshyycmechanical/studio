
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

interface RouteParams {
  params: { templateId: string };
}

const updateChecklistTemplateSchema = z.object({
  name: z.string().min(1, 'Template Name is required').optional(),
  description: z.string().optional().nullable(),
  fields: z.array(z.any()).optional(),
});


async function verifyPlatformTemplate(templateId: string): Promise<boolean> {
    const docRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES).doc(templateId);
    const docSnap = await docRef.get();
    return docSnap.exists && docSnap.data()?.is_platform_template === true;
}


export async function GET(request: NextRequest, { params }: RouteParams) {
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    const { authorized } = await verifyUserRole(request, 'platform-templates:view');
    if (!authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { templateId } = params;
    if (!templateId) return NextResponse.json({ message: 'Template ID is required' }, { status: 400 });

    try {
        const docRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES).doc(templateId);
        const docSnap = await docRef.get();

        if (!docSnap.exists() || !docSnap.data()?.is_platform_template) {
            return NextResponse.json({ message: 'Platform template not found' }, { status: 404 });
        }
        
        const data = docSnap.data()!;
        const template = {
            id: docSnap.id,
            ...data,
            created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
            updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
        };

        return NextResponse.json(template, { status: 200 });
    } catch (error: any) {
        console.error(`Error fetching platform template ${templateId}:`, error);
        return NextResponse.json({ message: 'Failed to fetch template', detail: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    
    const { authorized, userId } = await verifyUserRole(request, 'platform-templates:edit');
    if (!authorized || !userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { templateId } = params;
    if (!templateId) return NextResponse.json({ message: 'Template ID is required' }, { status: 400 });

    try {
        if (!await verifyPlatformTemplate(templateId)) {
            return NextResponse.json({ message: 'Platform template not found' }, { status: 404 });
        }

        const body = await request.json();
        const validation = updateChecklistTemplateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        
        const updateData = {
            ...validation.data,
            updated_at: Timestamp.now(),
        };

        const docRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES).doc(templateId);
        await docRef.update(updateData);
        
        return NextResponse.json({ message: 'Template updated successfully' }, { status: 200 });
    } catch (error: any) {
        console.error(`Error updating platform template ${templateId}:`, error);
        return NextResponse.json({ message: 'Failed to update template', detail: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    
    const { authorized } = await verifyUserRole(request, 'platform-templates:delete');
    if (!authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    
    const { templateId } = params;
    if (!templateId) return NextResponse.json({ message: 'Template ID is required' }, { status: 400 });

    try {
        if (!await verifyPlatformTemplate(templateId)) {
            return NextResponse.json({ message: 'Platform template not found' }, { status: 404 });
        }

        const docRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES).doc(templateId);
        await docRef.delete();
        
        return new NextResponse(null, { status: 204 }); // No Content
    } catch (error: any) {
        console.error(`Error deleting platform template ${templateId}:`, error);
        return NextResponse.json({ message: 'Failed to delete template', detail: error.message }, { status: 500 });
    }
}
