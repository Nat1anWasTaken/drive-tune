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
  rootFolderId: z.string().describe('The ID of the root folder in Google Drive.'),
  compositionType: z.string().describe('The type of composition or arrangement (e.g., percussion ensemble, saxophone ensemble).'),
  compositionName: z.string().describe('The name of the composition.'),
  composerArrangers: z.string().describe('The composer(s) and arranger(s) of the music sheet.'),
});
export type CreateMusicSheetDirectoryInput = z.infer<typeof CreateMusicSheetDirectoryInputSchema>;

const CreateMusicSheetDirectoryOutputSchema = z.object({
  directoryPath: z.string().describe('The full path of the created directory in Google Drive.'),
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
  prompt: `You are a directory management expert.

  Based on the provided information, create a nested directory structure in Google Drive under the specified root folder.
  The structure should follow this pattern: [Type of Composition/Arrangement] -> [Composition Name] -> [Composer and Arrangers].

  Input Data:
  - Root Folder ID: {{{rootFolderId}}}
  - Composition Type: {{{compositionType}}}
  - Composition Name: {{{compositionName}}}
  - Composer and Arrangers: {{{composerArrangers}}}

  Return the full directory path that was created and a boolean indicating success.
  Example:
  {
    "directoryPath": "Music Sheets/Percussion Ensemble/My Composition/Arranger1 & Composer2",
    "success": true
  }
  If directory exists return path to existing directory.
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

