
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { WorkOrder } from '@/types/work-order';

// This is a PUBLIC API route. It does NOT require authentication.
// It must be carefully designed to prevent abuse.

const serviceRequestSchema = z.object({
  equipmentId: z.string().min(1),
  description: z.string().min(10),
  contact_name: z.string().min(1),
  contact_phone: z.string().min(1),
  contact_email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
    const routePath = `/api/public/service-requests POST`;
    console.log(`[${routePath}] Public route invoked.`);
    
    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    if (!dbAdmin) {
        return NextResponse.json({ message: 'Database service not available' }, { status: 503 });
    }
    
    try {
        const body = await request.json();
        const validation = serviceRequestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }
        
        const { equipmentId, description, contact_name, contact_phone, contact_email } = validation.data;

        // 1. Fetch the equipment to get its company and customer context
        const equipmentRef = dbAdmin.collection(COLLECTIONS.EQUIPMENT).doc(equipmentId);
        const equipmentSnap = await equipmentRef.get();
        if (!equipmentSnap.exists) {
            return NextResponse.json({ message: 'Equipment not found' }, { status: 404 });
        }
        const equipmentData = equipmentSnap.data()!;
        
        const { company_id, customer_id, location_id, name: equipmentName } = equipmentData;
        if (!company_id || !customer_id || !location_id) {
            throw new Error(`Equipment ${equipmentId} is missing company, customer, or location context.`);
        }

        // 2. Create the new work order
        const workOrderRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc();
        const nextWoNumber = `WO-${Date.now().toString().slice(-6)}`;

        const newWorkOrderData: Omit<WorkOrder, 'id'> = {
            company_id,
            customer_id,
            location_id,
            equipment_id,
            work_order_number: nextWoNumber,
            status: 'new',
            priority: 'medium',
            summary: `Service Request for ${equipmentName}`,
            description: `A new service request was submitted via QR code.\n\nReported Issue: ${description}\n\nContact Name: ${contact_name}\nContact Phone: ${contact_phone}\nContact Email: ${contact_email || 'Not provided'}`,
            type: 'service-request',
            created_at: Timestamp.now(),
            created_by: 'public_qr_request', // System identifier
        };

        await workOrderRef.set(newWorkOrderData);
        
        console.log(`[${routePath}] Successfully created WO ${workOrderRef.id} for company ${company_id} from public request.`);
        
        // TODO: Trigger a notification to the company's dispatcher/admin.

        return NextResponse.json({ message: 'Service request submitted successfully.', work_order_number: nextWoNumber }, { status: 201 });

    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to submit service request', detail: err.message }, { status: 500 });
    }
}
