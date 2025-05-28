"use client";

// Import types from the central types file
import { PDFDocument } from "pdf-lib";
import { useCallback, useState } from "react";
import {
  Arrangement,
  ArrangementStatus,
  ExtractedMusicSheetMetadata,
  PartInformation,
  PartStatus,
  ProcessedPart,
} from "../types"; // Adjusted path
import { GoogleDriveAuth } from "./use-google-drive-auth"; // Corrected import name
import { useToast } from "./use-toast";

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let arrangementIdCounter = 0;

export interface ArrangementManager {
  arrangements: Arrangement[];
  isProcessingGlobal: boolean;
  addNewArrangement: () => void;
  updateArrangementName: (arrangementId: string, newName: string) => void; // Added
  updateArrangement: (id: string, updates: Partial<Arrangement>) => void;
  removeArrangement: (id: string) => void;
  updatePartStatus: (
    arrangementId: string,
    partId: string,
    status: PartStatus, // Use imported PartStatus
    message: string,
    details?: Partial<ProcessedPart>
  ) => void;
  handleFileChangeForArrangement: (
    arrangementId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  processArrangement: (
    arrangement: Arrangement, // Use imported Arrangement
    rootFolderDriveId: string | null,
    findOrCreateFolderAPI: (
      folderName: string,
      parentFolderId?: string | "root"
    ) => Promise<string | null>,
    extractMusicSheetMetadata: (data: {
      musicSheetDataUri: string;
      existingArrangementTypes: string[]; // Changed from { id: string; name: string }[] to string[]
      additionalInstructions?: string;
    }) => Promise<ExtractedMusicSheetMetadata>,
    getExistingArrangementTypes: () => Promise<{ id: string; name: string }[]>, // Added
    additionalInstructions?: string // Optional additional instructions for AI
  ) => Promise<void>;
  handleProcessAllReadyArrangements: (
    rootFolderDriveId: string | null,
    findOrCreateFolderAPI: (
      folderName: string,
      parentFolderId?: string | "root"
    ) => Promise<string | null>,
    extractMusicSheetMetadata: (data: {
      // Ensure this is part of the signature
      musicSheetDataUri: string;
      existingArrangementTypes: string[]; // Changed from { id: string; name: string }[] to string[]
      additionalInstructions?: string;
    }) => Promise<ExtractedMusicSheetMetadata>,
    getExistingArrangementTypes: () => Promise<{ id: string; name: string }[]>, // Added
    additionalInstructions?: string // Optional additional instructions for AI
  ) => Promise<void>;
  clearArrangements: () => void;
  uploadFileToDriveAPI: (
    fileContentBytes: Uint8Array,
    fileName: string,
    parentFolderId: string
  ) => Promise<string | null>;
}

export function useArrangementManager(
  auth: GoogleDriveAuth // Use the correct type from the hook file
): ArrangementManager {
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);
  const { toast } = useToast();
  const { accessToken } = auth;

  const addNewArrangement = () => {
    arrangementIdCounter++;
    const newArrangement: Arrangement = {
      id: `arr-${Date.now()}-${arrangementIdCounter}`,
      name: `Arrangement ${arrangementIdCounter}`,
      status: "pending_upload" as ArrangementStatus, // Use imported ArrangementStatus
      statusMessage: "Please upload PDF file(s) for this arrangement.",
      processedParts: [],
      files: [], // Initialize as empty array, compatible with File[] | undefined
      // extractedMetadata, targetDirectoryDriveId will be undefined by default
    };
    setArrangements((prev) => [...prev, newArrangement]);
  };

  const updateArrangementName = useCallback(
    (arrangementId: string, newName: string) => {
      setArrangements((prevArrangements) =>
        prevArrangements.map((arr) =>
          arr.id === arrangementId ? { ...arr, name: newName } : arr
        )
      );
    },
    []
  );

  const updateArrangement = useCallback(
    (id: string, updates: Partial<Arrangement>) => {
      setArrangements((prev) =>
        prev.map((arr) => (arr.id === id ? { ...arr, ...updates } : arr))
      );
    },
    []
  );

  const removeArrangement = useCallback((id: string) => {
    setArrangements((prevArrangements) =>
      prevArrangements.filter((arr) => arr.id !== id)
    );
  }, []);

  const updatePartStatus = useCallback(
    (
      arrangementId: string,
      partId: string,
      status: PartStatus, // Use imported PartStatus
      message: string,
      details?: Partial<ProcessedPart>
    ) => {
      setArrangements((prevArrangements) =>
        prevArrangements.map((arr) => {
          if (arr.id === arrangementId) {
            return {
              ...arr,
              processedParts: arr.processedParts.map((p) =>
                p.id === partId
                  ? { ...p, status, statusMessage: message, ...details }
                  : p
              ),
            };
          }
          return arr;
        })
      );
    },
    []
  );

  const handleFileChangeForArrangement = useCallback(
    (arrangementId: string, event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        const selectedFiles = Array.from(event.target.files);
        const pdfFiles = selectedFiles.filter(
          (file) => file.type === "application/pdf"
        );

        if (pdfFiles.length !== selectedFiles.length) {
          toast({
            variant: "destructive",
            title: "Invalid File Type",
            description: "Please upload only PDF files.",
          });
        }
        if (pdfFiles.length === 0 && event.target) {
          if (event.target) event.target.value = "";
          updateArrangement(arrangementId, {
            files: [],
            status: "pending_upload" as ArrangementStatus,
            statusMessage: "Upload cancelled or no PDF files selected.",
          });
          return;
        }
        updateArrangement(arrangementId, {
          files: pdfFiles,
          status: "ready_to_process" as ArrangementStatus,
          statusMessage: `${pdfFiles.length} file(s) ready. Click process to continue.`,
        });
      }
    },
    [toast, updateArrangement]
  );

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  async function mergePdfs(
    files: File[],
    arrangementId: string
  ): Promise<File> {
    // Add arrangementId parameter
    updateArrangement(arrangementId, {
      // Use the passed arrangementId
      status: "merging_files" as ArrangementStatus,
      statusMessage: `Merging ${files.length} PDF files...`,
    });
    const mergedPdfDoc = await PDFDocument.create();
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      try {
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdfDoc.copyPages(
          pdf,
          pdf.getPageIndices()
        );
        copiedPages.forEach((page) => {
          mergedPdfDoc.addPage(page);
        });
      } catch (e: any) {
        console.error(`Error loading or copying pages from ${file.name}:`, e);
        toast({
          variant: "destructive",
          title: `PDF Error (${file.name})`,
          description: `Could not process ${file.name}. It might be corrupted or password-protected. ${e.message}`,
        });
        throw new Error(
          `Could not process ${file.name}. It might be corrupted or password-protected.`
        );
      }
    }
    const mergedPdfBytes = await mergedPdfDoc.save();
    return new File([mergedPdfBytes], `merged_${Date.now()}.pdf`, {
      type: "application/pdf",
    });
  }

  async function splitPdfPart(
    originalPdfDoc: PDFDocument,
    startPage: number, // Corresponds to PartInformation.start_page
    endPage: number // Corresponds to PartInformation.end_page
  ): Promise<Uint8Array> {
    const newPdfDoc = await PDFDocument.create();
    const pageIndices = [];
    // pdf-lib pages are 0-indexed, PartInformation.start_page is 1-indexed
    for (let i = startPage - 1; i < endPage; i++) {
      if (i >= 0 && i < originalPdfDoc.getPageCount()) {
        pageIndices.push(i);
      }
    }
    if (pageIndices.length === 0) {
      throw new Error(
        `No valid pages found for range ${startPage}-${endPage}. Max page: ${originalPdfDoc.getPageCount()}`
      );
    }
    const copiedPages = await newPdfDoc.copyPages(originalPdfDoc, pageIndices);
    copiedPages.forEach((page) => newPdfDoc.addPage(page));
    return newPdfDoc.save();
  }

  const uploadFileToDriveAPI = useCallback(
    async (
      fileContentBytes: Uint8Array,
      fileName: string,
      parentFolderId: string
    ): Promise<string | null> => {
      if (!accessToken) {
        toast({
          variant: "destructive",
          title: "Not Connected",
          description:
            "Authentication token is missing. Cannot upload to Drive.",
        });
        return null;
      }
      try {
        const fileContentBase64 = arrayBufferToBase64(fileContentBytes.buffer);
        const response = await fetch("/api/drive-handler", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            action: "uploadFile",
            fileName,
            fileContentBase64,
            parentFolderId,
            mimeType: "application/pdf",
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(
            result.error || `Failed to upload file \"${fileName}\"`
          );
        }
        toast({
          title: "File Uploaded",
          description: `"${fileName}" uploaded successfully.`,
        });
        return result.driveFileId as string; // Changed from result.fileId to result.driveFileId
      } catch (error: any) {
        console.error("Upload error:", error);
        toast({
          variant: "destructive",
          title: `Upload Failed: ${fileName}`,
          description: error.message || "Unknown error during upload.",
        });
        return null;
      }
    },
    [accessToken, toast]
  );

  const processArrangement = useCallback(
    async (
      arrangement: Arrangement,
      rootFolderDriveId: string | null,
      findOrCreateFolderAPI: (
        folderName: string,
        parentFolderId?: string | "root"
      ) => Promise<string | null>,
      extractMusicSheetMetadata: (data: {
        musicSheetDataUri: string;
        existingArrangementTypes: string[];
        additionalInstructions?: string; // Optional additional instructions
      }) => Promise<ExtractedMusicSheetMetadata>,
      getExistingArrangementTypes: () => Promise<
        { id: string; name: string }[]
      >,
      additionalInstructions?: string // Optional additional instructions for AI
    ) => {
      if (!arrangement.files || arrangement.files.length === 0) {
        updateArrangement(arrangement.id, {
          status: "error" as ArrangementStatus,
          statusMessage: "No files found for this arrangement.",
          error: "No files to process.",
        });
        return;
      }

      setIsProcessingGlobal(true);
      let mergedFile: File = arrangement.files[0];
      let dataUri = "";

      try {
        // 1. Merge PDFs if multiple
        if (arrangement.files.length > 1) {
          updateArrangement(arrangement.id, {
            status: "merging_files" as ArrangementStatus,
            statusMessage: `Merging ${arrangement.files.length} PDF files...`,
          });
          mergedFile = await mergePdfs(arrangement.files, arrangement.id); // Pass arrangement.id here
        }

        // 2. Read file as Data URI
        updateArrangement(arrangement.id, {
          status: "reading_file" as ArrangementStatus,
          statusMessage: `Reading ${mergedFile.name}...`,
        });
        dataUri = await readFileAsDataURL(mergedFile);
        updateArrangement(arrangement.id, { dataUri });

        // 3. Extract Metadata
        updateArrangement(arrangement.id, {
          status: "extracting_metadata" as ArrangementStatus,
          statusMessage: "AI analyzing sheet music and selecting type...",
        });

        const existingArrangementTypesObjects =
          await getExistingArrangementTypes();
        const existingArrangementTypeNames =
          existingArrangementTypesObjects.map((type) => type.name);

        let metadata: ExtractedMusicSheetMetadata;
        try {
          metadata = await extractMusicSheetMetadata({
            musicSheetDataUri: dataUri,
            existingArrangementTypes: existingArrangementTypeNames, // Pass only names
            additionalInstructions: additionalInstructions,
          });
          updateArrangement(arrangement.id, { extractedMetadata: metadata });
        } catch (metadataError) {
          console.error("Metadata extraction error:", metadataError);
          toast({
            variant: "destructive",
            title: "Metadata Extraction Failed",
            description: "AI could not extract metadata from the PDF.",
          });
          updateArrangement(arrangement.id, {
            status: "error" as ArrangementStatus,
            statusMessage: "Metadata extraction failed.",
            error: "Metadata extraction failed.",
          });
          setIsProcessingGlobal(false);
          return;
        }

        // Validate AI's choice of arrangement_type against existing types
        const chosenTypeObject = existingArrangementTypesObjects.find(
          (type) => type.name === metadata.arrangement_type
        );

        if (!chosenTypeObject) {
          toast({
            title: "AI Selection Error",
            description: `The AI selected an invalid or non-existent arrangement type: ('${
              metadata.arrangement_type
            }'). It must match one of the existing type folders: ${existingArrangementTypesObjects
              .map((t) => t.name)
              .join(", ")}.`,
            variant: "destructive",
          });
          updateArrangement(arrangement.id, {
            status: "error",
            statusMessage: `AI selected an invalid type: '${metadata.arrangement_type}'.`,
          });
          setIsProcessingGlobal(false); // Ensure global processing flag is reset
          return;
        }

        const chosenArrangementTypeId = chosenTypeObject.id;
        const chosenArrangementTypeName = chosenTypeObject.name;

        // Create initial ProcessedPart objects from metadata.parts
        // These will have IDs that can be used by updatePartStatus later.
        const initialProcessedParts: ProcessedPart[] = metadata.parts.map(
          (p: PartInformation, index: number): ProcessedPart => ({
            id: `${arrangement.id}-${p.label.replace(/\s+/g, "_")}-${index}`,
            parentId: arrangement.id,
            ...p, // Spreads label, is_full_score, start_page, end_page, primaryInstrumentation
            status: "pending" as PartStatus,
            statusMessage: "Waiting for PDF split",
            // generatedFilename, driveFileId, error will be set later
          })
        );

        updateArrangement(arrangement.id, {
          name: metadata.title || arrangement.name,
          extractedMetadata: metadata,
          targetDirectoryDriveId: chosenArrangementTypeId, // This is the ID of the TYPE folder
          processedParts: initialProcessedParts, // Store the parts with IDs
          status: "creating_drive_folder_structure",
          statusMessage: `Type: ${chosenArrangementTypeName}. Preparing to create folder for '${
            metadata.title || arrangement.name
          }'...`,
        });

        const arrangementSpecificFolderName =
          metadata.title || arrangement.name;
        updateArrangement(arrangement.id, {
          status: "creating_arrangement_folder" as ArrangementStatus,
          statusMessage: `Creating folder for arrangement: ${arrangementSpecificFolderName}...`,
        });

        const arrangementSpecificFolderId = await findOrCreateFolderAPI(
          arrangementSpecificFolderName,
          chosenArrangementTypeId // Parent is the CHOSEN TYPE FOLDER
        );

        if (!arrangementSpecificFolderId) {
          throw new Error(
            `Failed to create or find folder for arrangement '${arrangementSpecificFolderName}' in type '${chosenArrangementTypeName}'.`
          );
        }
        // If you need to store this ID on the arrangement object itself, add a field to the Arrangement type
        // and update it here, e.g.:
        // updateArrangement(arrangement.id, { arrangementInstanceFolderId: arrangementSpecificFolderId });

        updateArrangement(arrangement.id, {
          status: "processing_parts" as ArrangementStatus,
          statusMessage: `Processing ${initialProcessedParts.length} parts...`,
        });

        const mergedPdfArrayBuffer = await (arrangement.dataUri
          ? fetch(arrangement.dataUri).then((res) => res.arrayBuffer())
          : mergedFile.arrayBuffer());
        const pdfDocToSplit = await PDFDocument.load(mergedPdfArrayBuffer);

        let allIndividualPartsProcessedSuccessfully = true;
        let anyIndividualPartFailed = false;

        if (initialProcessedParts.length === 0) {
          updateArrangement(arrangement.id, {
            status: "done" as ArrangementStatus,
            statusMessage:
              "Metadata extracted, no individual parts to process.",
          });
        } else {
          // Iterate over initialProcessedParts, which are ProcessedPart objects and have an .id
          for (const part of initialProcessedParts) {
            try {
              updatePartStatus(
                arrangement.id,
                part.id, // part.id is now valid as we are iterating over ProcessedPart[]
                "splitting" as PartStatus, // Changed from "processing" to be more specific
                `Splitting: ${part.label}`
              );

              const partPdfBytes = await splitPdfPart(
                pdfDocToSplit,
                part.start_page,
                part.end_page
              );

              const generatedPartFilename = `${
                metadata.title || arrangement.name
              } - ${part.label}.pdf`;
              updatePartStatus(
                arrangement.id,
                part.id,
                "uploading_to_drive",
                `Uploading: ${generatedPartFilename}`,
                { generatedFilename: generatedPartFilename }
              );

              if (!arrangementSpecificFolderId) {
                // This check should ideally be redundant if the flow guarantees arrangementSpecificFolderId by now
                updatePartStatus(
                  arrangement.id,
                  part.id,
                  "error" as PartStatus,
                  `Error: Arrangement-specific folder ID missing for ${part.label}.`,
                  { error: "Arrangement-specific folder ID missing." }
                );
                allIndividualPartsProcessedSuccessfully = false;
                anyIndividualPartFailed = true;
                continue;
              }

              const partDriveId = await uploadFileToDriveAPI(
                partPdfBytes,
                generatedPartFilename,
                arrangementSpecificFolderId // Upload to the arrangement-specific folder
              );

              if (partDriveId) {
                updatePartStatus(
                  arrangement.id,
                  part.id,
                  "done" as PartStatus,
                  `Uploaded: ${part.label}`,
                  {
                    driveFileId: partDriveId,
                    // generatedFilename is already set above
                  }
                );
              } else {
                updatePartStatus(
                  arrangement.id,
                  part.id,
                  "error" as PartStatus,
                  `Error: Failed to upload ${part.label}. Check Drive API logs.`,
                  { error: `Failed to upload ${part.label}.` }
                );
                allIndividualPartsProcessedSuccessfully = false;
                anyIndividualPartFailed = true;
              }
            } catch (e: any) {
              console.error(
                `Error processing part ${part.label} for arrangement ${arrangement.id}:`,
                e
              );
              updatePartStatus(
                arrangement.id,
                part.id,
                "error" as PartStatus,
                `Error processing ${part.label}: ${e.message}`,
                { error: e.message }
              );
              allIndividualPartsProcessedSuccessfully = false;
              anyIndividualPartFailed = true;
            }
          }

          if (allIndividualPartsProcessedSuccessfully) {
            updateArrangement(arrangement.id, {
              status: "done" as ArrangementStatus,
              statusMessage: "All parts processed and uploaded successfully.",
            });
          } else if (anyIndividualPartFailed) {
            updateArrangement(arrangement.id, {
              status: "all_parts_processed" as ArrangementStatus, // A more specific status if some parts failed
              statusMessage:
                "Finished processing. Some parts encountered errors.",
            });
          }
        }
      } catch (error: any) {
        console.error(
          `Error processing arrangement ${arrangement.name}:`,
          error
        );
        updateArrangement(arrangement.id, {
          status: "error" as ArrangementStatus,
          statusMessage: `Failed to process arrangement: ${error.message}`,
          error: error.message,
        });
      } finally {
        setIsProcessingGlobal(false);
      }
    },
    [
      updateArrangement,
      updatePartStatus,
      uploadFileToDriveAPI,
      toast,
      // readFileAsDataURL and mergePdfs are defined within the hook or should be stable dependencies
    ]
  );

  const handleProcessAllReadyArrangements = useCallback(
    async (
      rootFolderDriveId: string | null,
      findOrCreateFolderAPI: (
        folderName: string,
        parentFolderId?: string | "root"
      ) => Promise<string | null>,
      extractMusicSheetMetadata: (data: {
        // Ensure signature matches
        musicSheetDataUri: string;
        existingArrangementTypes: string[];
        additionalInstructions?: string; // Optional additional instructions
      }) => Promise<ExtractedMusicSheetMetadata>,
      getExistingArrangementTypes: () => Promise<
        { id: string; name: string }[]
      >,
      additionalInstructions?: string // Optional additional instructions for AI
    ) => {
      const readyArrangements = arrangements.filter(
        (arr) =>
          arr.status === "ready_to_process" && arr.files && arr.files.length > 0
      );
      if (readyArrangements.length === 0) {
        toast({
          title: "Nothing to process",
          description: "No arrangements are ready for processing.",
          variant: "default",
        });
        return;
      }
      setIsProcessingGlobal(true);
      for (const arr of readyArrangements) {
        // Pass all required arguments, including getExistingArrangementTypes
        await processArrangement(
          arr,
          rootFolderDriveId,
          findOrCreateFolderAPI,
          extractMusicSheetMetadata,
          getExistingArrangementTypes, // Make sure this is passed
          additionalInstructions // Optional additional instructions for AI
        );
      }
      setIsProcessingGlobal(false);
      toast({
        title: "Processing Complete",
        description: `Finished processing ${readyArrangements.length} arrangement(s).`,
      });
    },
    [arrangements, processArrangement, toast] // processArrangement is a dependency
  );

  const clearArrangements = () => {
    setArrangements([]);
    arrangementIdCounter = 0; // Reset counter if needed
  };

  return {
    arrangements,
    isProcessingGlobal,
    addNewArrangement,
    updateArrangementName,
    updateArrangement,
    removeArrangement,
    updatePartStatus,
    handleFileChangeForArrangement,
    processArrangement,
    handleProcessAllReadyArrangements,
    clearArrangements,
    uploadFileToDriveAPI,
  };
}
