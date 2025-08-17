
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin, adminInitializationError } from '@/lib/firebase/adminConfig';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import type { Customer } from '@/types/customer';

// Define the expected structure of a single customer row from the CSV
const customerImportSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email('Invalid email format').optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  billing_notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const importRequestSchema = z.object({
    data: z.array(z.any()), // Start with 'any' and validate each item individually
    mapping: z.record(z.string()), // Expect a mapping object from header to opSiteField
});

export async function POST(request: NextRequest) {
    const routePath = `/api/import/customers POST`;
    console.log(`[${routePath}] Route handler invoked.`);

    if (adminInitializationError) {
        return NextResponse.json({ message: 'Server configuration error' }, { status: 503 });
    }
    
    const { authorized, companyId, error, status } = await verifyUserRole(request, 'customers:create');
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
            return NextResponse.json({ message: 'No customer data provided' }, { status: 400 });
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const batch = dbAdmin.batch();
        const customersCollection = dbAdmin.collection(COLLECTIONS.CUSTOMERS);

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];

            // Transform the row based on the mapping before validation
            const transformedRow: { [key: string]: any } = {};
            for (const header in mapping) {
                const opSiteField = mapping[header];
                if (opSiteField && row[header] !== undefined) {
                    // Handle special cases like status
                    if(opSiteField === 'status') {
                        const statusValue = String(row[header]).toLowerCase().trim();
                        if (statusValue === 'active' || statusValue === 'inactive') {
                             transformedRow[opSiteField] = statusValue;
                        } else {
                             transformedRow[opSiteField] = 'active'; // Default to active if value is invalid
                        }
                    } else {
                        transformedRow[opSiteField] = row[header];
                    }
                }
            }
            
            const validation = customerImportSchema.safeParse(transformedRow);

            if (!validation.success) {
                errorCount++;
                const errorMessages = validation.error.errors.map(e => `Row ${i + 2}: Field '${e.path.join('.')}' - ${e.message}`).join('; ');
                errors.push(errorMessages);
                continue; // Skip this row
            }

            const customerData = validation.data;
            
            // Check for existing customer by name within the company to prevent duplicates
            const existingCustomerQuery = await customersCollection
                .where('company_id', '==', companyId)
                .where('name', '==', customerData.name)
                .limit(1)
                .get();

            if (!existingCustomerQuery.empty) {
                errorCount++;
                errors.push(`Row ${i + 2}: Customer with name "${customerData.name}" already exists.`);
                continue;
            }
            
            const newCustomerRef = customersCollection.doc();
            const newCustomerDoc: Omit<Customer, 'id' | 'created_at'> & { created_at: Timestamp } = {
                company_id: companyId,
                name: customerData.name,
                contact_name: customerData.contact_name || null,
                contact_email: customerData.contact_email || null,
                contact_phone: customerData.contact_phone || null,
                billing_notes: customerData.billing_notes || null,
                status: customerData.status,
                created_at: Timestamp.now(),
            };
            batch.set(newCustomerRef, newCustomerDoc);
            successCount++;
        }

        if (successCount > 0) {
            await batch.commit();
        }

        console.log(`[${routePath}] Import completed for company ${companyId}. Success: ${successCount}, Failed: ${errorCount}`);
        return NextResponse.json({ successCount, errorCount, errors }, { status: 200 });

    } catch (err: any) {
        console.error(`[${routePath}] Error during import process:`, err);
        return NextResponse.json({ message: 'Failed to process import', detail: err.message }, { status: 500 });
    }
}
