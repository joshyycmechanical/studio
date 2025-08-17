
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin } from '@/lib/firebase/adminConfig';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { uid } = decodedToken;
    const { text, companyId } = await request.json();

    if (!text || !uid || !companyId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const newTodoData = {
            text,
            completed: false,
            created_at: FieldValue.serverTimestamp(),
            user_id: uid,
            company_id: companyId,
        };
        const docRef = await dbAdmin.collection(COLLECTIONS.TODOS).add(newTodoData);
        
        // Only return the ID of the new document
        return NextResponse.json({ id: docRef.id });

    } catch (error: any) {
        console.error('Error creating todo:', error);
        return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
    }
}
