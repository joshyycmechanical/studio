
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import type { UserProfile, UserProfileWithRoles } from '@/types/user';
import { Timestamp } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

async function checkAuth(req: NextRequest, requiredPermission: string, targetUserId?: string, targetCompanyId?: string | null) {
   const { authorized, userId, companyId: requestingCompanyId, error, status } = await verifyUserRole(req, requiredPermission, targetCompanyId);
   return { authorized, userId, error, status, requestingCompanyId };
}

const updateUserSchema = z.object({
  full_name: z.string().min(1, 'Full Name is required').optional(),
  phone: z.string().optional().nullable(),
  status: z.enum(['active', 'suspended']).optional(),
  roleIds: z.array(z.string()).min(1, 'User must have at least one role.'), // Now required when passed
  pay_rate_hourly: z.number().positive().optional().nullable(),
  overtime_threshold_hours: z.number().positive().optional().nullable(),
});

interface RouteParams {
  params: { userId: string };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const routePath = `/api/users/${params.userId} PUT`;
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

  const { userId: targetUserId } = params;
  if (!targetUserId) {
    return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
  }

  // Auth check remains the same; the logic inside verifyUserRole handles platform vs company admin
  const { authorized, userId: requestingUserId, requestingCompanyId, error, status } = await checkAuth(request, 'users:edit', targetUserId);
  if (!authorized || !requestingUserId) {
    return NextResponse.json({ message: error || 'Unauthorized' }, { status: status || 401 });
  }

  try {
    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
    }
    const { roleIds, ...profileUpdates } = validation.data;
    if (Object.keys(profileUpdates).length === 0 && !roleIds) {
      return NextResponse.json({ message: 'No update data provided' }, { status: 400 });
    }

    const userRef = dbAdmin.collection(COLLECTIONS.USERS).doc(targetUserId);
    const rolesLinkRef = dbAdmin.collection(COLLECTIONS.USER_ROLES);
    const targetUserSnap = await userRef.get();
    if (!targetUserSnap.exists) {
        return NextResponse.json({ message: 'Target user not found' }, { status: 404 });
    }
    const targetUserData = targetUserSnap.data() as UserProfile;
     if (requestingCompanyId !== null && targetUserData.company_id !== requestingCompanyId) {
         return NextResponse.json({ message: 'Forbidden: Cannot modify user from another company' }, { status: 403 });
     }
    if (targetUserData.status === 'invited' && profileUpdates.status) {
        delete profileUpdates.status;
        console.warn(`[${routePath}] Attempted to change status of invited user. Ignored.`);
    }

    const batch = dbAdmin.batch();
    if (Object.keys(profileUpdates).length > 0) {
        const updatePayload: { [key: string]: any } = {
            ...profileUpdates,
            updated_at: Timestamp.now(),
            updated_by: requestingUserId,
        };
         if (profileUpdates.hasOwnProperty('phone')) {
            updatePayload.phone = profileUpdates.phone ?? null;
         }
         if (profileUpdates.hasOwnProperty('pay_rate_hourly')) {
            updatePayload.pay_rate_hourly = profileUpdates.pay_rate_hourly ?? null;
         }
         if (profileUpdates.hasOwnProperty('overtime_threshold_hours')) {
             updatePayload.overtime_threshold_hours = profileUpdates.overtime_threshold_hours ?? 40;
         }
        batch.update(userRef, updatePayload);
    }
    
    // --- THIS IS THE UPDATED ROLE ASSIGNMENT LOGIC ---
    // It now handles an array of roleIds correctly.
    if (roleIds) {
        await authAdmin.setCustomUserClaims(targetUserId, { 
            company_id: targetUserData.company_id,
            roles: roleIds,
        });
        console.log(`[${routePath}] Firebase Auth custom claims updated for user ${targetUserId}.`);
        
        const existingLinksQuery = await rolesLinkRef
            .where('user_id', '==', targetUserId)
            .where('company_id', '==', targetUserData.company_id)
            .get();
        existingLinksQuery.docs.forEach(doc => batch.delete(doc.ref));

        roleIds.forEach(roleId => {
            const newLinkRef = rolesLinkRef.doc();
            batch.set(newLinkRef, {
                user_id: targetUserId,
                role_id: roleId,
                company_id: targetUserData.company_id,
            });
        });
    }
    // --- END OF ROLE ASSIGNMENT LOGIC ---

    await batch.commit();

    if (profileUpdates.status && profileUpdates.status !== targetUserData.status && targetUserData.status !== 'invited') {
        try {
            await authAdmin.updateUser(targetUserId, {
                disabled: profileUpdates.status === 'suspended',
            });
            console.log(`[${routePath}] Firebase Auth disabled status updated to: ${profileUpdates.status === 'suspended'}`);
        } catch (authError) {
             console.error(`[${routePath}] Failed to update Firebase Auth status:`, authError);
        }
    }
    console.log(`[${routePath}] User updated by ${requestingUserId}`);
    return NextResponse.json({ message: 'User updated successfully' }, { status: 200 });
  } catch (err: any) {
    console.error(`[${routePath}] Error during main logic:`, err);
    const errorMessage = String(err.message || 'Unknown internal server error').substring(0, 500);
    const errorDetail = { message: 'API_UPDATE_USER_FAILED', detail: errorMessage, errorCode: err.code || 'UNKNOWN_CODE' };
    try {
        return new Response(JSON.stringify(errorDetail), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (stringifyError) {
        console.error(`[${routePath}] CRITICAL: Failed to JSON.stringify error object:`, stringifyError, errorDetail);
        return new Response(`Internal Server Error. Original error: ${errorMessage.replace(/[^a-zA-Z0-9 .,!?-]/g, '')}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
}
