
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['active', 'inactive']),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  billing_notes: z.string().optional().nullable(),
  billing_email: z.string().email('Invalid billing email').optional().nullable(),
  billing_address_line1: z.string().optional().nullable(),
  billing_address_line2: z.string().optional().nullable(),
  billing_city: z.string().optional().nullable(),
  billing_province: z.string().optional().nullable(),
  billing_postal_code: z.string().optional().nullable(),
  billing_country: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
    const routePath = `/api/customers GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, error, status } = await verifyUserRole(request, 'customers:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const customersRef = dbAdmin.collection(COLLECTIONS.CUSTOMERS);
        const snapshot = await customersRef.where('company_id', '==', companyId).get();

        const customers = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                created_at: (data.created_at as Timestamp)?.toDate()?.toISOString(),
            };
        });
        
        customers.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json(customers, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching customers for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch customers', detail: err.message }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
  const routePath = '/api/customers POST';
  console.log(`[${routePath}] Route handler invoked.`);

  if (adminInitializationError) {
    return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
  }

  const authResult = await verifyUserRole(request, 'customers:create');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }

  const { companyId, userId } = authResult;

  if (!companyId) {
    return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 403 });
  }
  
  try {
    const body = await request.json();
    const validation = createCustomerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
    }

    const newCustomerData = {
      ...validation.data,
      company_id: companyId,
      created_by: userId,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      updated_by: userId,
    };

    const docRef = await dbAdmin.collection(COLLECTIONS.CUSTOMERS).add(newCustomerData);
    const newDoc = await docRef.get();

    return NextResponse.json({ id: newDoc.id, ...newDoc.data() }, { status: 201 });
  } catch (err: any) {
    console.error(`[${routePath}] Error:`, err);
    return NextResponse.json({ message: 'Failed to create customer', detail: err.message }, { status: 500 });
  }
}
