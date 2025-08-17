
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import type { Company } from '@/types/company';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * GET handler to fetch the profile of the currently logged-in user's company.
 */
export async function GET(request: NextRequest) {
    const routePath = `/api/company/profile GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    // Step 1: Verify the user's token just to get their UID. We are not checking permissions here.
    const authResult = await verifyUserRole(request, '*');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { userId } = authResult;

    try {
        // Step 2: Fetch the user's profile from Firestore to get the reliable company_id.
        const userProfileRef = dbAdmin.collection(COLLECTIONS.USERS).doc(userId);
        const userProfileDoc = await userProfileRef.get();

        if (!userProfileDoc.exists) {
            return NextResponse.json({ message: 'User profile not found.' }, { status: 404 });
        }
        
        const userCompanyId = userProfileDoc.data()?.company_id;

        if (!userCompanyId) {
            return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 403 });
        }

        // Step 3: Use the reliable company_id to fetch the company profile.
        const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc(userCompanyId);
        const docSnap = await companyRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ message: 'Company not found' }, { status: 404 });
        }

        const data = docSnap.data()!;
        const company: Company = {
            id: docSnap.id,
            name: data.name,
            status: data.status,
            subscription_plan: data.subscription_plan,
            created_at: (data.created_at as Timestamp).toDate(),
            created_by: data.created_by,
            default_timezone: data.default_timezone ?? null,
            settings_initialized: data.settings_initialized ?? false,
        };

        return NextResponse.json(company, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching company profile for user ${userId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch company profile', detail: err.message }, { status: 500 });
    }
}

/**
 * PUT handler to update the profile of the currently logged-in user's company.
 */
const updateProfileSchema = z.object({
  name: z.string().min(1, 'Company Name is required').optional(),
});

export async function PUT(request: NextRequest) {
    const routePath = `/api/company/profile PUT`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    // For updating, we still need a specific permission check.
    const authResult = await verifyUserRole(request, 'company-profile:edit');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { userId, companyId } = authResult;

    if (!companyId) {
        return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const validation = updateProfileSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }

        const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc(companyId);
        await companyRef.update({ 
            ...validation.data, 
            updated_at: Timestamp.now(),
            updated_by: userId 
        });
        
        const updatedDoc = await companyRef.get();
        const companyData = updatedDoc.data()!;
        const company: Company = { 
            id: updatedDoc.id, 
            ...companyData, 
            created_at: (companyData.created_at as Timestamp).toDate() 
        } as Company;

        return NextResponse.json(company, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to update company profile', detail: err.message }, { status: 500 });
    }
}
