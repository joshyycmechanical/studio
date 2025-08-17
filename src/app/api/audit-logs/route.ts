
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { AuditLog } from '@/types/audit-log';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
    const routePath = `/api/audit-logs GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    // Only users with 'audit-logs:view' permission can access this.
    const { authorized, error, status } = await verifyUserRole(request, 'audit-logs:view');
    if (!authorized) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 100;

        const auditLogsRef = dbAdmin.collection(COLLECTIONS.AUDIT_LOGS);
        const snapshot = await auditLogsRef.orderBy('timestamp', 'desc').limit(limit).get();

        if (snapshot.empty) {
            return NextResponse.json([], { status: 200 });
        }

        const logs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: (data.timestamp as Timestamp)?.toDate() ?? new Date(0),
            };
        });

        return NextResponse.json(logs, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching audit logs:`, err);
        return NextResponse.json({ message: 'Failed to fetch audit logs', detail: err.message }, { status: 500 });
    }
}
