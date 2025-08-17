
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { ChecklistTemplate, ChecklistInstance } from '@/types/checklist';

// POST a new checklist instance
export async function POST(request: NextRequest) {
    const routePath = `/api/checklist-instances POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, userId } = await verifyUserRole(request, 'checklists:fill');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const { work_order_id, template_id } = await request.json();
        if (!work_order_id || !template_id) {
            return NextResponse.json({ message: 'work_order_id and template_id are required' }, { status: 400 });
        }
        
        const woRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(work_order_id);
        const templateRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES).doc(template_id);
        
        const [woSnap, templateSnap] = await Promise.all([woRef.get(), templateRef.get()]);

        if (!woSnap.exists || woSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Work order not found or access denied.' }, { status: 404 });
        }
        if (!templateSnap.exists) {
            return NextResponse.json({ message: 'Checklist template not found.' }, { status: 404 });
        }
        
        const templateData = templateSnap.data() as ChecklistTemplate;

        // Construct the object without casting to a mismatched Omit type
        const newInstanceData = {
            company_id: companyId,
            work_order_id: work_order_id,
            template_id: template_id,
            template_name: templateData.name,
            status: 'pending' as const,
            answers: [],
            created_at: Timestamp.now(),
            created_by: userId,
            completed_at: null,
            completed_by: null,
            updated_at: Timestamp.now(),
        };

        const instanceRef = await dbAdmin.collection(COLLECTIONS.CHECKLIST_INSTANCES).add(newInstanceData);
        
        await woRef.update({
            checklist_instances: FieldValue.arrayUnion({
                id: instanceRef.id,
                template_name: templateData.name,
                status: 'pending'
            })
        });

        const newDoc = await instanceRef.get();
        return NextResponse.json({ id: newDoc.id, ...newDoc.data() }, { status: 201 });

    } catch (err: any) {
        console.error(`[${routePath}] Error creating checklist instance:`, err);
        return NextResponse.json({ message: 'Failed to create checklist instance', detail: err.message }, { status: 500 });
    }
}
