'use server';
/**
 * @fileOverview Flow to generate an image representing a work order summary.
 *
 * - generateImageForWorkOrder - Generates an image based on the work order summary.
 * - GenerateImageForWorkOrderInput - Input type for the flow.
 * - GenerateImageForWorkOrderOutput - Output type for the flow.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

const GenerateImageForWorkOrderInputSchema = z.object({
  workOrderSummary: z.string().describe('A brief summary of the work order (e.g., "HVAC Unit 1 - Annual Maintenance", "Refrigeration Leak Repair").'),
});
export type GenerateImageForWorkOrderInput = z.infer<typeof GenerateImageForWorkOrderInputSchema>;

const GenerateImageForWorkOrderOutputSchema = z.object({
  imageUrl: z.string().url().describe('The data URI of the generated image (e.g., "data:image/png;base64,...").'),
});
export type GenerateImageForWorkOrderOutput = z.infer<typeof GenerateImageForWorkOrderOutputSchema>;

export async function generateImageForWorkOrder(input: GenerateImageForWorkOrderInput): Promise<GenerateImageForWorkOrderOutput> {
  return generateImageForWorkOrderFlow(input);
}

const generateImageForWorkOrderFlow = ai.defineFlow(
  {
    name: 'generateImageForWorkOrderFlow',
    inputSchema: GenerateImageForWorkOrderInputSchema,
    outputSchema: GenerateImageForWorkOrderOutputSchema,
  },
  async (input) => {
    console.log(`[Genkit Flow] Generating image for summary: "${input.workOrderSummary}"`);
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation', // Use the latest experimental model for images
      prompt: `Generate a simple, clear, professional-looking image representing this field service work order summary: "${input.workOrderSummary}". Focus on the main subject (e.g., HVAC unit, refrigeration system, boiler).`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // MUST provide both
      },
    });

    if (!media?.url) {
        console.error('[Genkit Flow] Image generation failed, no media URL returned.');
        throw new Error('Image generation failed.');
    }

    console.log('[Genkit Flow] Image generated successfully.');
    return { imageUrl: media.url }; // media.url is the data URI
  }
);
