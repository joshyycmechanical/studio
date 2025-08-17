
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import type { Query } from 'firebase-admin/firestore';
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
            newObj[key] = convertTimestampsToISO(value);
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};

export async function GET(request: NextRequest) {
    const routePath = `/api/work-orders GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const authResult = await verifyUserRole(request, '*');
    if (!authResult.authorized) {
        return NextResponse.json({ message: authResult.message }, { status: authResult.status });
    }
    const { companyId } = authResult;

    if (companyId === null) {
        // Platform admins do not have a company context for work orders
        return NextResponse.json([], { status: 200 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const locationId = searchParams.get('locationId');

        let workOrdersQuery: Query = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).where('company_id', '==', companyId);
        if (customerId) workOrdersQuery = workOrdersQuery.where('customer_id', '==', customerId);
        if (locationId) workOrdersQuery = workOrdersQuery.where('location_id', '==', locationId);
        
        const snapshot = await workOrdersQuery.get();

        const workOrdersPromises = snapshot.docs.map(async (doc) => {
            const workOrderData = doc.data();
            let customerData = {};
            if (workOrderData.customer_id) {
                const customerSnap = await dbAdmin.collection(COLLECTIONS.CUSTOMERS).doc(workOrderData.customer_id).get();
                if (customerSnap.exists) customerData = { customer_name: customerSnap.data()?.name || 'N/A' };
            }
            let locationData = {};
            if (workOrderData.location_id) {
                const locationSnap = await dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(workOrderData.location_id).get();
                if (locationSnap.exists) locationData = { location_name: locationSnap.data()?.name || 'N/A' };
            }
            return { id: doc.id, ...workOrderData, ...customerData, ...locationData };
        });

        const populatedWorkOrders = await Promise.all(workOrdersPromises);
        const workOrders = populatedWorkOrders.map(wo => convertTimestampsToISO(wo));
        workOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json(workOrders, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching work orders:`, err);
        return NextResponse.json({ message: 'Failed to fetch work orders', detail: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
  const routePath = `/api/work-orders POST`;
  console.log(`[${routePath}] Route handler invoked.`);
  if (adminInitializationError) {
    return new Response(JSON.stringify({ message: 'Server configuration error' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }

  const authResult = await verifyUserRole(request, 'work-orders:create');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }
  const { userId, companyId } = authResult;
  
  if (!companyId) {
      return NextResponse.json({ message: "Cannot create a work order without a company." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const nextWoNumber = `WO-${Date.now().toString().slice(-6)}`;
    
    // AI call has been removed to fix build error. A simple summary is created instead.
    let summary = body.summary;
    if (!summary && body.description) {
        summary = `${body.description.substring(0, 30)}...`;
    } else if (!summary) {
        summary = 'New Work Order';
    }

    const newWorkOrderData: Omit<WorkOrder, 'id'> = {
        ...body,
        summary,
        company_id: companyId,
        created_by: userId,
        created_at: Timestamp.now(),
        work_order_number: nextWoNumber,
        status: body.status || 'new',
        priority: body.priority || 'medium',
        scheduled_date: body.scheduled_date ? Timestamp.fromDate(new Date(body.scheduled_date)) : null,
        custom_fields: body.custom_fields || {},
    };
    
    const docRef = await dbAdmin.collection(COLLECTIONS.WORK_ORDERS).add(newWorkOrderData);
    const newDocSnap = await docRef.get();
    const createdWorkOrder = newDocSnap.data();

    return NextResponse.json(convertTimestampsToISO({
        id: newDocSnap.id,
        ...createdWorkOrder,
    }), { status: 201 });

  } catch (err: any) {
    console.error(`[${routePath}] Error during work order creation:`, err);
    return new Response(JSON.stringify({ message: 'Failed to create work order' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
