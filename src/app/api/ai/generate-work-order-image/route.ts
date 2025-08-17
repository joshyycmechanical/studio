
import { NextRequest, NextResponse } from 'next/server';
import { generateImageForWorkOrder } from '@/ai/flows/generate-image-for-work-order';
import { auth } from 'firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';
import { verifyUserRole } from '@/lib/firebase/adminAuth';

export async function POST(request: NextRequest) {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    let decodedToken: DecodedIdToken;
    try {
        decodedToken = await auth().verifyIdToken(idToken);
    } catch (error) {
        console.error('Error verifying ID token:', error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authCheck = await verifyUserRole(request, 'work-orders:create'); 
    if (!authCheck.authorized) {
        return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
    }

    try {
        const { workOrderSummary } = await request.json();
        if (!workOrderSummary) {
            return NextResponse.json({ error: 'Work order summary is required' }, { status: 400 });
        }

        const result = await generateImageForWorkOrder(workOrderSummary);

        // Assuming the flow returns an object with an 'imageUrl' property
        return NextResponse.json({ imageUrl: result.imageUrl });

    } catch (error: any) {
        console.error('Error generating image:', error);
        return NextResponse.json({ error: 'Failed to generate image', details: error.message }, { status: 500 });
    }
}
