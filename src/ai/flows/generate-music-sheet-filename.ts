
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating standardized music sheet filenames
 * for individual parts based on extracted metadata.
 * The filename format will be: [File Subject] - [Instrumentation].pdf
 *
 * - generateMusicSheetFilename - A function that takes part metadata and returns a standardized filename.
 * - MusicSheetPartMetadataInput - The input type for the generateMusicSheetFilename function.
 * - MusicSheetFilenameOutput - The return type for the generateMusicSheetFilename function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MusicSheetPartMetadataInputSchema = z.object({
  fileSubject: z.string().describe('The subject of the part (e.g., "Full Score", "Violin I"). This will be the first part of the filename.'),
  instrumentation: z.string().describe('The primary instrumentation for this part (e.g., "Violin", "Flute"). This will be the second part of the filename, after a hyphen.'),
});
export type MusicSheetPartMetadataInput = z.infer<typeof MusicSheetPartMetadataInputSchema>;

const MusicSheetFilenameOutputSchema = z.object({
  filename: z.string().describe('The generated standardized filename for the music sheet part (e.g., "Violin I - Violin.pdf").'),
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

  File Subject: {{{fileSubject}}}
  Instrumentation: {{{instrumentation}}}

  Generate a filename using this format:
  [File Subject] - [Instrumentation].pdf

  For example:
  - If File Subject is "Violin I" and Instrumentation is "Violin", the filename should be: "Violin I - Violin.pdf"
  - If File Subject is "Full Score" and Instrumentation is "Full Score", the filename should be: "Full Score - Full Score.pdf"
  - If File Subject is "Bb Clarinet 1" and Instrumentation is "Bb Clarinet", the filename should be: "Bb Clarinet 1 - Bb Clarinet.pdf"
  - If File Subject is "Flute/Piccolo" and Instrumentation is "Flute-Piccolo", the filename should be: "Flute-Piccolo - Flute-Piccolo.pdf"


  Ensure the filename is suitable for use in Google Drive. Replace any slashes or other invalid characters in the File Subject or Instrumentation with hyphens before constructing the filename.
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
    // Sanitize inputs for filename usage (replace slashes, etc.)
    const sanitizedFileSubject = input.fileSubject.replace(/[/\\]/g, '-');
    const sanitizedInstrumentation = input.instrumentation.replace(/[/\\]/g, '-');
    
    const {output} = await prompt({ 
        fileSubject: sanitizedFileSubject,
        instrumentation: sanitizedInstrumentation
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

