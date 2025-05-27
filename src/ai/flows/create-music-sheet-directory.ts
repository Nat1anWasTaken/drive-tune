
'use server';

/**
 * @fileOverview Creates a nested directory structure in Google Drive based on music sheet metadata.
 * The structure will be: RootFolder/{arrangement_type}.
 *
 * - createMusicSheetDirectory - A function that handles the directory creation process.
 * - CreateMusicSheetDirectoryInput - The input type for the createMusicSheetDirectory function.
 * - CreateMusicSheetDirectoryOutput - The return type for the createMusicSheetDirectory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CreateMusicSheetDirectoryInputSchema = z.object({
  rootFolderName: z.string().describe('The name of the root folder in Google Drive provided by the user (e.g., "My Music Sheets").'),
  arrangement_type: z.string().describe('The type of composition or arrangement (e.g., "Percussion Ensemble", "Saxophone Quartet"), which will be the subfolder name under the root folder.'),
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
  {{{rootFolderName}}}/{{{arrangement_type}}}

  Input Data:
  - Root Folder Name: {{{rootFolderName}}}
  - Arrangement Type: {{{arrangement_type}}}

  Return the full conceptual directory path of the deepest folder where the file would reside and a boolean indicating success.
  Ensure the path component (arrangement_type) is sanitized for use as a folder name (e.g., remove or replace invalid characters like '/').

  Example for input (rootFolderName: "My Digital Scores", arrangement_type: "String Quartet"):
  {
    "directoryPath": "My Digital Scores/String Quartet",
    "success": true
  }

  Example for input (rootFolderName: "Band Music", arrangement_type: "Concert Band"):
  {
    "directoryPath": "Band Music/Concert Band",
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
