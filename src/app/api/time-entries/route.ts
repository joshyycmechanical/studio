
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import {Query} from "firebase-admin/firestore";

// Helper to convert Timestamps to ISO strings
const convertTimestampsToISO = (data: any) => {
    for (const key in data) {
        if (data[key] instanceof Timestamp) {
            data[key] = data[key].toDate().toISOString();
        }
    }
    return data;
};

// GET all time entries for a company, with optional filtering
export async function GET(request: NextRequest) {
    const routePath = `/api/time-entries GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    // Assuming a 'timesheets:view' permission
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'timesheets:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const workOrderId = searchParams.get('workOrderId');

        let query: Query = dbAdmin.collection(COLLECTIONS.TIME_ENTRIES).where('company_id', '==', companyId);

        if (workOrderId) {
            query = query.where('work_order_id', '==', workOrderId);
        }
        
        const snapshot = await query.orderBy('start_time', 'desc').get();
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestampsToISO(doc.data()) }));
        
        return NextResponse.json(entries, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error fetching time entries:`, err);
        return NextResponse.json({ message: 'Failed to fetch time entries', detail: err.message }, { status: 500 });
    }
}

// POST a new time entry
export async function POST(request: NextRequest) {
    const routePath = `/api/time-entries POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });

    // Assuming a 'timesheets:create' permission
    const { authorized, companyId, userId, error, status } = await verifyUserRole(request, 'timesheets:create');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const entryData = await request.json();

        const newEntry = {
            ...entryData,
            company_id: companyId,
            user_id: userId, // The user creating the entry
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            start_time: Timestamp.fromDate(new Date(entryData.start_time)),
            end_time: Timestamp.fromDate(new Date(entryData.end_time)),
        };

        const docRef = await dbAdmin.collection(COLLECTIONS.TIME_ENTRIES).add(newEntry);
        const newDoc = await docRef.get();
        
        return NextResponse.json({ id: newDoc.id, ...convertTimestampsToISO(newDoc.data()) }, { status: 201 });

    } catch (err: any) {
        console.error(`[${routePath}] Error creating time entry:`, err);
        return NextResponse.json({ message: 'Failed to create time entry', detail: err.message }, { status: 500 });
    }
}
