
// src/app/api/users/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserProfile, UserRoleLink } from '@/types/user';
import { sendInvitationEmail } from '@/lib/email'; // Placeholder for email sending

async function checkAuth(req: NextRequest, requiredPermission: string, targetCompanyId?: string | null): Promise<{ authorized: boolean; userId?: string; error?: string; status?: number; requestingCompanyId?: string | null }> {
   const { authorized, userId, companyId: requestingCompanyId, error, status } = await verifyUserRole(req, requiredPermission, targetCompanyId);
   return { authorized, userId, error, status, requestingCompanyId };
}

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  roleIds: z.array(z.string()).min(1, 'At least one role ID is required'),
});


export async function POST(request: NextRequest) {
  const routePath = `/api/users/invite POST`;
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

  const searchParams = request.nextUrl.searchParams;
  const companyIdToInviteTo = searchParams.get('companyId');

  if (!companyIdToInviteTo) {
    return NextResponse.json({ message: 'companyId query parameter is required for invitation' }, { status: 400 });
  }

  const { authorized, userId: invitingUserId, error: authErrorMsg, status: authStatus } = await checkAuth(request, 'users:create', companyIdToInviteTo);
  if (!authorized || !invitingUserId) {
    return NextResponse.json({ message: authErrorMsg || 'Unauthorized' }, { status: authStatus || 401 });
  }

  let invitedAuthUserUid: string | null = null;
  let userProfileDocId: string | null = null;

  try {
    const body = await request.json();
    const validation = inviteUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body for invite', errors: validation.error.errors }, { status: 400 });
    }

    const { email, fullName, phone, roleIds } = validation.data;

    let existingAuthUser;
    try {
        existingAuthUser = await authAdmin.getUserByEmail(email);
        invitedAuthUserUid = existingAuthUser.uid;
        console.log(`[${routePath}] Existing Auth user found for ${email} (UID: ${invitedAuthUserUid}).`);
    } catch (e: any) {
        if (e.code !== 'auth/user-not-found') {
            throw e; 
        }
        console.log(`[${routePath}] No existing Auth user for ${email}.`);
    }

    const usersCollection = dbAdmin.collection(COLLECTIONS.USERS);
    const existingProfileQuery = await usersCollection
        .where('email', '==', email)
        .where('company_id', '==', companyIdToInviteTo)
        .limit(1)
        .get();

    if (!existingProfileQuery.empty) {
        return NextResponse.json({ message: `User with email ${email} already exists or is invited to this company.` }, { status: 409 });
    }

    userProfileDocId = invitedAuthUserUid || dbAdmin.collection(COLLECTIONS.USERS).doc().id;

    const newUserProfileData: Omit<UserProfile, 'id'> = {
        email: email,
        company_id: companyIdToInviteTo,
        status: 'invited',
        full_name: fullName ?? null,
        phone: phone ?? null,
        created_at: Timestamp.now(),
        invited_by: invitingUserId,
        last_login: null,
        profile_photo_url: null,
        pay_rate_hourly: null,
        overtime_threshold_hours: 40,
    };
    await usersCollection.doc(userProfileDocId).set(newUserProfileData);
    console.log(`[${routePath}] UserProfile document created/updated for ${email} (Doc ID: ${userProfileDocId}) in company ${companyIdToInviteTo}. Status: invited.`);

    const batch = dbAdmin.batch();
    const userRolesCollection = dbAdmin.collection(COLLECTIONS.USER_ROLES);
    roleIds.forEach(roleId => {
        const linkRef = userRolesCollection.doc();
        batch.set(linkRef, {
            user_id: userProfileDocId,
            role_id: roleId,
            company_id: companyIdToInviteTo,
        });
    });
    await batch.commit();
    console.log(`[${routePath}] ${roleIds.length} role links created for user profile ${userProfileDocId}.`);

    const mockInviteLink = `${request.nextUrl.origin}/onboarding?invite_token=mock_${userProfileDocId}_${Date.now()}`;
    console.log(`[${routePath}] Mock Invite Link generated: ${mockInviteLink}`);

    await sendInvitationEmail(email, mockInviteLink);
    console.log(`[${routePath}] Invitation email placeholder executed for ${email}.`);

    return NextResponse.json({ message: 'User invited successfully.', userId: userProfileDocId }, { status: 201 });

  } catch (err: any) {
    console.error(`[${routePath}] Error during main logic for company ${companyIdToInviteTo}:`, err);
    if (userProfileDocId && !invitedAuthUserUid) {
        try {
            await dbAdmin.collection(COLLECTIONS.USERS).doc(userProfileDocId).delete();
            console.log(`[${routePath} Cleanup] Deleted placeholder UserProfile doc ${userProfileDocId} due to error.`);
        } catch (cleanupErr) {
            console.error(`[${routePath} Cleanup] Failed to delete UserProfile doc ${userProfileDocId}:`, cleanupErr);
        }
    }
    const errorMessage = String(err.message || 'Unknown internal server error').substring(0, 500);
    const errorDetail = { message: 'API_INVITE_USER_FAILED', detail: errorMessage, errorCode: err.code || 'UNKNOWN_CODE' };
    try {
        return new Response(JSON.stringify(errorDetail), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (stringifyError) {
        console.error(`[${routePath}] CRITICAL: Failed to JSON.stringify error object:`, stringifyError, errorDetail);
        return new Response(`Internal Server Error. Original error: ${errorMessage.replace(/[^a-zA-Z0-9 .,!?-]/g, '')}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
}

export async function PUT(request: NextRequest) {
  const routePath = `/api/users/invite PUT (resend)`;
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

  const searchParams = request.nextUrl.searchParams;
  const userIdToResend = searchParams.get('userId');
  const targetUserEmail = searchParams.get('email');

  if (!userIdToResend || !targetUserEmail) {
    return NextResponse.json({ message: 'userId and email query parameters are required for resend' }, { status: 400 });
  }

  const userProfileDoc = await dbAdmin.collection(COLLECTIONS.USERS).doc(userIdToResend).get();
  if (!userProfileDoc.exists) {
    return NextResponse.json({ message: 'User to resend invite to not found' }, { status: 404 });
  }
  const targetUserCompanyId = userProfileDoc.data()?.company_id;

  const { authorized, error: authErrorMsg, status: authStatus } = await checkAuth(request, 'users:edit', targetUserCompanyId);
  if (!authorized) {
    return NextResponse.json({ message: authErrorMsg || 'Unauthorized' }, { status: authStatus || 401 });
  }

  try {
    if (userProfileDoc.data()?.status !== 'invited') {
        return NextResponse.json({ message: 'User is not in invited status. Cannot resend invite.' }, { status: 400 });
    }

    const mockInviteLink = `${request.nextUrl.origin}/onboarding?invite_token=mock_resent_${userIdToResend}_${Date.now()}`;
    await sendInvitationEmail(targetUserEmail, mockInviteLink);
    console.log(`[${routePath}] New invitation email placeholder executed for ${targetUserEmail}.`);

    await dbAdmin.collection(COLLECTIONS.USERS).doc(userIdToResend).update({
        last_invite_sent_at: Timestamp.now()
    });

    return NextResponse.json({ message: 'Invitation resent successfully.' }, { status: 200 });

  } catch (err: any) {
    console.error(`[${routePath}] Error during main logic for user ${userIdToResend}:`, err);
    const errorMessage = String(err.message || 'Unknown internal server error').substring(0, 500);
    const errorDetail = { message: 'API_RESEND_INVITE_FAILED', detail: errorMessage, errorCode: err.code || 'UNKNOWN_CODE' };
    try {
        return new Response(JSON.stringify(errorDetail), { status: 500, headers: { 'Content-Type': 'application/json' } });
    } catch (stringifyError) {
        console.error(`[${routePath}] CRITICAL: Failed to JSON.stringify error object:`, stringifyError, errorDetail);
        return new Response(`Internal Server Error. Original error: ${errorMessage.replace(/[^a-zA-Z0-9 .,!?-]/g, '')}`, { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  }
}
