
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { ChecklistTemplate } from '@/types/checklist';

const checklistTemplateSchema = z.object({
  name: z.string().min(1, 'Template Name is required'),
  description: z.string().optional().nullable(),
  fields: z.array(z.any()).default([]),
});

export async function GET(request: NextRequest) {
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    const { authorized } = await verifyUserRole(request, 'platform-templates:view');
    if (!authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    try {
        const templatesRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES);
        // Query only by the filter to avoid needing a composite index
        const q = templatesRef.where('is_platform_template', '==', true);
        const snapshot = await q.get();

        const templates = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                name: data.name || 'Untitled Template', // Fallback for safety
                created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(),
                updated_at: (data.updated_at as Timestamp)?.toDate() ?? null,
            };
        });

        // Sort the results in memory before sending the response
        templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        return NextResponse.json(templates, { status: 200 });
    } catch (error: any) {
        console.error("Error fetching platform checklist templates:", error);
        return NextResponse.json({ message: 'Failed to fetch templates', detail: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    
    const { authorized, userId } = await verifyUserRole(request, 'platform-templates:create');
    if (!authorized || !userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    try {
        const body = await request.json();
        const validation = checklistTemplateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        const { name, description, fields } = validation.data;

        const templatesCollection = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES);
        const newTemplateData = {
            name,
            description: description ?? null,
            fields: fields ?? [],
            is_platform_template: true,
            company_id: null,
            created_by: userId,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        };

        const docRef = await templatesCollection.add(newTemplateData);
        const newDoc = await docRef.get();
        const data = newDoc.data()!;
        const newTemplate = {
            id: newDoc.id,
            ...data,
            created_at: (data.created_at as Timestamp)?.toDate(),
            updated_at: (data.updated_at as Timestamp)?.toDate(),
        }

        return NextResponse.json(newTemplate, { status: 201 });
    } catch (error: any) {
        console.error("Error creating platform checklist template:", error);
        return NextResponse.json({ message: 'Failed to create template', detail: error.message }, { status: 500 });
    }
}
