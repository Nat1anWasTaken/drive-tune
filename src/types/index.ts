// src/types/index.ts

// Information for a single part within a music sheet
export type PartInformation = {
  label: string; // e.g., "Flute I", "Full Score"
  is_full_score: boolean;
  start_page: number;
  end_page: number;
  primaryInstrumentation: string; // e.g., "Flute", "Violin I", "Full Score", "Trumpet-Bb"
};

// Output schema for the metadata extraction flow
export interface ExtractedMusicSheetMetadata {
  title: string; // Overall title of the composition
  composers: string[]; // Array of composer/arranger names
  arrangement_type: string; // e.g., "Concert Band", "String Quartet"
  parts: PartInformation[];
}

// Represents an "Arrangement" uploaded by the user
export interface Arrangement {
  id: string; // Unique ID for this arrangement
  name: string; // User-editable name for the arrangement (e.g., "Bolero Arrangement"), will be updated with extracted title
  files?: File[]; // Array of PDF files for this arrangement
  dataUri?: string; // Data URI of the (potentially merged) file
  status: ArrangementStatus; // Overall status of processing this arrangement
  statusMessage: string;
  extractedMetadata?: ExtractedMusicSheetMetadata;
  processedParts: ProcessedPart[]; // Individual parts derived from this arrangement
  targetDirectoryDriveId?: string; // Drive ID of the specific type folder (e.g., "Concert Band") for this arrangement
  error?: string;
}

// Represents an individual part being processed
export interface ProcessedPart extends PartInformation {
  id: string; // Unique ID for this part (e.g., arrangementId + '-' + label)
  parentId: string; // ID of the parent Arrangement
  status: PartStatus; // Status of processing this individual part
  statusMessage: string;
  generatedFilename?: string;
  driveFileId?: string; // Drive ID of the uploaded part file
  error?: string;
}

export type ArrangementStatus =
  | "pending_upload" // Waiting for file to be added
  | "ready_to_process" // File uploaded, ready for processing
  | "merging_files" // If multiple files, currently merging them
  | "reading_file" // Reading the main PDF file (single or merged)
  | "extracting_metadata" // AI extracting metadata for all parts
  | "creating_drive_folder_structure" // Creating folders in Google Drive
  | "creating_arrangement_folder" // Creating a specific folder for the arrangement
  | "processing_parts" // Looping through parts (splitting, naming, uploading)
  | "all_parts_processed" // All parts processed (some might have errors)
  | "done" // Arrangement fully processed successfully
  | "error"; // Error at the arrangement level

export type PartStatus =
  | "pending" // Part identified, waiting for individual processing
  | "splitting" // If PDF splitting is needed for this part
  | "naming" // Generating filename for this part
  | "uploading_to_drive" // Uploading this part to Google Drive
  | "done" // Part processed successfully and uploaded
  | "error"; // Error processing this part
