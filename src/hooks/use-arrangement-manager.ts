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
    }) => Promise<ExtractedMusicSheetMetadata>
  ) => Promise<void>;
  handleProcessAllReadyArrangements: (
    rootFolderDriveId: string | null,
    findOrCreateFolderAPI: (
      folderName: string,
      parentFolderId?: string | "root"
    ) => Promise<string | null>,
    extractMusicSheetMetadata: (data: {
      musicSheetDataUri: string;
    }) => Promise<ExtractedMusicSheetMetadata>
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
      }) => Promise<ExtractedMusicSheetMetadata>
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
          statusMessage: "Extracting metadata from PDF...",
        });
        const metadata = await extractMusicSheetMetadata({
          musicSheetDataUri: dataUri,
        });

        // Determine the definitive arrangement name
        const newArrangementName =
          metadata.title && metadata.title.trim() !== ""
            ? metadata.title
            : arrangement.name;

        // Update arrangement state with the new name and metadata
        // This ensures the UI reflects the new name if it changed
        updateArrangement(arrangement.id, {
          name: newArrangementName,
          extractedMetadata: metadata,
        });

        // Initialize ProcessedParts from metadata
        const initialProcessedParts: ProcessedPart[] = metadata.parts.map(
          (partInfo: PartInformation, index: number): ProcessedPart => ({
            id: `${arrangement.id}-${partInfo.label.replace(
              /\s+/g,
              "_"
            )}-${index}`,
            parentId: arrangement.id,
            ...partInfo, // Spreads label, is_full_score, start_page, end_page, primaryInstrumentation
            status: "pending" as PartStatus,
            statusMessage: "Pending processing.",
            // generatedFilename, driveFileId, error will be set later
          })
        );
        updateArrangement(arrangement.id, {
          processedParts: initialProcessedParts,
          statusMessage: "Metadata extracted. Preparing to process parts.",
        });

        // 4. Create base folder for the arrangement type (e.g., "Concert Band")
        updateArrangement(arrangement.id, {
          status: "creating_drive_folder_structure" as ArrangementStatus,
          statusMessage: `Creating base folder for type: ${metadata.arrangement_type}...`,
        });
        const arrangementTypeBaseFolderId = await findOrCreateFolderAPI(
          metadata.arrangement_type,
          rootFolderDriveId || "root"
        );
        if (!arrangementTypeBaseFolderId) {
          throw new Error(
            `Failed to create or find base folder for type: ${metadata.arrangement_type}`
          );
        }

        // 5. Create a specific folder for this arrangement (e.g., "Bolero - Ravel")
        updateArrangement(arrangement.id, {
          status: "creating_arrangement_folder" as ArrangementStatus,
          statusMessage: `Creating folder for arrangement: ${newArrangementName}...`, // Use newArrangementName
        });
        const arrangementFolderDriveId = await findOrCreateFolderAPI(
          newArrangementName, // Use newArrangementName for folder creation
          arrangementTypeBaseFolderId
        );
        if (!arrangementFolderDriveId) {
          throw new Error(
            `Failed to create or find folder for arrangement: ${newArrangementName}` // Use newArrangementName
          );
        }
        updateArrangement(arrangement.id, {
          targetDirectoryDriveId: arrangementFolderDriveId,
        });

        // 6. Process each part
        updateArrangement(arrangement.id, {
          status: "processing_parts" as ArrangementStatus,
          statusMessage: `Processing ${metadata.parts.length} parts...`,
        });

        const mergedPdfArrayBuffer = await mergedFile.arrayBuffer();
        const pdfDocToSplit = await PDFDocument.load(mergedPdfArrayBuffer);

        let allIndividualPartsProcessedSuccessfully = true;
        let anyIndividualPartFailed = false;

        if (initialProcessedParts.length === 0) {
          // No parts defined by metadata, consider the arrangement 'done'
          updateArrangement(arrangement.id, {
            status: "done" as ArrangementStatus,
            statusMessage:
              "Metadata extracted, no individual parts to process.",
          });
        } else {
          for (const part of initialProcessedParts) {
            try {
              updatePartStatus(
                arrangement.id,
                part.id,
                "processing" as PartStatus,
                `Processing: ${part.label}`
              );

              const partPdfBytes = await splitPdfPart(
                pdfDocToSplit,
                part.start_page,
                part.end_page
              );

              const generatedPartFilename = `${newArrangementName} - ${part.label}.pdf`;

              if (!arrangementFolderDriveId) {
                updatePartStatus(
                  arrangement.id,
                  part.id,
                  "error" as PartStatus,
                  `Error: Arrangement folder ID missing for ${part.label}.`,
                  { error: "Arrangement folder ID missing." }
                );
                allIndividualPartsProcessedSuccessfully = false;
                anyIndividualPartFailed = true;
                continue;
              }

              const partDriveId = await uploadFileToDriveAPI(
                partPdfBytes,
                generatedPartFilename,
                arrangementFolderDriveId
              );

              if (partDriveId) {
                updatePartStatus(
                  arrangement.id,
                  part.id,
                  "done" as PartStatus,
                  `Uploaded: ${part.label}`,
                  {
                    driveFileId: partDriveId,
                    generatedFilename: generatedPartFilename,
                  }
                );
              } else {
                updatePartStatus(
                  arrangement.id,
                  part.id,
                  "error" as PartStatus,
                  `Error: Failed to upload ${part.label}. Check notifications.`,
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
              status: "all_parts_processed" as ArrangementStatus,
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
      // arrangements, // Removed arrangements from here as its direct use for final state check was problematic
      // The state will be naturally consistent due to React's rendering cycle.
      // If specific up-to-date state is needed within processArrangement after an update,
      // it should be retrieved via `setArrangements(prev => { /* use prev here */ return newState; })`
      // or by passing the updated object through the promise chain if absolutely necessary.
      // For now, relying on `newArrangementName` for naming consistency.
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
        musicSheetDataUri: string;
      }) => Promise<ExtractedMusicSheetMetadata>
    ) => {
      const readyArrangements = arrangements.filter(
        (arr) => arr.status === "ready_to_process"
      );
      if (readyArrangements.length === 0) {
        toast({
          title: "No Arrangements to Process",
          description: "There are no arrangements ready for processing.",
        });
        return;
      }
      setIsProcessingGlobal(true);
      for (const arr of readyArrangements) {
        await processArrangement(
          arr,
          rootFolderDriveId,
          findOrCreateFolderAPI,
          extractMusicSheetMetadata
        );
      }
      setIsProcessingGlobal(false);
      toast({
        title: "Processing Complete",
        description: `Finished processing ${readyArrangements.length} arrangement(s).`,
      });
    },
    [arrangements, processArrangement, toast] // processArrangement is now a dependency
  );

  const clearArrangements = () => {
    setArrangements([]);
    arrangementIdCounter = 0; // Reset counter if needed
  };

  return {
    arrangements,
    isProcessingGlobal,
    addNewArrangement,
    updateArrangementName, // Added
    updateArrangement,
    updatePartStatus,
    handleFileChangeForArrangement,
    processArrangement,
    handleProcessAllReadyArrangements,
    clearArrangements,
    uploadFileToDriveAPI,
  };
}
