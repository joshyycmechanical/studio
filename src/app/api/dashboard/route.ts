
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';

// Fetch functions using the admin SDK
async function fetchCompanyData(companyId: string) {
    const [woSnap, customerSnap, locationSnap, equipmentSnap, invoiceSnap, userSnap] = await Promise.all([
        dbAdmin.collection(COLLECTIONS.WORK_ORDERS).where('company_id', '==', companyId).get(),
        dbAdmin.collection(COLLECTIONS.CUSTOMERS).where('company_id', '==', companyId).get(),
        dbAdmin.collection(COLLECTIONS.LOCATIONS).where('company_id', '==', companyId).get(),
        dbAdmin.collection(COLLECTIONS.EQUIPMENT).where('company_id', '==', companyId).get(),
        dbAdmin.collection(COLLECTIONS.INVOICES).where('company_id', '==', companyId).get(),
        dbAdmin.collection(COLLECTIONS.USERS).where('company_id', '==', companyId).get(),
    ]);

    const workOrders = woSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const customers = customerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const locations = locationSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const equipment = equipmentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const invoices = invoiceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const users = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { workOrders, customers, locations, equipment, invoices, users };
}


export async function GET(request: NextRequest) {
    const routePath = `/api/dashboard GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    try {
        // Any authenticated user in a company should be able to view the dashboard.
        // The specific 'dashboard:view' permission was too strict.
        const authResult = await verifyUserRole(request, '*');

        if (!authResult.authorized) {
            return NextResponse.json({ message: authResult.message }, { status: authResult.status });
        }

        const { companyId } = authResult;

        if (companyId === null) {
            // This is a platform admin. The dashboard for them should be handled separately.
            // For now, we return an empty state as they don't belong to a single company.
            return NextResponse.json({
                workOrders: [], customers: [], locations: [], equipment: [], invoices: [], users: [], recentActivity: []
            }, { status: 200 });
        }
        
        const data = await fetchCompanyData(companyId);

        // Convert Timestamps to ISO strings for JSON serialization
        const serializeDates = (item: any) => {
            const newItem = { ...item };
            for (const key in newItem) {
                if (newItem[key] instanceof Timestamp) {
                    newItem[key] = newItem[key].toDate().toISOString();
                }
            }
            return newItem;
        };

        const serializedData = {
            workOrders: data.workOrders.map(serializeDates),
            customers: data.customers.map(serializeDates),
            locations: data.locations.map(serializeDates),
            equipment: data.equipment.map(serializeDates),
            invoices: data.invoices.map(serializeDates),
            users: data.users.map(serializeDates),
        };
        
        return NextResponse.json(serializedData, { status: 200 });

    } catch (error: any) {
        console.error(`[${routePath}] Error fetching dashboard data:`, error);
        return NextResponse.json({ message: 'Failed to fetch dashboard data', detail: error.message }, { status: 500 });
    }
}
