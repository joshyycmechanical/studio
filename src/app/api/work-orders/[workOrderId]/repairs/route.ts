
// This file is now obsolete.
// Repair creation logic has been moved to a dedicated /api/repairs route
// to better handle relationships and separate concerns.
// This file can be safely removed from the project.

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: { workOrderId: string } }) {
    console.warn(`[API - DEPRECATED] /api/work-orders/[workOrderId]/repairs POST handler was called. This route is obsolete. Please use /api/repairs instead.`);
    return NextResponse.json({
        message: 'This API endpoint is deprecated. Please use POST /api/repairs instead.',
        code: 'DEPRECATED_ENDPOINT'
    }, { status: 410 }); // 410 Gone
}
