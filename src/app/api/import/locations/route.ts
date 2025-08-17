
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { Location } from '@/types/location';

// Define the expected structure of a single location row from the CSV
const locationImportSchema = z.object({
  customer_name: z.string().min(1, 'customer_name is required for linking'),
  name: z.string().min(1, 'Location name is required'),
  address_line1: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province/State is required'),
  postal_code: z.string().min(1, 'Postal/Zip Code is required'),
  address_line2: z.string().optional().nullable(),
  location_type: z.enum(['restaurant', 'warehouse', 'office', 'residential', 'other']).default('other'),
});

const importRequestSchema = z.object({
    data: z.array(z.any()),
    mapping: z.record(z.string()),
});

export async function POST(request: NextRequest) {
    const routePath = `/api/import/locations POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'locations:create');
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
            return NextResponse.json({ message: 'No location data provided' }, { status: 400 });
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const batch = dbAdmin.batch();
        const locationsCollection = dbAdmin.collection(COLLECTIONS.LOCATIONS);
        const customersCollection = dbAdmin.collection(COLLECTIONS.CUSTOMERS);
        const customerCache = new Map<string, string>(); // Cache found customer IDs to reduce queries

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const transformedRow: { [key: string]: any } = {};
            for (const header in mapping) {
                const opSiteField = mapping[header];
                if (opSiteField && row[header] !== undefined) {
                    transformedRow[opSiteField] = row[header];
                }
            }
            
            const validation = locationImportSchema.safeParse(transformedRow);
            if (!validation.success) {
                errorCount++;
                const errorMessages = validation.error.errors.map(e => `Row ${i + 2}: Field '${e.path.join('.')}' - ${e.message}`).join('; ');
                errors.push(errorMessages);
                continue;
            }

            const { customer_name, ...locationData } = validation.data;
            let customerId: string | undefined;

            // Check cache first
            if (customerCache.has(customer_name)) {
                customerId = customerCache.get(customer_name);
            } else {
                // Query for customer by name if not in cache
                const customerQuery = await customersCollection
                    .where('company_id', '==', companyId)
                    .where('name', '==', customer_name)
                    .limit(1)
                    .get();
                
                if (customerQuery.empty) {
                    errorCount++;
                    errors.push(`Row ${i + 2}: Customer "${customer_name}" not found.`);
                    continue;
                }
                customerId = customerQuery.docs[0].id;
                customerCache.set(customer_name, customerId); // Add to cache
            }
            
            const newLocationRef = locationsCollection.doc();
            const newLocationDoc = {
                ...locationData,
                company_id: companyId,
                customer_id: customerId,
                equipment_count: 0,
                created_at: Timestamp.now(),
            };
            batch.set(newLocationRef, newLocationDoc);
            successCount++;
        }

        if (successCount > 0) {
            await batch.commit();
        }

        console.log(`[${routePath}] Location import completed for company ${companyId}. Success: ${successCount}, Failed: ${errorCount}`);
        return NextResponse.json({ successCount, errorCount, errors }, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error during location import process:`, err);
        return NextResponse.json({ message: 'Failed to process location import', detail: err.message }, { status: 500 });
    }
}
