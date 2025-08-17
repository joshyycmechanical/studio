
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, authAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { UserProfile } from '@/types/user';
import type { Role, ModulePermissions } from '@/types/role';
import type { Module } from '@/types/module';
import { Timestamp } from 'firebase-admin/firestore';
import { allPlatformModules } from '@/lib/roles-data';
import { defaultCompanyModules } from '@/lib/default-modules';

// Helper to convert Timestamps to ISO strings for JSON serialization
const convertTimestampsToISO = (data: any): any => {
    if (!data) return null;
    const newObj: { [key: string]: any } = {};
    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            newObj[key] = value.toDate().toISOString();
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            newObj[key] = convertTimestampsToISO(value); // Recurse for nested objects
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};

// Helper function to create a full access permission object
function createFullAccess(canAccess = true): ModulePermissions {
  return {
    can_access: canAccess, view: canAccess, create: canAccess, edit: canAccess, delete: canAccess,
    assign: canAccess, approve: canAccess, send: canAccess, manage_status: canAccess,
    process_payment: canAccess, link_qr: canAccess, transfer: canAccess, ocr: canAccess,
    recurring: canAccess, convert: canAccess, fill: canAccess, live: canAccess,
    upload: canAccess, manage: canAccess, generate: canAccess, resolve: canAccess,
    impersonate: canAccess, export: canAccess,
  };
}


export async function GET(request: NextRequest) {
  const routePath = `/api/users/me/profile GET`;
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    console.error(`[${routePath}] Admin initialization error:`, adminInitializationError);
    return NextResponse.json({ message: `Server configuration error: ${adminInitializationError.message}` }, { status: 503 });
  }
  if (!dbAdmin || !authAdmin) {
    console.error(`[${routePath}] Server configuration error: DB or Auth not initialized`);
    return NextResponse.json({ message: 'Server configuration error: DB or Auth not initialized' }, { status: 503 });
  }

  // Any authenticated user can try to fetch their own profile.
  const authResult = await verifyUserRole(request, '*');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }
  const { userId, companyId } = authResult;

  try {
    const userProfileSnap = await dbAdmin.collection(COLLECTIONS.USERS).doc(userId).get();

    if (!userProfileSnap.exists) {
        return NextResponse.json({ message: "User profile not found. Please complete onboarding or contact support.", code: "USER_PROFILE_NOT_FOUND" }, { status: 404 });
    }

    const userProfileData = userProfileSnap.data() as UserProfile;

    let fetchedRoles: Role[] = [];
    let installedModules: Module[] = [];
    let companyName: string | null = null;
    
    // Fetch role links to get role IDs
    const userRolesLinkRef = dbAdmin.collection(COLLECTIONS.USER_ROLES);
    const userRolesQuery = await userRolesLinkRef.where('user_id', '==', userId).get();
    const userRoleIds = userRolesQuery.docs.map(doc => doc.data().role_id as string);

    if (userRoleIds.length > 0) {
        const roleRefs = userRoleIds.map(id => dbAdmin.collection(COLLECTIONS.ROLES).doc(id));
        if (roleRefs.length > 0) {
            const roleDocs = await dbAdmin.getAll(...roleRefs);
            fetchedRoles = roleDocs.filter(doc => doc.exists).map(doc => ({ id: doc.id, ...doc.data() } as Role));
        }
    }

    // --- RESTORED PERMISSION AGGREGATION LOGIC (WITH SAFETY CHECKS) ---
    const aggregatedPermissions: { [moduleSlug: string]: any } = {};
    for (const role of fetchedRoles) {
        if (!role || typeof role.permissions !== 'object' || role.permissions === null) continue;
        for (const [moduleSlug, perms] of Object.entries(role.permissions)) {
            if (!perms) continue;
            if (!aggregatedPermissions[moduleSlug]) aggregatedPermissions[moduleSlug] = { can_access: false };
            if (typeof perms === 'boolean' && perms) {
                aggregatedPermissions[moduleSlug] = createFullAccess(true);
            } else if (typeof perms === 'object' && perms !== null) {
                for (const [action, value] of Object.entries(perms)) {
                    if (value === true) (aggregatedPermissions[moduleSlug])[action] = true;
                }
                if (Object.values(perms).some(v => v === true)) (aggregatedPermissions[moduleSlug] as ModulePermissions).can_access = true;
            }
        }
    }

    if (companyId) {
        const companySnap = await dbAdmin.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
        if (companySnap.exists) {
            companyName = companySnap.data()?.name || null;
            const modulesSnap = await dbAdmin.collection(COLLECTIONS.COMPANY_MODULES).where('company_id', '==', companyId).get();
            const installedSlugs = new Set(modulesSnap.docs.map(doc => doc.data().module_slug));
            installedModules = allPlatformModules.filter(m => installedSlugs.has(m.slug));
        } else {
             installedModules = [];
        }
    } else { // Platform user
        companyName = 'Platform';
        installedModules = allPlatformModules.filter(mod => mod.group === 'platform_admin' || mod.group === 'dashboard');
    }
    
    const finalUserProfile: Partial<UserProfile> = {
      ...userProfileData,
      id: userId,
      permissions: aggregatedPermissions,
      modules: installedModules,
      companyName: companyName,
      is_onboarding_complete: !!userProfileData.full_name,
      roleNames: fetchedRoles.map(r => r.name), // Add role names
    };

    return NextResponse.json(convertTimestampsToISO(finalUserProfile), { status: 200 });

  } catch (error: any) {
    console.error(`[${routePath}] Error fetching full user profile for UID ${userId}:`, error); // Log full error
    return NextResponse.json({ message: `API Error: ${error instanceof Error ? error.message : JSON.stringify(error)}` }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const routePath = `/api/users/me/profile PUT`;
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    return NextResponse.json({ message: `Server configuration error: ${adminInitializationError.message}` }, { status: 503 });
  }
   if (!dbAdmin || !authAdmin) {
    return NextResponse.json({ message: 'Server configuration error: DB or Auth not initialized' }, { status: 503 });
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
    const { id: profileId, ...updateData } = body;

    // Security Check: Ensure the user is updating their own profile
    if (userId !== profileId) {
      console.warn(`[${routePath}] Unauthorized attempt to update profile. Requester: ${userId}, Target: ${profileId}`);
      return NextResponse.json({ message: 'Unauthorized: You can only update your own profile.' }, { status: 403 });
    }

    const userProfileRef = dbAdmin.collection(COLLECTIONS.USERS).doc(profileId);
    
    const finalUpdateData = {
        ...updateData,
        updated_at: Timestamp.now(), // Add updated timestamp
    };
    
    await userProfileRef.update(finalUpdateData);

    return NextResponse.json({ message: 'Profile updated successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`[${routePath}] Error updating profile for UID ${userId}:`, error);
    return NextResponse.json({ message: `API Error: ${error instanceof Error ? error.message : JSON.stringify(error)}` }, { status: 500 });
  }
}
