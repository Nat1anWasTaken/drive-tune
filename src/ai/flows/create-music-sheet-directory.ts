
'use server';

/**
 * @fileOverview Creates a nested directory structure in Google Drive based on music sheet metadata.
 *
 * - createMusicSheetDirectory - A function that handles the directory creation process.
 * - CreateMusicSheetDirectoryInput - The input type for the createMusicSheetDirectory function.
 * - CreateMusicSheetDirectoryOutput - The return type for the createMusicSheetDirectory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CreateMusicSheetDirectoryInputSchema = z.object({
  rootFolderName: z.string().describe('The name of the root folder in Google Drive provided by the user (e.g., "My Music Sheets").'),
  compositionType: z.string().describe('The type of composition or arrangement (e.g., "Percussion Ensemble", "Saxophone Quartet"), which will be the first subfolder name.'),
  compositionName: z.string().describe('The name of the overall composition (e.g., "Bolero", "The Four Seasons"), which will be part of the second subfolder name.'),
  composerArrangers: z.string().describe('The composer(s) and/or arranger(s) (e.g., "John Williams", "Mozart (Arr. Liszt)"), which will be part of the second subfolder name, following " by ".'),
});
export type CreateMusicSheetDirectoryInput = z.infer<typeof CreateMusicSheetDirectoryInputSchema>;

const CreateMusicSheetDirectoryOutputSchema = z.object({
  directoryPath: z.string().describe('The full path of the created directory in Google Drive, starting with the rootFolderName.'),
  success: z.boolean().describe('Indicates whether the directory creation was successful.'),
});
export type CreateMusicSheetDirectoryOutput = z.infer<typeof CreateMusicSheetDirectoryOutputSchema>;

export async function createMusicSheetDirectory(input: CreateMusicSheetDirectoryInput): Promise<CreateMusicSheetDirectoryOutput> {
  return createMusicSheetDirectoryFlow(input);
}

const createDirectoryPrompt = ai.definePrompt({
  name: 'createDirectoryPrompt',
  input: {schema: CreateMusicSheetDirectoryInputSchema},
  output: {schema: CreateMusicSheetDirectoryOutputSchema},
  prompt: `You are a directory management expert simulating directory creation.

  Based on the provided information, determine the target directory structure.
  The structure should be:
  {{{rootFolderName}}}/{{{compositionType}}}/{{{compositionName}}} by {{{composerArrangers}}}

  Input Data:
  - Root Folder Name: {{{rootFolderName}}}
  - Composition Type (Arrangement Type): {{{compositionType}}}
  - Composition Name: {{{compositionName}}}
  - Composer and Arrangers: {{{composerArrangers}}}

  Return the full conceptual directory path of the deepest folder where the file would reside and a boolean indicating success.
  Ensure the path components (compositionType, compositionName, composerArrangers) are sanitized for use as folder names (e.g., remove or replace invalid characters like '/').

  Example for input (rootFolderName: "My Digital Scores", compositionType: "String Quartet", compositionName: "Op. 18 No. 1", composerArrangers: "L. van Beethoven"):
  {
    "directoryPath": "My Digital Scores/String Quartet/Op. 18 No. 1 by L. van Beethoven",
    "success": true
  }

  Example for input (rootFolderName: "Band Music", compositionType: "Concert Band", compositionName: "Star Wars Saga", composerArrangers: "John Williams (Arr. Paul Lavender)"):
  {
    "directoryPath": "Band Music/Concert Band/Star Wars Saga by John Williams (Arr. Paul Lavender)",
    "success": true
  }

  If a directory conceptually already exists, return the path to that existing directory.
  `,
});

const createMusicSheetDirectoryFlow = ai.defineFlow(
  {
    name: 'createMusicSheetDirectoryFlow',
    inputSchema: CreateMusicSheetDirectoryInputSchema,
    outputSchema: CreateMusicSheetDirectoryOutputSchema,
  },
  async input => {
    const {output} = await createDirectoryPrompt(input);
    return output!;
  }
);
