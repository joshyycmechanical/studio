
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import type { Company } from '@/types/company';
import { Timestamp } from 'firebase-admin/firestore';
import { seedNewCompany } from '@/services/seeding';
import { defaultCompanyModules } from '@/lib/default-modules'; 

async function checkAuth(req: NextRequest, requiredPermission: string) {
   return await verifyUserRole(req, requiredPermission);
}

const createCompanySchema = z.object({
  name: z.string().min(1, 'Company Name is required'),
  subscription_plan: z.enum(['Starter', 'Pro', 'Enterprise', 'Trial']),
  adminEmail: z.string().email('Invalid admin email address'),
  adminFullName: z.string().min(1, "Admin's full name is required"),
  adminPhone: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const routePath = `/api/companies GET`;
  console.log(`[${routePath}] Route handler invoked.`);
  if (adminInitializationError) {
    return new Response(JSON.stringify({ message: 'Server configuration error' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  
  const authResult = await checkAuth(request, 'platform-companies:view');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }

  try {
    const companiesRef = dbAdmin.collection(COLLECTIONS.COMPANIES);
    const snapshot = await companiesRef
        .where('status', '!=', 'deleted')
        .orderBy('status')
        .orderBy('name')
        .get();

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const companies: Partial<Company>[] = snapshot.docs.map(doc => {
         const data = doc.data();
         return {
             id: doc.id,
             name: data.name,
             status: data.status,
             subscription_plan: data.subscription_plan,
             created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(0),
         };
     });

    return NextResponse.json(companies, { status: 200 });
  } catch (err: any) {
    console.error(`[${routePath}] Error fetching companies:`, err);
    return new Response(JSON.stringify({ message: 'Failed to fetch companies' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(request: NextRequest) {
  const routePath = `/api/companies POST`;
  console.log(`[${routePath}] Route handler invoked.`);
  if (adminInitializationError) {
    return new Response(JSON.stringify({ message: 'Server configuration error' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await checkAuth(request, 'platform-companies:create');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }
  const { userId: creatorUserId } = authResult;

  let newAuthUserUid: string | null = null;
  let newCompanyId: string | null = null;
  let isNewAuthUser = false;

  try {
    const body = await request.json();
    const validation = createCompanySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
    }

    const { name, subscription_plan, adminEmail, adminFullName, adminPhone } = validation.data;
    
    const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc();
    newCompanyId = companyRef.id;
    
    const newCompanyData = {
        name,
        status: 'active',
        subscription_plan,
        created_at: Timestamp.now(),
        created_by: creatorUserId,
        default_timezone: 'America/Denver',
        settings_initialized: false,
        modules: defaultCompanyModules,
    };
    await companyRef.set(newCompanyData);
    console.log(`[${routePath}] Created company document ${newCompanyId} with ${defaultCompanyModules.length} default modules.`);

    try {
        const authUser = await authAdmin.getUserByEmail(adminEmail);
        newAuthUserUid = authUser.uid;
    } catch (authError: any) {
        if (authError.code === 'auth/user-not-found') {
            const newAuthUser = await authAdmin.createUser({
                email: adminEmail,
                emailVerified: false,
                displayName: adminFullName,
                disabled: false,
            });
            newAuthUserUid = newAuthUser.uid;
            isNewAuthUser = true;
        } else {
            throw authError;
        }
    }

    if (!newAuthUserUid) throw new Error("Failed to obtain Auth User UID.");

    await authAdmin.setCustomUserClaims(newAuthUserUid, { company_id: newCompanyId, roles: ['admin'] });
    
    const userProfileRef = dbAdmin.collection(COLLECTIONS.USERS).doc(newAuthUserUid);
    await userProfileRef.set({
        email: adminEmail,
        company_id: newCompanyId,
        status: 'active',
        full_name: adminFullName,
        phone: adminPhone ?? null,
        roles: ['admin'],
        created_at: Timestamp.now(),
        invited_by: creatorUserId,
    });

    await seedNewCompany(dbAdmin, newCompanyId, newAuthUserUid);

    return NextResponse.json({ message: 'Company created successfully', companyId: newCompanyId }, { status: 201 });

  } catch (err: any) {
    console.error(`[${routePath}] Error during company creation:`, err);
     if (isNewAuthUser && newAuthUserUid) {
         await authAdmin.deleteUser(newAuthUserUid).catch(e => console.error("Failed to cleanup new auth user:", e));
     }
      if (newCompanyId) {
         await dbAdmin.collection(COLLECTIONS.COMPANIES).doc(newCompanyId).delete().catch(e => console.error("Failed to cleanup new company doc:", e));
     }
    return new Response(JSON.stringify({ message: 'Failed to create company' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
