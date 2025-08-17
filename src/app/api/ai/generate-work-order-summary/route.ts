
'use server'; // Ensure this is a server-side file

import { NextRequest, NextResponse } from 'next/server';
import { generateWorkOrderSummary } from '@/ai/flows/generate-work-order-summary';
import { verifyUserRole } from '@/lib/firebase/adminAuth';
import { z } from 'zod';

// Define the expected request body schema
const summaryRequestSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
});

export async function POST(req: NextRequest) {
  const routePath = '/api/ai/generate-work-order-summary POST';
  console.log(`[${routePath}] Route handler invoked.`);

  // 1. Authenticate the request
  // A user should have permission to create a work order to be able to generate a summary for it.
  const authResult = await verifyUserRole(req, 'work-orders:create');
  if (!authResult.authorized) {
    return NextResponse.json({ message: authResult.message }, { status: authResult.status });
  }

  // 2. Validate the request body
  let parsedBody;
  try {
    const body = await req.json();
    parsedBody = summaryRequestSchema.parse(body);
  } catch (error) {
    console.error(`[${routePath}] Invalid request body:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request body', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: 'Invalid JSON format in request body' }, { status: 400 });
  }

  // 3. Call the Genkit flow
  try {
    const { summary } = await generateWorkOrderSummary({
      workOrderDescription: parsedBody.description,
    });
    
    console.log(`[${routePath}] Successfully generated summary.`);
    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error(`[${routePath}] Error calling Genkit flow:`, error);
    return NextResponse.json({ message: 'Failed to generate work order summary', detail: error.message }, { status: 500 });
  }
}
