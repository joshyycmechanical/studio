
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Company } from '@/types/company';

export async function GET(request: NextRequest) {
    const routePath = `/api/platform/stats GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, error, status } = await verifyUserRole(request, 'platform-companies:view');
    if (!authorized) {
        return NextResponse.json({ message: error || 'Unauthorized' }, { status: status || 401 });
    }

    try {
        const companiesPromise = dbAdmin.collection(COLLECTIONS.COMPANIES).get();
        // Use .count() for efficient counting without retrieving all documents
        const usersPromise = dbAdmin.collection(COLLECTIONS.USERS).where('status', '==', 'active').count().get();

        const [companiesSnapshot, usersSnapshot] = await Promise.all([companiesPromise, usersPromise]);

        let totalCompanies = 0;
        let activeCompanies = 0;
        let pausedCompanies = 0;
        const subscriptions: { [plan: string]: number } = {};

        companiesSnapshot.forEach(doc => {
            const company = doc.data() as Company;
            if (company.status !== 'deleted') {
                totalCompanies++;
                if (company.status === 'active') activeCompanies++;
                if (company.status === 'paused') pausedCompanies++;
                subscriptions[company.subscription_plan] = (subscriptions[company.subscription_plan] || 0) + 1;
            }
        });

        const totalActiveUsers = usersSnapshot.data().count;

        const stats = {
            totalCompanies,
            activeCompanies,
            pausedCompanies,
            totalActiveUsers,
            subscriptions
        };

        return NextResponse.json(stats, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching platform stats:`, err);
        return NextResponse.json({ message: 'Failed to fetch platform stats', detail: err.message }, { status: 500 });
    }
}
