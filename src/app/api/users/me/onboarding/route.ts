
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

const onboardingSchema = z.object({
  full_name: z.string().min(1, 'Full Name is required'),
  phone: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const routePath = `/api/users/me/onboarding POST`;
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or invalid Bearer token' }, { status: 401 });
  }
  const idToken = authorization.split('Bearer ')[1];

  let userId = '';
  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error: any) {
    console.error(`[${routePath}] Invalid ID token:`, error);
    return NextResponse.json({ message: 'Unauthorized: Invalid token' }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized: Could not verify user identity' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = onboardingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
    }

    const { full_name, phone } = validation.data;
    const userRef = dbAdmin.collection(COLLECTIONS.USERS).doc(userId);

    const updateData = {
      full_name,
      phone: phone?.trim() || null,
      status: 'active', // Mark user as active after onboarding
      updated_at: Timestamp.now(),
    };

    await userRef.update(updateData);
    console.log(`[${routePath}] Onboarding profile updated successfully for user ${userId}.`);

    return NextResponse.json({ message: 'Profile updated successfully' }, { status: 200 });

  } catch (err: any) {
    console.error(`[${routePath}] Error during onboarding update for user ${userId}:`, err);
    return NextResponse.json({ message: 'Failed to update profile', detail: err.message }, { status: 500 });
  }
}
