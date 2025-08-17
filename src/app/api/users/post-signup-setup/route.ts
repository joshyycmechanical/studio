
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { seedNewCompany } from '@/services/seeding';
import type { Company } from '@/types/company';

const signupSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  isPlatformOwnerSignup: z.boolean(),
  companyName: z.string().optional(),
  subscription_plan: z.enum(['Trial', 'Starter', 'Pro', 'Enterprise']).optional(),
});

export async function POST(request: NextRequest) {
    const routePath = `/api/users/post-signup-setup POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    // Authorization: User must be authenticated to call this endpoint.
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch (error: any) {
        return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
    const { uid: userId } = decodedToken;

    let companyId: string | null = null;
    let assignedRoleIds: string[] = [];

    try {
        const body = await request.json();
        const validation = signupSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }

        const { isPlatformOwnerSignup, companyName, subscription_plan, fullName, email } = validation.data;
        
        if (isPlatformOwnerSignup) {
            companyId = null; // Platform owner is not associated with a company doc
            assignedRoleIds.push('platform-owner');
            console.log(`[${routePath}] Seeding platform owner for user ${userId}`);
            await seedNewCompany(dbAdmin, null, userId, { name: 'OpSite Platform', subscription_plan: 'Enterprise', adminFullName: fullName });
        } else {
            if (!companyName || !subscription_plan) {
                return NextResponse.json({ message: "Company name and subscription plan are required for company signup." }, { status: 400 });
            }
            const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc();
            companyId = companyRef.id;
            
            console.log(`[${routePath}] Seeding new company "${companyName}" (${companyId}) for user ${userId}`);
            
            const adminRoleId = await seedNewCompany(dbAdmin, companyId, userId, { name: companyName, subscription_plan, adminFullName: fullName });
            if (!adminRoleId) {
                throw new Error("Failed to get Administrator role ID during company seeding.");
            }
            assignedRoleIds.push(adminRoleId);
        }

        // --- THIS IS THE CRITICAL FIX ---
        // After all DB records are created, set the custom claims on the user's auth token.
        // This makes their role and company available immediately on their next request.
        await authAdmin.setCustomUserClaims(userId, {
            company_id: companyId,
            roles: assignedRoleIds,
        });
        console.log(`[${routePath}] Successfully set custom claims for user ${userId}: companyId=${companyId}, roles=${assignedRoleIds.join(',')}`);

        return NextResponse.json({ message: 'Post-signup setup successful', userId: userId }, { status: 200 });

    } catch (error: any) {
        console.error(`[${routePath}] Error during post-signup setup:`, error);
        return NextResponse.json({ message: 'Post-signup setup failed', detail: error.message, code: 'POST_SIGNUP_SETUP_FAILED' }, { status: 500 });
    }
}
