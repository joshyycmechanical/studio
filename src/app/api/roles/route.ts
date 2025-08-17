

import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Role } from '@/types/role';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import admin from 'firebase-admin';

// Schema for creating a new role
const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional().nullable(),
  permissions: z.record(z.any()).optional().default({}),
});


export async function GET(request: NextRequest) {
  const routePath = `/api/roles GET`;
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  }

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ message: 'companyId query parameter is required' }, { status: 400 });
  }

  // A user should be able to view their own company's roles, or a platform admin can view any.
  // The 'users:view' permission is a good proxy for this, as user management requires role info.
  // This first check will work for company admins requesting their own data.
  const { authorized, error, status } = await verifyUserRole(request, 'users:view', companyId);

  // If the first check fails, it might be a platform admin who doesn't have the 'users:view' permission for this company.
  // So, we do a second check for the platform-level permission.
  if (!authorized) {
    console.log(`[${routePath}] First permission check for 'users:view' failed. Checking for platform-level access...`);
    const platformAuth = await verifyUserRole(request, 'platform-companies:view');
    if (!platformAuth.authorized) {
        console.error(`[${routePath}] All permission checks failed. User is not authorized.`);
        return NextResponse.json({ message: error || 'Unauthorized' }, { status: status || 403 });
    }
  }


  try {
    const rolesRef = dbAdmin.collection(COLLECTIONS.ROLES);
    // Removed .orderBy('name') to avoid needing a composite index. Sorting is now done in-memory below.
    const q = rolesRef.where('company_id', '==', companyId);
    const snapshot = await q.get();

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const roles: Role[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description ?? null,
        company_id: data.company_id,
        is_template: data.is_template ?? false,
        permissions: data.permissions ?? {},
        created_at: (data.created_at as Timestamp)?.toDate() ?? new Date(0),
      };
    });
    
    // Sort the results here instead of in the query
    roles.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(roles, { status: 200 });

  } catch (err: any) {
    console.error(`[${routePath}] Error fetching roles for company ${companyId}:`, err);
    if (err.code === 9 || err.message?.includes('The query requires an index')) {
        console.error(`[${routePath}] Firestore index missing. This is likely the cause of the failure.`);
        return NextResponse.json({ message: 'Database query failed, likely due to a missing Firestore index for roles.', detail: err.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Failed to fetch roles', detail: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const routePath = `/api/roles POST`;
  console.log(`[${routePath}] Route handler invoked.`);

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ message: 'companyId query parameter is required' }, { status: 400 });
  }

  if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  
  const { authorized, userId } = await verifyUserRole(request, 'platform-companies:edit', companyId);
  if (!authorized || !userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  try {
    const body = await request.json();
    const validation = createRoleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
    }
    
    const { name, description, permissions } = validation.data;
    
    const newRoleData = {
      name,
      description: description ?? null,
      permissions: permissions ?? {},
      company_id: companyId,
      is_template: false,
      created_at: Timestamp.now(),
    };
    
    const docRef = await dbAdmin.collection(COLLECTIONS.ROLES).add(newRoleData);
    const newDoc = await docRef.get();
    
    return NextResponse.json({ id: newDoc.id, ...newDoc.data() }, { status: 201 });
  } catch (error: any) {
    console.error(`[${routePath}] Error creating role for company ${companyId}:`, error);
    return NextResponse.json({ message: 'Failed to create role', detail: error.message }, { status: 500 });
  }
}
