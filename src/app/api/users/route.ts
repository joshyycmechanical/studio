
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { UserProfile, UserProfileWithRoles } from '@/types/user';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  const routePath = `/api/users GET`;
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  }

  // First, verify the token and get the requesting user's identity and companyId.
  const authResult = await verifyUserRole(request, '*'); // Use '*' just to get user context
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }
  const { userId: requestingUserId, companyId: requestingCompanyId } = authResult;

  const targetCompanyId = request.nextUrl.searchParams.get('companyId');
  if (!targetCompanyId) {
    return NextResponse.json({ message: 'companyId query parameter is required' }, { status: 400 });
  }

  // --- New, Clearer Security Logic ---
  const isPlatformAdmin = requestingCompanyId === null;
  const isRequestingOwnCompany = requestingCompanyId === targetCompanyId;

  // Deny access if the user is NOT a platform admin AND is trying to access a different company's data.
  if (!isPlatformAdmin && !isRequestingOwnCompany) {
    console.warn(`[API /users GET] Forbidden Access Attempt: User ${requestingUserId} from company ${requestingCompanyId} tried to access users from company ${targetCompanyId}.`);
    return NextResponse.json({ message: 'Forbidden: You can only request users for your own company.' }, { status: 403 });
  }

  try {
    // Proceed to fetch the data for the targetCompanyId, as the user is authorized.
    const usersQuery = await dbAdmin.collection(COLLECTIONS.USERS).where('company_id', '==', targetCompanyId).get();
    const rolesQuery = await dbAdmin.collection(COLLECTIONS.USER_ROLES).where('company_id', '==', targetCompanyId).get();

    const rolesByUserId = new Map<string, string[]>();
    rolesQuery.forEach(doc => {
      const data = doc.data();
      const userId = data.user_id;
      if (!rolesByUserId.has(userId)) {
        rolesByUserId.set(userId, []);
      }
      rolesByUserId.get(userId)!.push(data.role_id);
    });

    const usersWithRoles: UserProfileWithRoles[] = usersQuery.docs.map(doc => {
      const userData = doc.data() as UserProfile;
      return {
        ...userData,
        id: doc.id,
        created_at: (userData.created_at as Timestamp)?.toDate(),
        last_login: userData.last_login ? (userData.last_login as Timestamp)?.toDate() : null,
        roles: rolesByUserId.get(doc.id) || [],
      };
    });

    return NextResponse.json(usersWithRoles, { status: 200 });

  } catch (error: any) {
    console.error(`[${routePath}] Error fetching users for company ${targetCompanyId}:`, error);
    return NextResponse.json({ message: 'Failed to fetch users', detail: error.message }, { status: 500 });
  }
}
