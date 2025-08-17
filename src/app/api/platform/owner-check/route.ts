
// src/app/api/platform/owner-check/route.ts
import { NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { query, where, limit, getDocs, collection } from 'firebase-admin/firestore';

export async function GET() {
  const routePath = '/api/platform/owner-check GET';
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_ADMIN_SDK_INIT_FAILED', detail: String(adminInitializationError).substring(0, 500), code: 'ADMIN_SDK_INIT_FAILED' };
    console.error(`[${routePath}] Firebase Admin SDK initialization error:`, errorDetail);
    return NextResponse.json(errorDetail, { status: 503 });
  }
  if (!dbAdmin) {
    const errorDetail = { message: 'SERVER_CONFIG_ERROR_DB_NULL', detail: 'dbAdmin is null, indicating an incomplete Firebase Admin SDK initialization.', code: 'DB_NULL_ERROR' };
    console.error(`[${routePath}] Critical Firebase Admin service (dbAdmin) is null.`);
    return NextResponse.json(errorDetail, { status: 503 });
  }

  try {
    const usersRef = dbAdmin.collection(COLLECTIONS.USERS);
    const q = usersRef.where('company_id', '==', null).limit(1);
    const querySnapshot = await q.get();

    const platformOwnerExists = !querySnapshot.empty;

    console.log(`[${routePath}] Platform owner exists check result: ${platformOwnerExists}`);
    return NextResponse.json({ platformOwnerExists }, { status: 200 });

  } catch (error: any) {
    console.error(`[${routePath}] Error checking for platform owner:`, error);
    const errorMessage = String(error.message || 'Unknown internal server error').substring(0, 500);
    const errorDetail = { 
        message: 'Failed to query Firestore for platform owner check', 
        detail: errorMessage, 
        code: error.code || 'PLATFORM_OWNER_CHECK_QUERY_FAILED' 
    };
    
    try {
        return new Response(JSON.stringify(errorDetail), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (stringifyError) {
        console.error(`[${routePath}] CRITICAL: Failed to JSON.stringify error object:`, stringifyError, errorDetail);
        return new Response(`Internal Server Error. Original error: ${errorMessage.replace(/[^a-zA-Z0-9 .,!?-]/g, '')}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
}
