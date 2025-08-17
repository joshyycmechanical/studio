
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import type { Company } from '@/types/company';
import { Timestamp } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { Module } from '@/types/module';

async function checkAuth(req: NextRequest, requiredPermission: string) {
   return await verifyUserRole(req, requiredPermission);
}

// Validation schema for individual modules
const moduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  icon: z.string(),
  default_path: z.string(),
  group: z.string(),
  is_platform_module: z.boolean().optional(),
});


const updateCompanySchema = z.object({
  name: z.string().min(1, 'Company Name is required').optional(),
  status: z.enum(['active', 'paused', 'deleted']).optional(),
  subscription_plan: z.enum(['Starter', 'Pro', 'Enterprise', 'Trial']).optional(),
  default_timezone: z.string().optional().nullable(),
  settings_initialized: z.boolean().optional(),
  // Add modules to the validation schema
  modules: z.array(moduleSchema).optional(),
});

interface RouteParams {
  params: { companyId: string };
}

function mapDocToCompany(docSnap: admin.firestore.DocumentSnapshot): Company {
    const data = docSnap.data()!;
    return {
        id: docSnap.id,
        name: data.name,
        status: data.status,
        subscription_plan: data.subscription_plan,
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(0),
        created_by: data.created_by,
        default_timezone: data.default_timezone ?? null,
        settings_initialized: data.settings_initialized ?? false,
        modules: data.modules ?? [], // Ensure modules are included
    };
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const routePath = `/api/companies/${params.companyId} GET`;
  console.log(`[${routePath}] Route handler invoked.`);
  if (adminInitializationError) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_ADMIN_SDK_INIT_FAILED', detail: String(adminInitializationError).substring(0, 500) };
    console.error(`[${routePath}] Firebase Admin SDK initialization error:`, errorDetail);
    return new Response(JSON.stringify(errorDetail), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  if (!dbAdmin || !authAdmin) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_DB_AUTH_NULL', detail: 'dbAdmin or authAdmin is null, indicating an incomplete Firebase Admin SDK initialization.' };
    console.error(`[${routePath}] Critical Firebase Admin service instances are null.`);
    return new Response(JSON.stringify(errorDetail), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await checkAuth(request, 'platform-companies:view');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }

  const { companyId } = params;
  if (!companyId) {
    return NextResponse.json({ message: 'Company ID is required' }, { status: 400 });
  }

  try {
    const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc(companyId);
    const docSnap = await companyRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    }

    const company = mapDocToCompany(docSnap);
    return NextResponse.json(company, { status: 200 });
  } catch (err: any) {
    console.error(`[${routePath}] Error during main logic:`, err);
    const errorMessage = String(err.message || 'Unknown internal server error').substring(0, 500);
    const errorDetail = { message: 'API_FETCH_COMPANY_BY_ID_FAILED', detail: errorMessage, errorCode: err.code || 'UNKNOWN_CODE' };
    try {
        return new Response(JSON.stringify(errorDetail), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (stringifyError) {
        console.error(`[${routePath}] CRITICAL: Failed to JSON.stringify error object:`, stringifyError, errorDetail);
        return new Response(`Internal Server Error. Original error: ${errorMessage.replace(/[^a-zA-Z0-9 .,!?-]/g, '')}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const routePath = `/api/companies/${params.companyId} PUT`;
  console.log(`[${routePath}] Route handler invoked.`);
  if (adminInitializationError) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_ADMIN_SDK_INIT_FAILED', detail: String(adminInitializationError).substring(0, 500) };
    console.error(`[${routePath}] Firebase Admin SDK initialization error:`, errorDetail);
    return new Response(JSON.stringify(errorDetail), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  if (!dbAdmin || !authAdmin) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_DB_AUTH_NULL', detail: 'dbAdmin or authAdmin is null, indicating an incomplete Firebase Admin SDK initialization.' };
    console.error(`[${routePath}] Critical Firebase Admin service instances are null.`);
    return new Response(JSON.stringify(errorDetail), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await checkAuth(request, 'platform-companies:edit');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }
  const { userId } = authResult;

  const { companyId } = params;
  if (!companyId) {
    return NextResponse.json({ message: 'Company ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validation = updateCompanySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
    }

    const updateData = validation.data;
    if (Object.keys(updateData).length === 0) {
       return NextResponse.json({ message: 'No update data provided' }, { status: 400 });
    }

    const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc(companyId);
    const docSnap = await companyRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ message: 'Company not found' }, { status: 404 });
    }

    await companyRef.update({
        ...updateData,
        updated_at: Timestamp.now(),
        updated_by: userId,
    });

    console.log(`[${routePath}] Company updated by user ${userId}`);
    const updatedDocSnap = await companyRef.get();
    const updatedCompany = mapDocToCompany(updatedDocSnap);

    return NextResponse.json(updatedCompany, { status: 200 });

  } catch (err: any) {
    console.error(`[${routePath}] Error during main logic:`, err);
    const errorMessage = String(err.message || 'Unknown internal server error').substring(0, 500);
    const errorDetail = { message: 'API_UPDATE_COMPANY_FAILED', detail: errorMessage, errorCode: err.code || 'UNKNOWN_CODE' };
    try {
        return new Response(JSON.stringify(errorDetail), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (stringifyError) {
        console.error(`[${routePath}] CRITICAL: Failed to JSON.stringify error object:`, stringifyError, errorDetail);
        return new Response(`Internal Server Error. Original error: ${errorMessage.replace(/[^a-zA-Z0-9 .,!?-]/g, '')}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const routePath = `/api/companies/${params.companyId} DELETE`;
  console.log(`[${routePath}] Route handler invoked.`);
  if (adminInitializationError) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_ADMIN_SDK_INIT_FAILED', detail: String(adminInitializationError).substring(0, 500) };
    console.error(`[${routePath}] Firebase Admin SDK initialization error:`, errorDetail);
    return new Response(JSON.stringify(errorDetail), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  if (!dbAdmin || !authAdmin) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_DB_AUTH_NULL', detail: 'dbAdmin or authAdmin is null, indicating an incomplete Firebase Admin SDK initialization.' };
    console.error(`[${routePath}] Critical Firebase Admin service instances are null.`);
    return new Response(JSON.stringify(errorDetail), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

   const authResult = await checkAuth(request, 'platform-companies:delete');
   if (!authResult.authorized) {
     return NextResponse.json({ message: authResult.message }, { status: authResult.status });
   }
   const { userId } = authResult;

   const { companyId } = params;
   if (!companyId) {
     return NextResponse.json({ message: 'Company ID is required' }, { status: 400 });
   }

   try {
     const companyRef = dbAdmin.collection(COLLECTIONS.COMPANIES).doc(companyId);
     const docSnap = await companyRef.get();
     if (!docSnap.exists) {
       return NextResponse.json({ message: 'Company not found' }, { status: 404 });
     }

     await companyRef.update({
         status: 'deleted',
         deleted_at: Timestamp.now(),
         deleted_by: userId,
     });

     console.log(`[${routePath}] Company marked as deleted by user ${userId}`);
     return NextResponse.json({ message: 'Company marked as deleted successfully' }, { status: 200 });

   } catch (err: any) {
     console.error(`[${routePath}] Error during main logic:`, err);
    const errorMessage = String(err.message || 'Unknown internal server error').substring(0, 500);
    const errorDetail = { message: 'API_DELETE_COMPANY_FAILED', detail: errorMessage, errorCode: err.code || 'UNKNOWN_CODE' };
    try {
        return new Response(JSON.stringify(errorDetail), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (stringifyError) {
        console.error(`[${routePath}] CRITICAL: Failed to JSON.stringify error object:`, stringifyError, errorDetail);
        return new Response(`Internal Server Error. Original error: ${errorMessage.replace(/[^a-zA-Z0-9 .,!?-]/g, '')}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
   }
}
