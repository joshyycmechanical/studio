
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
    const routePath = `/api/checklists GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, error, status } = await verifyUserRole(request, 'checklists:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const templatesRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES);
        const q = templatesRef.where('company_id', '==', companyId);
        const snapshot = await q.get();

        const templates = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                created_at: (data.created_at as Timestamp)?.toDate()?.toISOString(),
                updated_at: (data.updated_at as Timestamp)?.toDate()?.toISOString() ?? null,
            };
        });

        templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        return NextResponse.json(templates, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching checklists for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch checklist templates', detail: err.message }, { status: 500 });
    }
}
