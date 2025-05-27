import type { ExtractMusicSheetMetadataOutput } from "@/ai/flows/extract-music-sheet-metadata";

export type FileStatus = 
  | 'pending'
  | 'reading'
  | 'extracting'
  | 'naming'
  | 'creating_dir'
  | 'organizing' // Generic step for AI processing
  | 'done'
  | 'error';

export interface ProcessedFile {
  file: File;
  id: string;
  status: FileStatus;
  statusMessage: string;
  metadata?: ExtractMusicSheetMetadataOutput;
  generatedFilename?: string;
  targetDirectoryPath?: string;
  error?: string;
  dataUri?: string;
}
