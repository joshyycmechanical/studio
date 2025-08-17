
'use client';

import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Estimate, EstimateLineItem, EstimateStatus } from '@/types/estimate';

interface RouteParams {
  params: { estimateId: string };
}

const lineItemSchema = z.object({
    id: z.string().optional(),
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(0.01, 'Quantity must be positive'),
    unit_price: z.number().nonnegative(),
    item_type: z.enum(['service', 'part', 'labor', 'other']),
});

const updateEstimateSchema = z.object({
  customer_id: z.string().min(1).optional(),
  location_id: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'approved', 'rejected', 'invoiced', 'expired']).optional(),
  summary: z.string().min(1).optional(),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  line_items: z.array(lineItemSchema).min(1).optional(),
  total_amount: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  valid_until: z.date().optional().nullable(),
});

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

async function checkAuthAndEstimate(request: NextRequest, estimateId: string, permission: string) {
    if (adminInitializationError) {
        throw new Error('Server configuration error');
    }
    const authResult = await verifyUserRole(request, permission);
    if (!authResult.authorized) {
        throw new Error('Forbidden');
    }

    const { companyId } = authResult;
    const estimateRef = dbAdmin.collection(COLLECTIONS.ESTIMATES).doc(estimateId);
    const docSnap = await estimateRef.get();

    if (!docSnap.exists || docSnap.data()?.company_id !== companyId) {
        throw new Error('Estimate not found');
    }

    return { authResult, estimateRef, docSnap };
}


export async function GET(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/estimates/${params.estimateId} GET`;
    try {
        const { docSnap } = await checkAuthAndEstimate(request, params.estimateId, 'estimates:view');
        return NextResponse.json(convertTimestampsToISO({ id: docSnap.id, ...docSnap.data() }), { status: 200 });
    } catch (error: any) {
        if (error.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        if (error.message === 'Estimate not found') return NextResponse.json({ message: 'Estimate not found' }, { status: 404 });
        console.error(`[${routePath}] Error:`, error);
        return NextResponse.json({ message: 'Failed to fetch estimate', detail: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/estimates/${params.estimateId} PUT`;
    try {
        const { authResult, estimateRef } = await checkAuthAndEstimate(request, params.estimateId, 'estimates:edit');
        const { userId } = authResult;

        const body = await request.json();
        const validation = updateEstimateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ message: 'Invalid request body', errors: validation.error.errors }, { status: 400 });
        }

        const updateData: { [key: string]: any } = { ...validation.data, updated_at: Timestamp.now(), updated_by: userId };
        
        // Convert date fields back to Timestamps
        if (updateData.valid_until) updateData.valid_until = Timestamp.fromDate(new Date(updateData.valid_until));

        await estimateRef.update(updateData);
        
        const updatedDoc = await estimateRef.get();
        return NextResponse.json(convertTimestampsToISO({ id: updatedDoc.id, ...updatedDoc.data() }), { status: 200 });

    } catch (error: any) {
        if (error.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        if (error.message === 'Estimate not found') return NextResponse.json({ message: 'Estimate not found' }, { status: 404 });
        console.error(`[${routePath}] Error:`, error);
        return NextResponse.json({ message: 'Failed to update estimate', detail: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const routePath = `/api/estimates/${params.estimateId} DELETE`;
    try {
        const { estimateRef } = await checkAuthAndEstimate(request, params.estimateId, 'estimates:delete');
        await estimateRef.delete();
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        if (error.message === 'Forbidden') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        if (error.message === 'Estimate not found') return NextResponse.json({ message: 'Estimate not found' }, { status: 404 });
        console.error(`[${routePath}] Error:`, error);
        return NextResponse.json({ message: 'Failed to delete estimate', detail: error.message }, { status: 500 });
    }
}
