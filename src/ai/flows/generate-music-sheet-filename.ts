
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating standardized music sheet filenames
 * for individual parts based on extracted metadata.
 * The filename format will be: [Arrangement Name] - [Part Instrumentation].pdf
 *
 * - generateMusicSheetFilename - A function that takes metadata and returns a standardized filename.
 * - MusicSheetPartMetadataInput - The input type for the generateMusicSheetFilename function.
 * - MusicSheetFilenameOutput - The return type for the generateMusicSheetFilename function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MusicSheetPartMetadataInputSchema = z.object({
  arrangementName: z.string().describe('The name of the overall musical arrangement or composition (e.g., "Bohemian Rhapsody", "The Four Seasons - Spring", "- MIRA -"). This will be the first part of the filename.'),
  partInstrumentation: z.string().describe('The specific instrumentation for this part (e.g., "Violin I", "Flute", "Full Score", "Trumpet-Bb", "Glockenspiel"). This will be the second part of the filename, after a hyphen.')
});
export type MusicSheetPartMetadataInput = z.infer<typeof MusicSheetPartMetadataInputSchema>;

const MusicSheetFilenameOutputSchema = z.object({
  filename: z.string().describe('The generated standardized filename for the music sheet part (e.g., "Bolero - Full Score.pdf").'),
});
export type MusicSheetFilenameOutput = z.infer<typeof MusicSheetFilenameOutputSchema>;

export async function generateMusicSheetFilename(input: MusicSheetPartMetadataInput): Promise<MusicSheetFilenameOutput> {
  return generateMusicSheetFilenameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMusicSheetFilenamePrompt',
  input: {schema: MusicSheetPartMetadataInputSchema},
  output: {schema: MusicSheetFilenameOutputSchema},
  prompt: `You are a music librarian tasked with generating a standardized filename for a specific music sheet part.

  Arrangement Name: {{{arrangementName}}}
  Part Instrumentation: {{{partInstrumentation}}}

  Generate a filename using this format:
  [Arrangement Name] - [Part Instrumentation].pdf

  For example:
  - If Arrangement Name is "The Four Seasons - Spring" and Part Instrumentation is "Violin I", the filename should be: "The Four Seasons - Spring - Violin I.pdf"
  - If Arrangement Name is "Bolero" and Part Instrumentation is "Full Score", the filename should be: "Bolero - Full Score.pdf"
  - If Arrangement Name is "- MIRA -" and Part Instrumentation is "Glockenspiel", the filename should be: "- MIRA - - Glockenspiel.pdf"
  - If Arrangement Name is "My Symphony No. 5" and Part Instrumentation is "Flute-Piccolo", the filename should be: "My Symphony No. 5 - Flute-Piccolo.pdf"


  Ensure the filename is suitable for use in Google Drive. Replace any slashes or other invalid characters (e.g., / \\ : * ? " < > |) in the Arrangement Name or Part Instrumentation with hyphens BEFORE constructing the filename. Preserve intentional hyphens within names like "- MIRA -".
  Return ONLY the filename in the output. Do not include any additional text or explanations.
  `,
});

const generateMusicSheetFilenameFlow = ai.defineFlow(
  {
    name: 'generateMusicSheetFilenameFlow',
    inputSchema: MusicSheetPartMetadataInputSchema,
    outputSchema: MusicSheetFilenameOutputSchema,
  },
  async input => {
    // The prompt instructs the AI to sanitize.
    // A more robust implementation might perform sanitization here as a fallback.
    // For example, ensuring no leading/trailing spaces if not desired, or enforcing specific character replacements.
    const {output} = await prompt({
        arrangementName: input.arrangementName,
        partInstrumentation: input.partInstrumentation
    });
    
    if (!output || !output.filename) {
        throw new Error("AI failed to generate filename or output was empty.");
    }
    // Ensure the filename ends with .pdf, as the prompt might sometimes omit it if not perfectly followed.
    if (!output.filename.toLowerCase().endsWith('.pdf')) {
        output.filename += '.pdf';
    }
    return output;
  }
);
