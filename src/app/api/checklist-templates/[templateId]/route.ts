
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';

// Helper to convert Timestamps to ISO strings for JSON serialization
const convertTimestampsToISO = (data: any) => {
    const convert = (ts: any) => (ts instanceof Timestamp ? ts.toDate().toISOString() : ts);
    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            data[key] = convert(data[key]);
        }
    }
    return data;
};

// GET a single checklist template by ID
export async function GET(request: NextRequest, { params }: { params: { templateId: string } }) {
    const routePath = `/api/checklist-templates/${params.templateId} GET`;
    console.log(`[${routePath}] Route handler invoked.`);
    
    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    // Assuming 'checklists:view' is the correct permission. Adjust if necessary.
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'checklists:view');
    if (!authorized) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { templateId } = params;
        const templateRef = dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES).doc(templateId);
        const docSnap = await templateRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ message: 'Checklist Template not found' }, { status: 404 });
        }

        const template = docSnap.data()!;
        
        // Security Check: Ensure the user can access this template.
        // It's either a platform template or belongs to the user's company.
        if (template.company_id !== companyId && !template.is_platform_template) {
            return NextResponse.json({ message: 'Forbidden: Access to this resource is denied' }, { status: 403 });
        }
        
        return NextResponse.json({ id: docSnap.id, ...convertTimestampsToISO(template) }, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching checklist template:`, err);
        return NextResponse.json({ message: 'Failed to fetch checklist template', detail: err.message }, { status: 500 });
    }
}
