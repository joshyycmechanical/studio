
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Equipment } from '@/types/equipment';

// This is a PUBLIC API route. It does NOT require authentication.
// It should only return non-sensitive information.

export async function GET(request: NextRequest, { params }: { params: { equipmentId: string } }) {
    const { equipmentId } = params;
    const routePath = `/api/public/equipment/${equipmentId} GET`;
    console.log(`[${routePath}] Public route invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    if (!dbAdmin) {
        return NextResponse.json({ message: 'Database service not available' }, { status: 503 });
    }

    try {
        if (!equipmentId) {
            return NextResponse.json({ message: 'Equipment ID is required' }, { status: 400 });
        }

        const equipmentRef = dbAdmin.collection(COLLECTIONS.EQUIPMENT).doc(equipmentId);
        const docSnap = await equipmentRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ message: 'Equipment not found' }, { status: 404 });
        }

        const equipmentData = docSnap.data() as Equipment;
        
        // Fetch location name for context
        const locationRef = dbAdmin.collection(COLLECTIONS.LOCATIONS).doc(equipmentData.location_id);
        const locationSnap = await locationRef.get();
        const locationName = locationSnap.exists() ? locationSnap.data()?.name : 'Unknown Location';

        // *** IMPORTANT ***
        // Only return a limited, safe subset of data to the public.
        // Do NOT return internal IDs, company info, customer info, etc.
        const publicData = {
            name: equipmentData.name,
            location_name: locationName,
        };

        return NextResponse.json(publicData, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error:`, err);
        return NextResponse.json({ message: 'Failed to fetch equipment data' }, { status: 500 });
    }
}
