
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError, authAdmin } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { processWorkflowTriggers } from '@/services/workflows';
import type { WorkOrder } from '@/types/work-order';

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

// GET a single work order by ID, populating related data
export async function GET(request: NextRequest, { params }: { params: { workOrderId: string } }) {
    const routePath = `/api/work-orders/${params.workOrderId} GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        console.error(`[${routePath}] Admin SDK initialization error.`);
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, 'work-orders:view');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId } = authResult;

    try {
        const { workOrderId } = params;
        if (!workOrderId) {
            return NextResponse.json({ message: 'Work Order ID is missing' }, { status: 400 });
        }

        const woRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
        const docSnap = await woRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Work Order not found' }, { status: 404 });
        }

        const workOrderData = docSnap.data();
        if (!workOrderData) {
            return NextResponse.json({ message: 'Work Order data is invalid' }, { status: 500 });
        }

        let customerData = {};
        if (workOrderData.customer_id) {
            const customerSnap = await dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc(workOrderData.customer_id).get();
            if (customerSnap.exists) {
                const cust = customerSnap.data();
                customerData = {
                    customer_name: cust?.name,
                    customer_email: cust?.contact_email,
                    customer_phone: cust?.contact_phone,
                };
            }
        }

        let locationData = {};
        if (workOrderData.location_id) {
            const locationSnap = await dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(workOrderData.location_id).get();
            if (locationSnap.exists) {
                const loc = locationSnap.data();
                locationData = {
                    location_name: loc?.name,
                    location_address: `${loc?.address_line1}, ${loc?.city}`,
                };
            }
        }
        
        let assignedToData: string[] = [];
        if (workOrderData.assigned_technician_id && typeof workOrderData.assigned_technician_id === 'string') {
            try {
                const userRecord = await authAdmin.getUser(workOrderData.assigned_technician_id);
                assignedToData = [userRecord.displayName || userRecord.email || 'Unnamed User'];
            } catch (userError) {
                console.error(`[${routePath}] Error fetching assigned user ${workOrderData.assigned_technician_id}:`, userError);
                assignedToData = ['Unknown User'];
            }
        }

        const populatedData = {
            id: docSnap.id,
            ...workOrderData,
            ...customerData,
            ...locationData,
            assigned_to: assignedToData,
        };

        return NextResponse.json(convertTimestampsToISO(populatedData), { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching work order:`, err);
        return NextResponse.json({ message: 'Failed to fetch work order', detail: err.message }, { status: 500 });
    }
}

// UPDATE a work order by ID
export async function PUT(request: NextRequest, { params }: { params: { workOrderId: string } }) {
    const routePath = `/api/work-orders/${params.workOrderId} PUT`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    
    const authResult = await verifyUserRole(request, 'work-orders:edit');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId, userId } = authResult;

    try {
        const { workOrderId } = params;
        const updateData = await request.json();

        const woRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
        const docSnap = await woRef.get();
        const originalData = docSnap.data();

        if (!docSnap.exists || originalData?.company_id !== companyId) {
            return NextResponse.json({ message: 'Work Order not found or access denied' }, { status: 404 });
        }
        
        // Convert date string from client back to Firestore Timestamp for scheduled_date
        if (updateData.scheduled_date) {
            updateData.scheduled_date = Timestamp.fromDate(new Date(updateData.scheduled_date));
        }

        if (updateData.attachments && Array.isArray(updateData.attachments)) {
            await woRef.update({
                attachments: FieldValue.arrayUnion(...updateData.attachments)
            });
            delete updateData.attachments;
        }

        const finalUpdateData: { [key: string]: any } = {
            ...updateData,
            updated_at: Timestamp.now(),
            updated_by: userId,
        };
        
        delete finalUpdateData.id;
        delete finalUpdateData.company_id;
        delete finalUpdateData.created_by;
        delete finalUpdateData.created_at;

        await woRef.update(finalUpdateData);

        if (updateData.status && originalData && updateData.status !== originalData.status) {
            if (companyId) {
                processWorkflowTriggers(workOrderId, companyId, updateData.status, 'on_enter')
                    .catch(err => console.error(`[Workflow] Async trigger failed for WO ${workOrderId}:`, err));
            }
        }

        const updatedDoc = await woRef.get();
        const updatedDocData = updatedDoc.data();
        
        return NextResponse.json(convertTimestampsToISO({ id: updatedDoc.id, ...updatedDocData }), { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error updating work order:`, err);
        return NextResponse.json({ message: 'Failed to update work order', detail: err.message }, { status: 500 });
    }
}

// DELETE a work order by ID
export async function DELETE(request: NextRequest, { params }: { params: { workOrderId: string } }) {
    const routePath = `/api/work-orders/${params.workOrderId} DELETE`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    const authResult = await verifyUserRole(request, 'work-orders:delete');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId } = authResult;

    try {
        const { workOrderId } = params;
        const woRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId);
        const docSnap = await woRef.get();

        if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
            return NextResponse.json({ message: 'Work Order not found or access denied' }, { status: 404 });
        }

        await woRef.delete();

        return new NextResponse(null, { status: 204 });
    } catch (err: any) {
        console.error(`[${routePath}] Error deleting work order:`, err);
        return NextResponse.json({ message: 'Failed to delete work order', detail: err.message }, { status: 500 });
    }
}
