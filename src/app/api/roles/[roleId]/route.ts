

import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { Role } from '@/types/role';

interface RouteParams {
  params: { roleId: string };
}

const updateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').optional(),
  description: z.string().optional().nullable(),
  permissions: z.record(z.any()).optional(),
});


export async function PUT(request: NextRequest, { params }: RouteParams) {
  const routePath = `/api/roles/${params.roleId} PUT`;
  console.log(`[${routePath}] Route handler invoked.`);

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ message: 'companyId query parameter is required' }, { status: 400 });
  }
  const { roleId } = params;
  if (!roleId) {
      return NextResponse.json({ message: 'Role ID is required' }, { status: 400 });
  }

  if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  
  const { authorized, userId } = await verifyUserRole(request, 'platform-companies:edit', companyId);
  if (!authorized || !userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const roleRef = dbAdmin.collection(COLLECTIONS.ROLES).doc(roleId);
    const docSnap = await roleRef.get();
    if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
        return NextResponse.json({ message: 'Role not found or access denied' }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
    }
    
    const updateData = {
        ...validation.data,
        updated_at: Timestamp.now(),
    };

    await roleRef.update(updateData);
    
    const updatedDoc = await roleRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

  } catch (error: any) {
    console.error(`[${routePath}] Error updating role ${roleId}:`, error);
    return NextResponse.json({ message: 'Failed to update role', detail: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const routePath = `/api/roles/${params.roleId} DELETE`;
  console.log(`[${routePath}] Route handler invoked.`);
  
  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ message: 'companyId query parameter is required' }, { status: 400 });
  }
  const { roleId } = params;
  if (!roleId) {
      return NextResponse.json({ message: 'Role ID is required' }, { status: 400 });
  }

  if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  
  const { authorized } = await verifyUserRole(request, 'platform-companies:delete', companyId);
  if (!authorized) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  try {
    const roleRef = dbAdmin.collection(COLLECTIONS.ROLES).doc(roleId);
    const docSnap = await roleRef.get();
    if (!docSnap.exists() || docSnap.data()?.company_id !== companyId) {
        return NextResponse.json({ message: 'Role not found or access denied' }, { status: 404 });
    }

    // Security check: ensure the role is not currently assigned to any users.
    const userRolesQuery = await dbAdmin.collection(COLLECTIONS.USER_ROLES)
        .where('company_id', '==', companyId)
        .where('role_id', '==', roleId)
        .limit(1)
        .get();

    if (!userRolesQuery.empty) {
        return NextResponse.json({ message: `Cannot delete role "${docSnap.data()?.name}" as it is currently assigned to ${userRolesQuery.size} user(s).` }, { status: 409 });
    }
    
    await roleRef.delete();
    
    return new NextResponse(null, { status: 204 }); // No Content
  } catch (error: any) {
    console.error(`[${routePath}] Error deleting role ${roleId}:`, error);
    return NextResponse.json({ message: 'Failed to delete role', detail: error.message }, { status: 500 });
  }
}
