
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Module } from '@/types/module';

export async function GET(request: NextRequest) {
    const routePath = `/api/users/me/modules GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    // A user should only need to be authenticated and part of a company to see the installed modules.
    // The permission check was likely too strict before.
    const authResult = await verifyUserRole(request, '*'); // Using '*' as a placeholder for any valid, authenticated user
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId } = authResult;
    
    if (!companyId) {
        return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 403 });
    }

    try {
        const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc(companyId);
        const companyDoc = await companyRef.get();

        if (!companyDoc.exists) {
            return NextResponse.json({ message: 'Company not found' }, { status: 404 });
        }
        
        const companyData = companyDoc.data();
        const installedModules: Module[] = companyData?.modules || [];

        return NextResponse.json(installedModules, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching installed modules for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch installed modules', detail: err.message }, { status: 500 });
    }
}
