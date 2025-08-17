
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Equipment, EquipmentStatus } from '@/types/equipment';
import type { Location } from '@/types/location';

// Define the expected structure of a single equipment row after transformation
const equipmentImportSchema = z.object({
  name: z.string().min(1, 'Equipment Name is required'),
  customer_name: z.string().min(1, 'Customer Name is required for linking'),
  location_name: z.string().min(1, 'Location Name is required for linking'),
  asset_tag: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model_number: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  equipment_type: z.string().optional().nullable(),
  status: z.enum(['operational', 'needs-repair', 'decommissioned']).default('operational'),
  notes: z.string().optional().nullable(),
});

const importRequestSchema = z.object({
    data: z.array(z.any()),
    mapping: z.record(z.string()),
});

export async function POST(request: NextRequest) {
    const routePath = `/api/import/equipment POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'equipment:create');
    if (!authorized || !companyId) {
        return NextResponse.json({ message: error || 'Unauthorized or company not found' }, { status: status || 403 });
    }
    
    try {
        const body = await request.json();
        const requestValidation = importRequestSchema.safeParse(body);
        if (!requestValidation.success) {
            return NextResponse.json({ message: 'Invalid request body structure', errors: requestValidation.error.errors }, { status: 400 });
        }

        const { data: dataRows, mapping } = requestValidation.data;

        if (!Array.isArray(dataRows) || dataRows.length === 0) {
            return NextResponse.json({ message: 'No equipment data provided' }, { status: 400 });
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const batch = dbAdmin.batch();
        const equipmentCollection = dbAdmin.collection(COLLECTIONS.EQUIPMENT);
        const locationsCollection = dbAdmin.collection(COLLECTIONS.LOCATIONS);
        const locationCache = new Map<string, string>(); // Cache found location IDs

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const transformedRow: { [key: string]: any } = {};
            for (const header in mapping) {
                const opSiteField = mapping[header];
                if (opSiteField && row[header] !== undefined) {
                    transformedRow[opSiteField] = row[header];
                }
            }
            
            const validation = equipmentImportSchema.safeParse(transformedRow);
            if (!validation.success) {
                errorCount++;
                const errorMessages = validation.error.errors.map(e => `Row ${i + 2}: Field '${e.path.join('.')}' - ${e.message}`).join('; ');
                errors.push(errorMessages);
                continue;
            }

            const { customer_name, location_name, ...equipmentData } = validation.data;
            let locationId: string | undefined;
            const locationCacheKey = `${customer_name}|${location_name}`.toLowerCase();

            if (locationCache.has(locationCacheKey)) {
                locationId = locationCache.get(locationCacheKey);
            } else {
                const locationQuery = await locationsCollection
                    .where('company_id', '==', companyId)
                    .where('name', '==', location_name)
                    // We can't query by customer name directly on location, need a second step
                    .get();

                const matchingLocations = locationQuery.docs.filter(doc => (doc.data() as Location).customer_id);
                
                if (matchingLocations.length > 0) {
                    // This is a simplification. If multiple locations have the same name for different customers,
                    // this could fail. A more robust solution might need customer ID in the CSV.
                    // For now, we take the first match that has a matching customer name.
                    const customerQuery = await dbAdmin.collection(COLLECTIONS.CUSTOMERS)
                        .where('company_id', '==', companyId)
                        .where('name', '==', customer_name)
                        .get();

                    if (!customerQuery.empty) {
                        const customerId = customerQuery.docs[0].id;
                        const finalLocation = matchingLocations.find(loc => loc.data().customer_id === customerId);
                        if (finalLocation) {
                            locationId = finalLocation.id;
                            locationCache.set(locationCacheKey, locationId);
                        }
                    }
                }
            }
            
            if (!locationId) {
                errorCount++;
                errors.push(`Row ${i + 2}: Location "${location_name}" for Customer "${customer_name}" not found.`);
                continue;
            }
            
            const locationDoc = await locationsCollection.doc(locationId).get();
            const locationData = locationDoc.data();

            if (!locationData) {
                 errorCount++;
                 errors.push(`Row ${i + 2}: Could not retrieve details for Location "${location_name}".`);
                 continue;
            }

            const newEquipmentRef = equipmentCollection.doc();
            const newEquipmentDoc: Omit<Equipment, 'id'> = {
                ...equipmentData,
                company_id: companyId,
                customer_id: locationData.customer_id, // Get customer_id from the found location
                location_id: locationId,
                created_at: Timestamp.now(),
                installation_date: null,
                last_service_date: null,
                next_service_due_date: null,
                attachments: [],
                custom_fields: {},
            };
            
            batch.set(newEquipmentRef, newEquipmentDoc);

            // Increment equipment_count on location
            const currentCount = locationData.equipment_count || 0;
            batch.update(locationsCollection.doc(locationId), { equipment_count: currentCount + 1 });
            
            successCount++;
        }

        if (successCount > 0) {
            await batch.commit();
        }

        console.log(`[${routePath}] Equipment import completed for company ${companyId}. Success: ${successCount}, Failed: ${errorCount}`);
        return NextResponse.json({ successCount, errorCount, errors }, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error during equipment import process:`, err);
        return NextResponse.json({ message: 'Failed to process equipment import', detail: err.message }, { status: 500 });
    }
}
