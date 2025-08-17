
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Module } from '@/types/module';

export async function GET(request: NextRequest) {
    const routePath = `/api/platform/modules GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    // This route should only be accessible to platform administrators.
    const authResult = await verifyUserRole(request, 'platform:view');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }

    try {
        const modulesSnapshot = await dbAdmin.collection(COLLECTIONS.CHECKLIST_TEMPLATES).where('is_platform_module', '==', true).get();
        
        if (modulesSnapshot.empty) {
            return NextResponse.json([], { status: 200 });
        }

        const modules: Module[] = modulesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Module));

        return NextResponse.json(modules, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching platform modules:`, err);
        return NextResponse.json({ message: 'Failed to fetch platform modules', detail: err.message }, { status: 500 });
    }
}
