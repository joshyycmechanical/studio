
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    const routePath = `/api/users/me/clock-in POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, userId, error, status } = await verifyUserRole(request, 'timesheets:create');
    if (!authorized || !userId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { work_order_id } = await request.json();
        if (!work_order_id) {
            return NextResponse.json({ message: 'work_order_id is required' }, { status: 400 });
        }

        const userRef = dbAdmin.collection(COLLECTIONS.USERS).doc(userId);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return NextResponse.json({ message: 'User profile not found' }, { status: 404 });
        }

        if (userSnap.data()?.active_timer) {
            return NextResponse.json({ message: 'User is already clocked in' }, { status: 409 }); // 409 Conflict
        }

        const activeTimer = {
            work_order_id,
            start_time: Timestamp.now(),
        };

        await userRef.update({ active_timer: activeTimer });

        console.log(`[${routePath}] User ${userId} clocked in for WO ${work_order_id}.`);
        return NextResponse.json(convertTimestampsToISO(activeTimer), { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error clocking in user ${userId}:`, err);
        return NextResponse.json({ message: 'Failed to clock in', detail: err.message }, { status: 500 });
    }
}

// Helper to convert Timestamp to ISO string
const convertTimestampsToISO = (data: any) => {
    if (data.start_time instanceof Timestamp) {
        data.start_time = data.start_time.toDate().toISOString();
    }
    return data;
};
