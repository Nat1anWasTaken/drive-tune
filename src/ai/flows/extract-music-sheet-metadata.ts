// src/ai/flows/extract-music-sheet-metadata.ts
'use server';
/**
 * @fileOverview A flow to extract music sheet metadata from a file using the Gemini API.
 *
 * - extractMusicSheetMetadata - A function that handles the metadata extraction process.
 * - ExtractMusicSheetMetadataInput - The input type for the extractMusicSheetMetadata function.
 * - ExtractMusicSheetMetadataOutput - The return type for the extractMusicSheetMetadata function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractMusicSheetMetadataInputSchema = z.object({
  musicSheetDataUri: z
    .string()
    .describe(
      "A music sheet file, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractMusicSheetMetadataInput = z.infer<typeof ExtractMusicSheetMetadataInputSchema>;

const ExtractMusicSheetMetadataOutputSchema = z.object({
  compositionType: z.string().describe('The type of composition or arrangement (e.g., percussion ensemble, saxophone ensemble).'),
  compositionName: z.string().describe('The name of the composition.'),
  composer: z.string().describe('The composer of the music.'),
  arranger: z.string().describe('The arranger(s) of the music, if applicable.'),
  fileSubject: z.string().describe('The specific part or content of the file, distinct from the overall composition name. Examples: "Full Score", "Violin I", "Piano Accompaniment", "Lead Sheet". This should not be the main title of the composition but rather what this specific file represents within that composition.'),
  instrumentations: z.string().describe('A comma-separated list of all instruments or voice parts explicitly mentioned or clearly intended for this music sheet file. Examples: "Flute, Oboe, Clarinet", "SATB Choir", "Piano", "Full Score". If it is a full score, list "Full Score".'),
});
export type ExtractMusicSheetMetadataOutput = z.infer<typeof ExtractMusicSheetMetadataOutputSchema>;

export async function extractMusicSheetMetadata(input: ExtractMusicSheetMetadataInput): Promise<ExtractMusicSheetMetadataOutput> {
  return extractMusicSheetMetadataFlow(input);
}

const extractMusicSheetMetadataPrompt = ai.definePrompt({
  name: 'extractMusicSheetMetadataPrompt',
  input: {schema: ExtractMusicSheetMetadataInputSchema},
  output: {schema: ExtractMusicSheetMetadataOutputSchema},
  prompt: `You are an expert music librarian. Your task is to extract metadata from a music sheet file.

  Analyze the provided music sheet file and extract the following information:
  - Composition Type: The type of composition or arrangement (e.g., percussion ensemble, saxophone ensemble).
  - Composition Name: The name of the composition.
  - Composer: The composer of the music.
  - Arranger: The arranger(s) of the music, if applicable.
  - File Subject: The specific part or content of the file (e.g., "Full Score", "Violin I", "Piano Accompaniment"). This is what the file itself represents.
  - Instrumentations: A comma-separated list of instruments or voice parts in this file (e.g., "Flute, Oboe, Clarinet", "SATB Choir", "Piano", "Full Score").

  Return the information in JSON format.

  Music Sheet File: {{media url=musicSheetDataUri}}`,
});

const extractMusicSheetMetadataFlow = ai.defineFlow(
  {
    name: 'extractMusicSheetMetadataFlow',
    inputSchema: ExtractMusicSheetMetadataInputSchema,
    outputSchema: ExtractMusicSheetMetadataOutputSchema,
  },
  async input => {
    const {output} = await extractMusicSheetMetadataPrompt(input);
    return output!;
  }
);
