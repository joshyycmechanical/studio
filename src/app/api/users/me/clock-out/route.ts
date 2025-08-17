
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    const routePath = `/api/users/me/clock-out POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, userId, companyId, error, status } = await verifyUserRole(request, 'timesheets:create');
    if (!authorized || !userId || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { notes } = await request.json();
        const userRef = dbAdmin.collection(COLLECTIONS.USERS).doc(userId);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (!userData || !userData.active_timer) {
            return NextResponse.json({ message: 'User is not clocked in' }, { status: 400 });
        }

        const activeTimer = userData.active_timer;
        const startTime = (activeTimer.start_time as Timestamp).toDate();
        const endTime = new Date(); // Current server time
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);

        const newTimeEntry = {
            company_id: companyId,
            user_id: userId,
            work_order_id: activeTimer.work_order_id,
            start_time: activeTimer.start_time,
            end_time: Timestamp.fromDate(endTime),
            duration_hours: parseFloat(durationHours.toFixed(4)),
            entry_type: 'regular', // Or determine based on logic
            notes: notes || null,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        };
        
        // Use a transaction to ensure atomicity
        await dbAdmin.runTransaction(async (transaction) => {
            const timeEntryRef = dbAdmin.collection(COLLECTIONS.TIME_ENTRIES).doc();
            transaction.set(timeEntryRef, newTimeEntry);
            transaction.update(userRef, { active_timer: FieldValue.delete() });
        });

        console.log(`[${routePath}] User ${userId} clocked out. Created time entry.`);
        return NextResponse.json({ message: 'Successfully clocked out' }, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error clocking out user ${userId}:`, err);
        return NextResponse.json({ message: 'Failed to clock out', detail: err.message }, { status: 500 });
    }
}
