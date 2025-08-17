
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { Customer } from '@/types/customer';
import admin from 'firebase-admin';

interface RouteParams {
  params: { customerId: string };
}

// Zod schema for updating a customer. All fields are optional.
const updateCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email('Invalid email format').optional().or(z.literal('')).nullable(),
  contact_phone: z.string().optional().nullable(),
  billing_notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  billing_email: z.string().email('Invalid billing email').optional().nullable(),
  billing_address_line1: z.string().optional().nullable(),
  billing_address_line2: z.string().optional().nullable(),
  billing_city: z.string().optional().nullable(),
  billing_province: z.string().optional().nullable(),
  billing_postal_code: z.string().optional().nullable(),
  billing_country: z.string().optional().nullable(),
});

// Helper to convert Firestore Timestamps to ISO strings for JSON response
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

// GET a single customer by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/customers/${params.customerId} GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'customers:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { customerId } = params;
        const docRef = dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc(customerId);
        const docSnap = await docRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Customer not found or access denied' }, { status: 404 });
        }
        
        const customer = convertTimestampsToISO({ id: docSnap.id, ...docSnap.data() });
        return NextResponse.json(customer, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching customer:`, err);
        return NextResponse.json({ message: 'Failed to fetch customer', detail: err.message }, { status: 500 });
    }
}

// UPDATE an existing customer (Rewritten for stability)
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/customers/${params.customerId} PUT`;
    console.log(`[${routePath}] Route handler invoked.`);
    
    try {
        if (adminInitializationError) {
            throw new Error(`Server configuration error: ${adminInitializationError.message}`);
        }

        const authResult = await verifyUserRole(request, 'customers:edit');
        if (!authResult.authorized) {
            return NextResponse.json({ message: authResult.message }, { status: authResult.status });
        }
        const { companyId, userId } = authResult;
        const { customerId } = params;

        if (!companyId || !customerId) {
            return NextResponse.json({ message: 'Company or Customer ID is missing.' }, { status: 400 });
        }

        const body = await request.json();
        const validation = updateCustomerSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        
        const customerRef = dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc(customerId);
        const docSnap = await customerRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Customer not found or access denied' }, { status: 404 });
        }

        const validatedData = validation.data;
        const updatePayload: { [key: string]: any } = {};
        
        // This dynamically adds only the fields that were passed in the request body
        Object.keys(validatedData).forEach(key => {
             updatePayload[key] = (validatedData as any)[key];
        });

        if (Object.keys(updatePayload).length > 0) {
            updatePayload.updated_at = Timestamp.now();
            updatePayload.updated_by = userId;
            await customerRef.update(updatePayload);
        }
        
        const updatedDoc = await customerRef.get();
        return NextResponse.json(convertTimestampsToISO({ id: updatedDoc.id, ...updatedDoc.data() }), { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] An unexpected error occurred:`, err);
        return NextResponse.json({ message: 'Failed to update customer', detail: err.message }, { status: 500 });
    }
}


// DELETE a customer by ID
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/customers/${params.customerId} DELETE`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'customers:delete');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { customerId } = params;
        const customerRef = dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc(customerId);
        const docSnap = await customerRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Customer not found or access denied' }, { status: 404 });
        }

        // TODO: Implement cascading delete logic (e.g., delete locations, work orders for this customer)
        // This is a complex operation and should be handled with care, possibly via a Cloud Function.
        console.warn(`[${routePath}] Deleting customer ${customerId}. Associated data (locations, work orders) is NOT being deleted automatically.`);

        await customerRef.delete();

        return new NextResponse(null, { status: 204 }); // Success, no content

    } catch (err: any) {
        console.error(`[${routePath}] Error deleting customer:`, err);
        return NextResponse.json({ message: 'Failed to delete customer', detail: err.message }, { status: 500 });
    }
}
