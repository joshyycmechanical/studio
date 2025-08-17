// src/lib/firebase/adminAuth.ts

import { NextRequest, NextResponse } from 'next/server';
import { authAdmin, dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { DecodedIdToken } from 'firebase-admin/auth';
import { COLLECTIONS } from './collections';
import type { Role, ModulePermissions } from '@/types/role';
import type { UserProfile } from '@/types/user';
import { initialRoleTemplates, allPlatformModules } from '@/lib/roles-data';
import admin from 'firebase-admin';

// Define clear result types for success and failure.
type AuthVerificationSuccess = {
  authorized: true;
  userId: string;
  companyId: string | null;
  userProfile: UserProfile; // Include the user profile in the success result
};

type AuthVerificationFailure = {
  authorized: false;
  message: string;
  status: number;
};

export type AuthVerificationResult = AuthVerificationSuccess | AuthVerificationFailure;


/**
 * Verifies a user's ID token and checks if they have a specific permission.
 * This function is the definitive source of truth for authorization in API routes.
 * @param request The Next.js request object containing the Authorization header.
 * @param requiredPermission The permission string to check (e.g., 'work-orders:view', or '*' for any authenticated user).
 * @param targetCompanyId Optional: The company context for the resource being accessed.
 * @returns An AuthVerificationResult object.
 */
export async function verifyUserRole(request: NextRequest, requiredPermission: string, targetCompanyId?: string | null): Promise<AuthVerificationResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, message: 'Authorization header is missing or invalid.', status: 401 };
  }
  const idToken = authHeader.split('Bearer ')[1];

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await authAdmin.verifyIdToken(idToken);
  } catch (error) {
    console.error('Error verifying ID token:', error);
    return { authorized: false, message: 'Invalid authentication token.', status: 401 };
  }
  const { uid: userId } = decodedToken;

  try {
    // 1. Fetch user profile from Firestore - This is the primary source of truth for company_id.
    const userProfileSnap = await dbAdmin.collection(COLLECTIONS.USERS).doc(userId).get();
    if (!userProfileSnap.exists) {
        console.warn(`[verifyUserRole] User profile not found in Firestore for UID: ${userId}.`);
        return { authorized: false, message: 'User profile not found.', status: 403 };
    }
    const userProfileData = userProfileSnap.data() as UserProfile;
    const userCompanyId = userProfileData.company_id ?? null;

    // 2. Determine if it's a platform-level user vs. a company user.
    const isPlatformUser = userCompanyId === null;

    // If a targetCompanyId is provided, perform context checks.
    if (targetCompanyId !== undefined && !isPlatformUser && userCompanyId !== targetCompanyId) {
        console.warn(`[verifyUserRole] Forbidden: User ${userId} from company ${userCompanyId} tried to access resource from company ${targetCompanyId}.`);
        return { authorized: false, message: 'Forbidden: Access to this resource is denied.', status: 403 };
    }

    // 3. If the check is just for any authenticated user, we can return early.
    if (requiredPermission === '*') {
        return { authorized: true, userId, companyId: userCompanyId, userProfile: userProfileData };
    }
    
    // 4. Fetch the user's role assignments.
    const userRolesQuery = await dbAdmin.collection(COLLECTIONS.USER_ROLES)
        .where('user_id', '==', userId)
        .where('company_id', '==', userCompanyId) // CRITICAL: Match the user's context (null for platform, id for company)
        .get();

    const userRoleIds = userRolesQuery.docs.map(doc => doc.data().role_id);
    if (userRoleIds.length === 0) {
        console.warn(`[verifyUserRole] No role links found for user ${userId} in their context.`);
        return { authorized: false, message: 'User has no assigned roles.', status: 403 };
    }

    // 5. Fetch the definitions for those roles.
    const roleRefs = userRoleIds.map(id => dbAdmin.collection(COLLECTIONS.ROLES).doc(id));
    const roleDocs = await dbAdmin.getAll(...roleRefs);
    const userRoles = roleDocs.filter(doc => doc.exists).map(doc => ({ id: doc.id, ...doc.data() } as Role));

    if (userRoles.length === 0) {
        console.warn(`[verifyUserRole] Role definitions not found for role IDs: [${userRoleIds.join(', ')}].`);
        return { authorized: false, message: 'Role definitions not found.', status: 403 };
    }

    // 6. Aggregate permissions and perform the final check.
    const [moduleSlug, action = 'can_access'] = requiredPermission.split(':');
    let hasPerm = false;

    // Check for platform owner super-admin privilege
    if (isPlatformUser && userRoleIds.includes('platform-owner')) {
        hasPerm = true;
    } else {
        for (const role of userRoles) {
          if (!role.permissions) continue; // Safety check
          const permissionsForModule = role.permissions[moduleSlug];
          if (permissionsForModule === true || permissionsForModule?.manage === true) {
            hasPerm = true;
            break;
          }
          if (typeof permissionsForModule === 'object' && permissionsForModule?.[action as keyof ModulePermissions] === true) {
            hasPerm = true;
            break;
          }
        }
    }

    if (!hasPerm) {
        console.warn(`[verifyUserRole] Denied: User ${userId} (Roles: ${userRoles.map(r=>r.name).join(', ')}) for action [${requiredPermission}].`);
        return { authorized: false, message: `Forbidden: Missing required permission (${requiredPermission})`, status: 403 };
    }

    return { authorized: true, userId, companyId: userCompanyId, userProfile: userProfileData };

  } catch (error: any) {
      console.error(`[verifyUserRole] Internal Firestore error for user ${userId}:`, error);
      return { authorized: false, message: `Internal server error during permission check: ${error.message}`, status: 500 };
  }
}
