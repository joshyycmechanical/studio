
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Module } from '@/types/module';
import { defaultCompanyModules } from '@/lib/default-modules'; // Import the new default modules list

export async function GET(request: NextRequest, { params }: { params: { companyId: string } }) {
    const { companyId: requestedCompanyId } = params;
    const routePath = `/api/companies/${requestedCompanyId}/modules GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, '*'); 
    
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }

    try {
        const userProfileRef = dbAdmin.collection(COLLECTIONS.USERS).doc(authResult.userId);
        const userProfileDoc = await userProfileRef.get();

        if (!userProfileDoc.exists) {
            return NextResponse.json({ message: 'User profile not found.' }, { status: 404 });
        }
        
        const userCompanyId = userProfileDoc.data()?.company_id;

        if (userCompanyId !== requestedCompanyId) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc(requestedCompanyId);
        const companyDoc = await companyRef.get();

        if (!companyDoc.exists) {
            return NextResponse.json({ message: 'Company not found' }, { status: 404 });
        }
        
        let companyData = companyDoc.data();
        let installedModules: Module[] = companyData?.modules || [];

        if (!installedModules || installedModules.length === 0) {
            console.log(`[${routePath}] Company ${requestedCompanyId} has no modules. Self-healing...`);
            
            // Use the reliable, hardcoded list to heal the data.
            await companyRef.update({ modules: defaultCompanyModules });
            
            console.log(`[${routePath}] Successfully added ${defaultCompanyModules.length} default modules to company ${requestedCompanyId}.`);
            installedModules = defaultCompanyModules;
        }

        return NextResponse.json(installedModules, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching modules for company ${requestedCompanyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch modules', detail: err.message }, { status: 500 });
    }
}
