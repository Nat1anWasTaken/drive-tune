// src/ai/flows/extract-music-sheet-metadata.ts
"use server";
/**
 * @fileOverview A flow to extract detailed music sheet metadata from a file using the Gemini API.
 *
 * - extractMusicSheetMetadata - A function that handles the metadata extraction process.
 * - ExtractMusicSheetMetadataInput - The input type for the extractMusicSheetMetadata function.
 * - ExtractMusicSheetMetadataOutput - The return type for the extractMusicSheetMetadata function (now includes title, composers, arrangement_type, and parts with primaryInstrumentation).
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ExtractMusicSheetMetadataInputSchema = z.object({
  musicSheetDataUri: z
    .string()
    .describe(
      "A music sheet file (potentially merged by user), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  existingArrangementTypes: z
    .array(z.string())
    .describe(
      "An array of predefined arrangement type names that the AI must choose from. e.g., ['Concert Band', 'Jazz Ensemble', 'String Orchestra']"
    ),
});
export type ExtractMusicSheetMetadataInput = z.infer<
  typeof ExtractMusicSheetMetadataInputSchema
>;

const PartInformationSchema = z.object({
  label: z
    .string()
    .describe(
      "The type of part, typically the instrument or section name, such as 'Flute I', 'Percussion II'. For non-musical sections, use descriptive labels like 'Cover', 'Program Notes'. Reproduce exactly the label as written in the score. For the full ensemble score, always use 'Full Score'."
    ),
  is_full_score: z
    .boolean()
    .describe(
      "Indicates whether this part is the full score. Set to true only for pages showing the complete ensemble score with all instruments. Set to false for covers, program notes, individual instrument parts, and other non-full-score sections."
    ),
  start_page: z
    .number()
    .int()
    .describe("The starting page number of this part in the document."),
  end_page: z
    .number()
    .int()
    .describe("The ending page number of this part in the document."),
  primaryInstrumentation: z
    .string()
    .describe(
      "The primary instrument name for this part, suitable for use in a filename (e.g., 'Flute', 'Violin I', 'Full Score', 'Trumpet-Bb'). If the part is for multiple instruments like 'Flute/Piccolo', use a hyphenated form like 'Flute-Piccolo'. This should generally match or be derived from the label."
    ),
});

const ExtractMusicSheetMetadataOutputSchema = z.object({
  title: z
    .string()
    .describe(
      "The title of the score, typically the name of the music piece. Please write out the full original title, e.g., 'Washington Post March'."
    ),
  composers: z
    .array(z.string())
    .describe(
      "The composers and arrangers of the piece. Please write out their full original names, e.g., 'John Philip Sousa'."
    ),
  arrangement_type: z
    .string()
    .describe(
      "The type of arrangement. YOU MUST CHOOSE EXACTLY ONE OF THE PROVIDED existingArrangementTypes. Do not invent a new type. e.g., if existingArrangementTypes is ['Concert Band', 'Jazz Ensemble'], you must output either 'Concert Band' or 'Jazz Ensemble'. THIS IS NOT PART NAME SO IT SHOULDN'T BE SOMETHING LIKE 'Full Score', 'Flute 1'"
    ),
  parts: z
    .array(PartInformationSchema)
    .describe(
      "A list of the individual parts included within the file. Carefully examine the document and specify the start and end pages of each part to facilitate later extraction. This means you must carefully inspect each page individually, rather than treating the entire document as one unit."
    ),
});
export type ExtractMusicSheetMetadataOutput = z.infer<
  typeof ExtractMusicSheetMetadataOutputSchema
>;

export async function extractMusicSheetMetadata(
  input: ExtractMusicSheetMetadataInput
): Promise<ExtractMusicSheetMetadataOutput> {
  // Validate file size (50 MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB in bytes
  
  // Extract the base64 data from the data URI
  const base64Match = input.musicSheetDataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid data URI format. Expected format: 'data:<mimetype>;base64,<encoded_data>'");
  }
  
  const base64Data = base64Match[1];
  // Calculate approximate file size from base64 length
  // Base64 encoding increases size by approximately 4/3
  const approximateFileSize = (base64Data.length * 3) / 4;
  
  if (approximateFileSize > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds the maximum limit of 50 MB. Approximate file size: ${Math.round(approximateFileSize / (1024 * 1024))} MB`);
  }
  
  return extractMusicSheetMetadataFlow(input);
}

const systemPrompt = `
You are the conductor of a world-renowned orchestra, with extensive knowledge of sheet music from around the globe.

As your assistant, I will provide you with a PDF file containing sheet music.

I will also provide a list of \`existingArrangementTypes\`. You MUST choose the most appropriate \`arrangement_type\` for the music sheet from this exact list.

 Please analyze the content of the music score and provide the following information:

- **title**: The title of the score, typically the name of the music piece. Please write out the full original title, e.g., "Washington Post March".
- **composers**: The composers and arrangers of the piece. Please write out their full original names, e.g., "John Philip Sousa".
- **arrangement_type**: The type of arrangement. YOU MUST CHOOSE EXACTLY ONE OF THE PROVIDED \`existingArrangementTypes\`. Do not invent a new type. For example, if the provided \`existingArrangementTypes\` are ["Concert Band", "Jazz Ensemble", "String Orchestra"], and the music sheet is for a concert band, you must output "Concert Band". THIS IS NOT PART NAME SO IT SHOULDN'T BE SOMETHING LIKE "Full Score", "Flute 1"
- **parts**: A list of the individual parts included within the file. Analyze each page carefully and identify distinct sections:
  - **Cover pages and text-only pages**: If there are cover pages, title pages, program notes, or other descriptive text-only pages (without musical notation), these should be identified as separate parts with:
    - \`label\`: "Cover" (for cover pages) or "Program Notes" (for descriptive text pages)
    - \`is_full_score\`: false
    - \`start_page\` and \`end_page\`: The exact page range for these sections
    - \`primaryInstrumentation\`: "Cover" or "Program Notes" respectively
  - **Full Score sections**: If there are pages showing the full orchestral/ensemble score (all instruments together on each page), identify these as:
    - \`label\`: "Full Score"
    - \`is_full_score\`: true
    - \`start_page\` and \`end_page\`: The exact page range for the full score section
    - \`primaryInstrumentation\`: "Full Score"
  - **Individual instrument parts**: If there are separate sections for individual instruments (e.g., pages 15-20 are Flute part, pages 21-25 are Clarinet part), identify each as a separate part with the appropriate instrument label.
  
  Important guidelines for each part:
  - **label**: The type of part, typically the instrument or section name, such as "Flute I", "Percussion II", "Cover", "Program Notes". Reproduce exactly the label as written in the score, or use descriptive labels for non-musical sections.
  - **is_full_score**: Set to true only for pages that show the complete ensemble score with all instruments. Set to false for covers, program notes, and individual instrument parts.
  - **start_page**: The starting page number of this part in the document.
  - **end_page**: The ending page number of this part in the document.
  - **primaryInstrumentation**: The primary instrument name for this part, suitable for use in a filename (e.g., 'Flute', 'Violin I', 'Full Score', 'Trumpet-Bb', 'Cover', 'Program Notes'). If the part is for multiple instruments like 'Flute/Piccolo', use a hyphenated form like 'Flute-Piccolo'.

Please extract all fields as JSON only.
`;

const extractMusicSheetMetadataPrompt = ai.definePrompt({
  name: "extractMusicSheetMetadataPrompt",
  input: { schema: ExtractMusicSheetMetadataInputSchema },
  output: { schema: ExtractMusicSheetMetadataOutputSchema },
  prompt: `${systemPrompt}

  Existing Arrangement Types: {{existingArrangementTypes}}
  Music Sheet File: {{media url=musicSheetDataUri}}`,
  config: {
    responseMimeType: "application/json", // Ensure Genkit requests JSON from Gemini
  },
});

const extractMusicSheetMetadataFlow = ai.defineFlow(
  {
    name: "extractMusicSheetMetadataFlow",
    inputSchema: ExtractMusicSheetMetadataInputSchema,
    outputSchema: ExtractMusicSheetMetadataOutputSchema,
  },
  async (input) => {
    const { output } = await extractMusicSheetMetadataPrompt(input);
    if (!output) {
      throw new Error("No output from metadata extraction prompt.");
    }
    // Validate that all required fields are present, especially for parts
    if (
      !output.title ||
      !output.composers ||
      output.composers.length === 0 ||
      !output.arrangement_type ||
      !output.parts ||
      output.parts.length === 0
    ) {
      let missingFields = [];
      if (!output.title) missingFields.push("title");
      if (!output.composers || output.composers.length === 0)
        missingFields.push("composers");
      if (!output.arrangement_type) missingFields.push("arrangement_type");
      if (!output.parts || output.parts.length === 0)
        missingFields.push("parts");

      (output.parts || []).forEach((part, index) => {
        if (!part.label) missingFields.push(`parts[${index}].label`);
        if (part.is_full_score === undefined)
          missingFields.push(`parts[${index}].is_full_score`);
        if (part.start_page === undefined)
          missingFields.push(`parts[${index}].start_page`);
        if (part.end_page === undefined)
          missingFields.push(`parts[${index}].end_page`);
        if (!part.primaryInstrumentation)
          missingFields.push(`parts[${index}].primaryInstrumentation`);
      });

      if (missingFields.length > 0) {
        throw new Error(
          `AI could not extract all required metadata fields. Missing or invalid: ${missingFields.join(
            ", "
          )}`
        );
      }
    }
    return output;
  }
);
