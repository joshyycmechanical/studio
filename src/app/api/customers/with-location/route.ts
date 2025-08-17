
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';

// Schemas for validating the incoming data
const quickAddCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const quickAddLocationSchema = z.object({
    name: z.string().min(1, 'Location name is required'),
    address_line1: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    province: z.string().min(1, 'Province/State is required'),
    postal_code: z.string().min(1, 'Postal/Zip Code is required'),
    country: z.string().optional().default('USA'),
    location_type: z.enum(['restaurant', 'warehouse', 'office', 'residential', 'other']).default('other'),
});

const requestSchema = z.object({
    customerData: quickAddCustomerSchema,
    locationData: quickAddLocationSchema,
});


export async function POST(request: NextRequest) {
    const routePath = `/api/customers/with-location POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, userId } = await verifyUserRole(request, 'customers:create'); // Re-use customer create permission
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    
    try {
        const body = await request.json();
        const validation = requestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        
        const { customerData, locationData } = validation.data;
        
        const batch = dbAdmin.batch();
        
        // 1. Create Customer
        const customerRef = dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc();
        const newCustomerData = {
            ...customerData,
            status: 'active', // Default status
            company_id: companyId,
            created_by: userId,
            created_at: Timestamp.now(),
        };
        batch.set(customerRef, newCustomerData);

        // 2. Create Location linked to the new customer
        const locationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc();
        const newLocationData = {
            ...locationData,
            company_id: companyId,
            customer_id: customerRef.id,
            equipment_count: 0,
            created_at: Timestamp.now(),
        };
        batch.set(locationRef, newLocationData);
        
        // 3. Commit the batch
        await batch.commit();

        // 4. Get the created docs to return them
        const newCustomerSnap = await customerRef.get();
        const newLocationSnap = await locationRef.get();

        const customerResult = { id: newCustomerSnap.id, ...newCustomerSnap.data() };
        const locationResult = { id: newLocationSnap.id, ...newLocationSnap.data() };

        // Convert Timestamps for client
        if (customerResult.created_at) customerResult.created_at = (customerResult.created_at as Timestamp).toDate().toISOString();
        if (locationResult.created_at) locationResult.created_at = (locationResult.created_at as Timestamp).toDate().toISOString();

        return NextResponse.json({
            customer: customerResult,
            location: locationResult,
        }, { status: 201 });

    } catch (error: any) {
        console.error(`[${routePath}] Error creating customer with location:`, error);
        return NextResponse.json({ message: 'Failed to create customer and location', detail: error.message }, { status: 500 });
    }
}
