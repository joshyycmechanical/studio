
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Estimate } from '@/types/estimate';

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

// GET all estimates for a company
export async function GET(request: NextRequest) {
    const routePath = `/api/estimates GET`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, error, status } = await verifyUserRole(request, 'estimates:view');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Forbidden' }, { status: status || 403 });
    }

    try {
        const estimatesRef = dbAdmin.collection(COLLECTIONS.ESTIMATES);
        const q = estimatesRef.where('company_id', '==', companyId);
        const snapshot = await q.get();

        const estimates = snapshot.docs.map(doc => {
            return convertTimestampsToISO({ id: doc.id, ...doc.data() });
        });
        
        // Sort by creation date, newest first
        estimates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json(estimates, { status: 200 });
    } catch (err: any) {
        console.error(`[${routePath}] Error fetching estimates for company ${companyId}:`, err);
        return NextResponse.json({ message: 'Failed to fetch estimates', detail: err.message }, { status: 500 });
    }
}


// POST a new estimate
export async function POST(request: NextRequest) {
    const routePath = `/api/estimates POST`;

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }

    const { authorized, companyId, userId } = await verifyUserRole(request, 'estimates:create');
    if (!authorized || !companyId || !userId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    try {
        const estimateData = await request.json();

        // Convert date strings from client back to Timestamps for Firestore
        if(estimateData.valid_until) estimateData.valid_until = Timestamp.fromDate(new Date(estimateData.valid_until));

        const newEstimate = {
            ...estimateData,
            company_id: companyId,
            created_by: userId,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            status: 'draft',
            estimate_number: `EST-${Date.now().toString().slice(-6)}`,
        };

        const docRef = await dbAdmin.collection(COLLECTIONS.ESTIMATES).add(newEstimate);
        const newDoc = await docRef.get();
        
        return NextResponse.json(convertTimestampsToISO({ id: newDoc.id, ...newDoc.data() }), { status: 201 });

    } catch (err: any) {
        console.error(`[${routePath}] Error creating estimate:`, err);
        return NextResponse.json({ message: 'Failed to create estimate', detail: err.message }, { status: 500 });
    }
}
