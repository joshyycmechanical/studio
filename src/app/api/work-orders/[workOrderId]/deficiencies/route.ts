
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/adminConfig';
import { authAdmin } from '@/lib/firebase/adminConfig';
import { hasPermission } from '@/lib/permissions';

export async function POST(req: NextRequest, { params }: { params: { workOrderId: string } }) {
    try {
        const token = req.headers.get('authorization')?.split('Bearer ')[1];
        if (!token) {
            return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
        }
        const decodedToken = await authAdmin.verifyIdToken(token);
        const { uid, company_id } = decodedToken;

        if (!company_id) {
            return new NextResponse(JSON.stringify({ message: 'User is not associated with a company' }), { status: 403 });
        }
        
        const canCreate = await hasPermission(uid, 'deficiencies', 'create');
        if (!canCreate) {
            return new NextResponse(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
        }

        const { workOrderId } = params;
        const body = await req.json();

        const newDeficiency = {
            ...body,
            company_id,
            work_order_id: workOrderId,
            created_by: uid,
            created_at: new Date().toISOString(),
        };

        const docRef = await dbAdmin.collection(`companies/${company_id}/deficiencies`).add(newDeficiency);
        
        return new NextResponse(JSON.stringify({ id: docRef.id, ...newDeficiency }), { status: 201 });

    } catch (error: any) {
        console.error(`Error creating deficiency for work order ${params.workOrderId}:`, error);
        return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500 });
    }
}
