
'use server';
/**
 * @fileOverview A flow to generate a concise work order summary from a description.
 *
 * - generateWorkOrderSummary - Generates a summary.
 * - GenerateWorkOrderSummaryInput - Input type for the flow.
 * - GenerateWorkOrderSummaryOutput - Output type for the flow.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

const GenerateWorkOrderSummaryInputSchema = z.object({
  workOrderDescription: z.string().describe('The full description or reason for the work order.'),
});
export type GenerateWorkOrderSummaryInput = z.infer<typeof GenerateWorkOrderSummaryInputSchema>;

const GenerateWorkOrderSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise, 3-5 word summary suitable for a title.'),
});
export type GenerateWorkOrderSummaryOutput = z.infer<typeof GenerateWorkOrderSummaryOutputSchema>;

export async function generateWorkOrderSummary(input: GenerateWorkOrderSummaryInput): Promise<GenerateWorkOrderSummaryOutput> {
  return generateWorkOrderSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWorkOrderSummaryPrompt',
  input: { schema: GenerateWorkOrderSummaryInputSchema },
  output: { schema: GenerateWorkOrderSummaryOutputSchema },
  prompt: `Generate a concise, 3-5 word summary for the following work order description. This will be used as the main title for the job.

Examples:
- "Customer reports AC is not cooling. Intermittent issue." -> "AC Not Cooling"
- "The main freezer unit in the walk-in is leaking water onto the floor and has a layer of ice built up on the back wall." -> "Walk-in Freezer Leak"
- "Perform scheduled quarterly preventative maintenance on rooftop HVAC unit #3." -> "Quarterly HVAC PM (RTU-3)"

Description: {{{workOrderDescription}}}`,
});

const generateWorkOrderSummaryFlow = ai.defineFlow(
  {
    name: 'generateWorkOrderSummaryFlow',
    inputSchema: GenerateWorkOrderSummaryInputSchema,
    outputSchema: GenerateWorkOrderSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a summary.");
    }
    return output;
  }
);
