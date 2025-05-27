// src/types/index.ts

// Information for a single part within a music sheet
export type PartInformation = {
  label: string; // e.g., "Flute I", "Full Score"
  is_full_score: boolean;
  start_page: number;
  end_page: number;
};

// Output schema for the metadata extraction flow
export interface ExtractedMusicSheetMetadata {
  title: string; // Overall title of the composition
  composers: string[]; // Array of composer/arranger names
  arrangement_type: string; // e.g., "Concert Band", "String Quartet"
  parts: PartInformation[]; // Array of parts found in the sheet
}

// Represents an "Arrangement" uploaded by the user
export interface Arrangement {
  id: string; // Unique ID for this arrangement
  name: string; // User-editable name for the arrangement (e.g., "Bolero Arrangement")
  file?: File; // The single PDF file for this arrangement
  dataUri?: string; // Data URI of the file
  status: ArrangementStatus; // Overall status of processing this arrangement
  statusMessage: string;
  extractedMetadata?: ExtractedMusicSheetMetadata;
  processedParts: ProcessedPart[]; // Individual parts derived from this arrangement
  targetDirectoryPath?: string; // Common directory for all parts of this arrangement
  error?: string;
}

// Represents an individual part being processed
export interface ProcessedPart extends PartInformation {
  id: string; // Unique ID for this part (e.g., arrangementId + '-' + label)
  parentId: string; // ID of the parent Arrangement
  status: PartStatus; // Status of processing this individual part
  statusMessage: string;
  generatedFilename?: string;
  error?: string;
}

export type ArrangementStatus =
  | 'pending_upload' // Waiting for file to be added
  | 'ready_to_process' // File uploaded, ready for processing
  | 'reading_file'     // Reading the main PDF file
  | 'extracting_metadata' // AI extracting metadata for all parts
  | 'processing_parts'  // Looping through parts to name and organize them
  | 'creating_directory' // Determining base directory for all parts
  | 'all_parts_processed' // All parts processed (some might have errors)
  | 'done' // Arrangement fully processed successfully
  | 'error'; // Error at the arrangement level

export type PartStatus =
  | 'pending' // Part identified, waiting for individual processing
  | 'naming' // Generating filename for this part
  | 'organizing' // Simulating upload/move for this part
  | 'done' // Part processed successfully
  | 'error'; // Error processing this part
