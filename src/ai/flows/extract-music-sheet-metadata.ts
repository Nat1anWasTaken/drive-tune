// src/ai/flows/extract-music-sheet-metadata.ts
'use server';
/**
 * @fileOverview A flow to extract detailed music sheet metadata from a file using the Gemini API.
 *
 * - extractMusicSheetMetadata - A function that handles the metadata extraction process.
 * - ExtractMusicSheetMetadataInput - The input type for the extractMusicSheetMetadata function.
 * - ExtractMusicSheetMetadataOutput - The return type for the extractMusicSheetMetadata function (now includes title, composers, arrangement_type, and parts).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractMusicSheetMetadataInputSchema = z.object({
  musicSheetDataUri: z
    .string()
    .describe(
      "A music sheet file (potentially merged by user), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractMusicSheetMetadataInput = z.infer<typeof ExtractMusicSheetMetadataInputSchema>;

const PartInformationSchema = z.object({
  label: z.string().describe("The type of part, typically the instrument or section name, such as 'Flute I', 'Percussion II'. Reproduce exactly the label as written in the score. For the full ensemble score, always use 'Full Score'."),
  is_full_score: z.boolean().describe("Indicates whether this part is the full score. If the music file includes introductions, prefaces, or other textual content, categorize it within the full score."),
  start_page: z.number().int().describe("The starting page number of this part in the document."),
  end_page: z.number().int().describe("The ending page number of this part in the document."),
});

const ExtractMusicSheetMetadataOutputSchema = z.object({
  title: z.string().describe("The title of the score, typically the name of the music piece. Please write out the full original title, e.g., 'Washington Post March'."),
  composers: z.array(z.string()).describe("The composers and arrangers of the piece. Please write out their full original names, e.g., 'John Philip Sousa'."),
  arrangement_type: z.string().describe("The type of arrangement, please name based on the instrumentation in the music sheet. e.g., 'String Quartet', 'Percussion Ensemble', 'Concert Band'. THIS IS NOT PART NAME SO IT SHOULDN'T BE SOMETHING LIKE 'Full Score', 'Flute 1'"),
  parts: z.array(PartInformationSchema).describe("A list of the individual parts included within the file. Carefully examine the document and specify the start and end pages of each part to facilitate later extraction. This means you must carefully inspect each page individually, rather than treating the entire document as one unit."),
});
export type ExtractMusicSheetMetadataOutput = z.infer<typeof ExtractMusicSheetMetadataOutputSchema>;


export async function extractMusicSheetMetadata(input: ExtractMusicSheetMetadataInput): Promise<ExtractMusicSheetMetadataOutput> {
  return extractMusicSheetMetadataFlow(input);
}

const systemPrompt = `
You are the conductor of a world-renowned orchestra, with extensive knowledge of sheet music from around the globe.

As your assistant, I will provide you with a PDF file containing sheet music. Please analyze the content of the music score and provide the following information:

- **title**: The title of the score, typically the name of the music piece. Please write out the full original title, e.g., "Washington Post March".
- **composers**: The composers and arrangers of the piece. Please write out their full original names, e.g., "John Philip Sousa".
- **arrangement_type**: The type of arrangement, please name based on the instrumentation in the music sheet. e.g., "String Quartet", "Percussion Ensemble", "Concert Band". THIS IS NOT PART NAME SO IT SHOULDN'T BE SOMETHING LIKE "Full Score", "Flute 1"
- **parts**: A list of the individual parts included within the file. Carefully examine the document and specify the start and end pages of each part to facilitate later extraction. This means you must carefully inspect each page individually, rather than treating the entire document as one unit.
  - **label**: The type of part, typically the instrument or section name, such as "Flute I", "Percussion II". Reproduce exactly the label as written in the score. For the full ensemble score, always use "Full Score".
  - **is_full_score**: Indicates whether this part is the full score. If the music file includes introductions, prefaces, or other textual content, categorize it within the full score.
  - **start_page**: The starting page number of this part in the document.
  - **end_page**: The ending page number of this part in the document.

Please extract all fields as JSON only.
`;

const extractMusicSheetMetadataPrompt = ai.definePrompt({
  name: 'extractMusicSheetMetadataPrompt',
  input: {schema: ExtractMusicSheetMetadataInputSchema},
  output: {schema: ExtractMusicSheetMetadataOutputSchema},
  prompt: `${systemPrompt}

  Music Sheet File: {{media url=musicSheetDataUri}}`,
  config: {
    responseMimeType: "application/json", // Ensure Genkit requests JSON from Gemini
  }
});

const extractMusicSheetMetadataFlow = ai.defineFlow(
  {
    name: 'extractMusicSheetMetadataFlow',
    inputSchema: ExtractMusicSheetMetadataInputSchema,
    outputSchema: ExtractMusicSheetMetadataOutputSchema,
  },
  async input => {
    const {output} = await extractMusicSheetMetadataPrompt(input);
    if (!output) {
      throw new Error('No output from metadata extraction prompt.');
    }
    // Validate that all required fields are present, especially for parts
    if (!output.title || !output.composers || output.composers.length === 0 || !output.arrangement_type || !output.parts || output.parts.length === 0) {
        let missingFields = [];
        if (!output.title) missingFields.push("title");
        if (!output.composers || output.composers.length === 0) missingFields.push("composers");
        if (!output.arrangement_type) missingFields.push("arrangement_type");
        if (!output.parts || output.parts.length === 0) missingFields.push("parts");
        for (const part of output.parts || []) {
            if (!part.label) missingFields.push("part.label");
            if (part.is_full_score === undefined) missingFields.push("part.is_full_score");
            if (part.start_page === undefined) missingFields.push("part.start_page");
            if (part.end_page === undefined) missingFields.push("part.end_page");
        }
        throw new Error(`AI could not extract all required metadata fields. Missing or invalid: ${missingFields.join(', ')}`);
    }
    return output;
  }
);
