
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Repair, MaterialUsed } from '@/types/repair';
import type { WorkOrderLineItem } from '@/types/work-order';
import type admin from 'firebase-admin';

// POST a new repair record. This now also handles updating the associated work order.
export async function POST(request: NextRequest) {
    const routePath = `/api/repairs POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, userId } = await verifyUserRole(request, 'repairs:create');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const data = await request.json();
        
        const newRepairData: Omit<Repair, 'id'> = {
            ...data,
            company_id: companyId,
            technician_id: userId, // Assume the logger is the technician
            created_at: Timestamp.now(),
            repair_date: data.repair_date ? Timestamp.fromDate(new Date(data.repair_date)) : Timestamp.now(),
            materials_used: data.materials_used || [],
        };
        
        // Use a transaction to create the repair and update the work order atomically
        await dbAdmin.runTransaction(async (transaction) => {
            const repairRef = dbAdmin.collection(COLLECTIONS.REPAIRS).doc();
            transaction.set(repairRef, newRepairData);
            console.log(`[${routePath}] Queued new repair document for creation (ID will be ${repairRef.id})`);

            // If the repair is linked to a work order, add materials as line items
            if (data.work_order_id && data.materials_used?.length > 0) {
                const woRef = dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(data.work_order_id);
                
                // We must read the work order first to ensure it exists and belongs to the company
                const woSnap = await transaction.get(woRef);
                if (!woSnap.exists || woSnap.data()?.company_id !== companyId) {
                    throw new Error("Work order not found or access denied.");
                }

                const newLineItems: WorkOrderLineItem[] = data.materials_used.map((material: MaterialUsed) => ({
                    id: `repair_material_${repairRef.id}_${Math.random().toString(36).substring(2, 9)}`,
                    description: material.description,
                    quantity: material.quantity,
                    unit_price: material.unit_cost, // Using cost as price - adjust if different
                    item_type: 'part',
                }));
                
                transaction.update(woRef, {
                    line_items: FieldValue.arrayUnion(...newLineItems),
                    updated_at: Timestamp.now(),
                    updated_by: userId,
                });
                console.log(`[${routePath}] Queued update to add ${newLineItems.length} line items to Work Order ${data.work_order_id}`);
            }
        });

        // The transaction has completed successfully.
        // We can't easily return the new repair ID from within the transaction,
        // so we return a generic success message. The client should refetch data.
        return NextResponse.json({ message: 'Repair logged successfully.' }, { status: 201 });

    } catch (err: any) {
        console.error(`[${routePath}] Error creating repair:`, err);
        return NextResponse.json({ message: 'Failed to create repair record', detail: err.message }, { status: 500 });
    }
}


// You can also add a GET handler here to fetch all repairs if needed,
// similar to other /api/[resource]/route.ts files.
export async function GET(request: NextRequest) {
    const routePath = `/api/repairs GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, error, status } = await verifyUserRole(request, 'repairs:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }
    
     const { searchParams } = new URL(request.url);
     const workOrderId = searchParams.get('workOrderId');

    try {
        let query: admin.firestore.Query<admin.firestore.DocumentData> = dbAdmin.collection(COLLECTIONS.REPAIRS)
            .where('company_id', '==', companyId);

        if (workOrderId) {
            query = query.where('work_order_id', '==', workOrderId);
        }
        
        const snapshot = await query.get();

        const repairs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                repair_date: (data.repair_date as Timestamp)?.toDate()?.toISOString(),
                created_at: (data.created_at as Timestamp)?.toDate()?.toISOString(),
            };
        });

        // Sort in memory to avoid needing a composite index
        repairs.sort((a, b) => new Date(b.repair_date).getTime() - new Date(a.repair_date).getTime());
        
        return NextResponse.json(repairs, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching repairs for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch repairs', detail: err.message }, { status: 500 });
    }
}
