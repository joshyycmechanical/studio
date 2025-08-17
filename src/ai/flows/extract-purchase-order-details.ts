'use server';

/**
 * @fileOverview A flow to extract line item details from a purchase order document using OCR.
 *
 * - extractPurchaseOrderDetails - A function that handles the extraction of purchase order details.
 * - ExtractPurchaseOrderDetailsInput - The input type for the extractPurchaseOrderDetails function.
 * - ExtractPurchaseOrderDetailsOutput - The return type for the extractPurchaseOrderDetails function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ExtractPurchaseOrderDetailsInputSchema = z.object({
  purchaseOrderDataUri: z
    .string()
    .describe(
      "A photo of a purchase order document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractPurchaseOrderDetailsInput = z.infer<
  typeof ExtractPurchaseOrderDetailsInputSchema
>;

const ExtractPurchaseOrderDetailsOutputSchema = z.object({
  lineItems: z
    .array(
      z.object({
        description: z.string().describe('Description of the item.'),
        quantity: z.number().describe('Quantity of the item.'),
        unitPrice: z.number().describe('Unit price of the item.'),
      })
    )
    .describe('Extracted line items from the purchase order.'),
});
export type ExtractPurchaseOrderDetailsOutput = z.infer<
  typeof ExtractPurchaseOrderDetailsOutputSchema
>;

export async function extractPurchaseOrderDetails(
  input: ExtractPurchaseOrderDetailsInput
): Promise<ExtractPurchaseOrderDetailsOutput> {
  return extractPurchaseOrderDetailsFlow(input);
}

const extractPurchaseOrderDetailsPrompt = ai.definePrompt({
  name: 'extractPurchaseOrderDetailsPrompt',
  input: {
    schema: z.object({
      purchaseOrderDataUri: z
        .string()
        .describe(
          "A photo of a purchase order document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      lineItems: z
        .array(
          z.object({
            description: z.string().describe('Description of the item.'),
            quantity: z.number().describe('Quantity of the item.'),
            unitPrice: z.number().describe('Unit price of the item.'),
          })
        )
        .describe('Extracted line items from the purchase order.'),
    }),
  },
  prompt: `You are an expert in processing purchase orders. Extract the line items from the following purchase order document.  Each line item should include the description, quantity, and unit price.

Purchase Order Document: {{media url=purchaseOrderDataUri}}`,
});

const extractPurchaseOrderDetailsFlow = ai.defineFlow<
  typeof ExtractPurchaseOrderDetailsInputSchema,
  typeof ExtractPurchaseOrderDetailsOutputSchema
>(
  {
    name: 'extractPurchaseOrderDetailsFlow',
    inputSchema: ExtractPurchaseOrderDetailsInputSchema,
    outputSchema: ExtractPurchaseOrderDetailsOutputSchema,
  },
  async input => {
    const {output} = await extractPurchaseOrderDetailsPrompt(input);
    return output!;
  }
);
