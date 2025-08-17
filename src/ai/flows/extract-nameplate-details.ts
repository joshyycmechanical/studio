
import { z } from 'zod';
import { generate } from "@genkit-ai/ai";
import { defineFlow } from '@genkit-ai/flow';
import { geminiProVision } from '@genkit-ai/googleai'; // Use the vision-capable model

// Define the structure of the data we want to extract
const NameplateDetailsSchema = z.object({
    manufacturer: z.string().describe('The manufacturer or brand of the equipment (e.g., "Carrier", "True")'),
    modelNumber: z.string().describe('The model number of the equipment (e.g., "38MARBQ36AA3")'),
    serialNumber: z.string().describe('The serial number of the equipment (e.g., "3420V92375")'),
});

// Define the AI flow
export const extractNameplateDetailsFlow = defineFlow(
    {
        name: 'extractNameplateDetailsFlow',
        // The input is now a public URL to the nameplate image
        inputSchema: z.string().url().describe('A public URL of the equipment nameplate image'),
        outputSchema: NameplateDetailsSchema,
    },
    async (imageUrl) => {
        // The prompt instructs the AI on what to do with the image
        const prompt = `Analyze the attached image of an equipment nameplate. It might be dirty, blurry, or at an angle. Identify and extract the Manufacturer, Model Number, and Serial Number.`;

        // Generate a response using the Gemini Pro Vision model
        const llmResponse = await generate({
            prompt: [
                { text: prompt },
                { media: { url: imageUrl } } // Attach the image for analysis
            ],
            model: geminiProVision,
            output: {
                format: 'json',
                schema: NameplateDetailsSchema,
            },
            config: {
                temperature: 0.1, // Low temperature for more deterministic output
            }
        });

        // Get the structured JSON output
        const details = llmResponse.output();
        if (!details) {
            throw new Error("The AI model failed to extract details from the provided image.");
        }
        
        console.log("[AI Flow] Extracted Nameplate Details:", details);
        return details;
    }
);
