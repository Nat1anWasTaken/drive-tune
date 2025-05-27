
"use client";

import { useState, useRef } from 'react';
import type { Arrangement, ProcessedPart, PartInformation, ArrangementStatus, PartStatus, ExtractedMusicSheetMetadata } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrangementListItem } from "@/components/ArrangementListItem";
import { extractMusicSheetMetadata } from "@/ai/flows/extract-music-sheet-metadata";
import { generateMusicSheetFilename } from "@/ai/flows/generate-music-sheet-filename";
import { createMusicSheetDirectory } from "@/ai/flows/create-music-sheet-directory";
import { UploadCloud, CheckCircle, FolderOpenDot, LogIn, Link as LinkIcon, Sparkles, Loader2, PlusCircle, Music2, Merge } from "lucide-react";
import { PDFDocument } from 'pdf-lib';


const MOCK_DRIVE_CONNECTED_DELAY = 1000;
const MOCK_FOLDER_SELECTED_DELAY = 500;

let arrangementIdCounter = 0;

export default function DriveTuneApp() {
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [tempFolderId, setTempFolderId] = useState("My Music Sheets");
  
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);

  const { toast } = useToast();

  const handleConnectDrive = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsDriveConnected(true);
      setIsConnecting(false);
      toast({ title: "Success", description: "Connected to Google Drive (Simulated)." });
    }, MOCK_DRIVE_CONNECTED_DELAY);
  };

  const handleSelectRootFolder = () => {
    if (!tempFolderId.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a root folder name." });
      return;
    }
    setIsSelectingFolder(true);
    setTimeout(() => {
      setRootFolderId(tempFolderId.trim());
      setIsSelectingFolder(false);
      toast({ title: "Success", description: `Root folder set to: "${tempFolderId.trim()}" (Simulated).` });
    }, MOCK_FOLDER_SELECTED_DELAY);
  };

  const addNewArrangement = () => {
    arrangementIdCounter++;
    const newArrangement: Arrangement = {
      id: `arr-${Date.now()}-${arrangementIdCounter}`,
      name: `Arrangement ${arrangementIdCounter}`, // This will be updated after metadata extraction
      status: 'pending_upload',
      statusMessage: 'Please upload PDF file(s) for this arrangement.',
      processedParts: [],
      files: [],
    };
    setArrangements(prev => [...prev, newArrangement]);
  };

  const updateArrangement = (id: string, updates: Partial<Arrangement>) => {
    setArrangements(prev => prev.map(arr => arr.id === id ? { ...arr, ...updates } : arr));
  };

  const updatePartStatus = (arrangementId: string, partId: string, status: PartStatus, message: string, details?: Partial<ProcessedPart>) => {
    setArrangements(prev => prev.map(arr => {
      if (arr.id === arrangementId) {
        return {
          ...arr,
          processedParts: arr.processedParts.map(p => p.id === partId ? { ...p, status, statusMessage: message, ...details } : p),
        };
      }
      return arr;
    }));
  };
  
  const handleFileChangeForArrangement = (arrangementId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFiles = Array.from(event.target.files);
      const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
      
      if (pdfFiles.length !== selectedFiles.length) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload only PDF files." });
      }
      if (pdfFiles.length === 0 && event.target) {
         if (event.target) event.target.value = ""; 
         return;
      }

      updateArrangement(arrangementId, { files: pdfFiles, status: 'ready_to_process', statusMessage: `${pdfFiles.length} file(s) ready.` });
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  async function mergePdfs(files: File[]): Promise<Blob> {
    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      try {
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      } catch (e) {
        console.error(`Error loading or copying pages from ${file.name}:`, e);
        throw new Error(`Could not process ${file.name}. It might be corrupted or password-protected.`);
      }
    }
    const mergedPdfBytes = await mergedPdf.save();
    return new Blob([mergedPdfBytes], { type: 'application/pdf' });
  }


  const processArrangement = async (arrangement: Arrangement) => {
    if (!arrangement.files || arrangement.files.length === 0) {
      updateArrangement(arrangement.id, { status: 'error', statusMessage: 'No files uploaded for this arrangement.', error: 'No file(s).' });
      return;
    }

    let fileToProcess: File;
    let currentArrangementName = arrangement.name; // Keep track of name for directory creation

    try {
      if (arrangement.files.length > 1) {
        updateArrangement(arrangement.id, { status: 'merging_files', statusMessage: 'Merging PDF files...' });
        try {
            const mergedPdfBlob = await mergePdfs(arrangement.files);
            fileToProcess = new File([mergedPdfBlob], `merged_${arrangement.id}.pdf`, { type: 'application/pdf' });
            updateArrangement(arrangement.id, { statusMessage: 'PDFs merged. Reading file...' });
        } catch (mergeError: any) {
            console.error("Error merging PDFs:", mergeError);
            updateArrangement(arrangement.id, { status: 'error', statusMessage: `Error merging PDFs: ${mergeError.message}`, error: mergeError.message });
            return;
        }
      } else {
          fileToProcess = arrangement.files[0];
      }

      updateArrangement(arrangement.id, { status: 'reading_file', statusMessage: 'Reading file...' });
      const dataUri = await readFileAsDataURL(fileToProcess);
      updateArrangement(arrangement.id, { dataUri, status: 'extracting_metadata', statusMessage: 'Extracting metadata with AI...' });

      const metadata: ExtractedMusicSheetMetadata = await extractMusicSheetMetadata({ musicSheetDataUri: dataUri });
      if (!metadata.parts || metadata.parts.length === 0) {
        throw new Error("AI did not identify any parts in the music sheet.");
      }
       if (metadata.parts.some(p => !p.primaryInstrumentation)) {
        throw new Error("AI failed to provide primary instrumentation for one or more parts.");
      }
      
      // Update arrangement name with extracted title
      currentArrangementName = metadata.title;
      updateArrangement(arrangement.id, { 
        name: metadata.title, 
        extractedMetadata: metadata, 
        statusMessage: `Metadata extracted for "${metadata.title}". Determining directory...`
      });
      
      const initialProcessedParts: ProcessedPart[] = metadata.parts.map((partInfo, index) => ({
        ...partInfo, // Includes primaryInstrumentation
        id: `${arrangement.id}-part-${index}-${partInfo.label.replace(/\s+/g, '-')}`,
        parentId: arrangement.id,
        status: 'pending',
        statusMessage: 'Waiting for processing',
      }));
      updateArrangement(arrangement.id, { processedParts: initialProcessedParts, status: 'creating_directory' }); 
      
      const directoryResult = await createMusicSheetDirectory({
        rootFolderName: rootFolderId!,
        arrangement_type: metadata.arrangement_type,
      });

      if (!directoryResult.success || !directoryResult.directoryPath) {
        throw new Error("AI failed to determine directory structure.");
      }
      const targetDirectoryPath = directoryResult.directoryPath;
      updateArrangement(arrangement.id, { targetDirectoryPath, status: 'processing_parts', statusMessage: 'Processing individual parts...' });

      for (const part of initialProcessedParts) {
        try {
          updatePartStatus(arrangement.id, part.id, 'naming', 'Generating filename with AI...');
          
          const filenameResult = await generateMusicSheetFilename({ 
            arrangementName: currentArrangementName, // This is metadata.title
            partInstrumentation: part.primaryInstrumentation 
          });

          if (!filenameResult || !filenameResult.filename) {
            throw new Error("AI could not generate a filename for this part.");
          }
          const generatedFilename = filenameResult.filename;
          updatePartStatus(arrangement.id, part.id, 'organizing', 'Finalizing organization (Simulated)...', { generatedFilename });

          // Simulate final upload/move step for the part
          await new Promise(resolve => setTimeout(resolve, 300));
          updatePartStatus(arrangement.id, part.id, 'done', `Successfully organized as ${targetDirectoryPath}/${generatedFilename}`);
        } catch (partError: any) {
          console.error("Error processing part:", part.label, partError);
          const partErrorMessage = partError.message || "Unknown error processing part.";
          updatePartStatus(arrangement.id, part.id, 'error', `Error: ${partErrorMessage}`, { error: partErrorMessage });
        }
      }
      
      // Re-fetch arrangement from state to get the latest processedParts
      // It's better to use a functional update for setArrangements to ensure we're working with the latest state
      let finalStatus: ArrangementStatus = 'done';
      let finalMessage = `Arrangement "${currentArrangementName}" processed successfully!`;

      setArrangements(prevArrangements => {
        const updatedArrangements = prevArrangements.map(arr => {
          if (arr.id === arrangement.id) {
            const allPartsDoneOrError = arr.processedParts.every(p => p.status === 'done' || p.status === 'error');
            if (allPartsDoneOrError) {
              const hasErrors = arr.processedParts.some(p => p.status === 'error');
              finalStatus = hasErrors ? 'all_parts_processed' : 'done';
              finalMessage = hasErrors 
                ? `Arrangement "${currentArrangementName}" processed with some errors.` 
                : `Arrangement "${currentArrangementName}" processed successfully!`;
              
              if (!hasErrors) {
                  toast({ title: "Arrangement Organized", description: `"${currentArrangementName}" processed successfully.` });
              } else {
                  toast({ variant: "default", title: "Arrangement Processed", description: `"${currentArrangementName}" had issues with some parts. Check details.`, duration: 5000 });
              }
              return { ...arr, status: finalStatus, statusMessage: finalMessage };
            }
          }
          return arr;
        });
        return updatedArrangements;
      });

    } catch (error: any) {
      console.error("Error processing arrangement:", currentArrangementName, error);
      const errorMessage = error.message || "An unknown error occurred during arrangement processing.";
      updateArrangement(arrangement.id, { status: 'error', statusMessage: `Error processing "${currentArrangementName}": ${errorMessage}`, error: errorMessage });
      toast({ variant: "destructive", title: `Error processing ${currentArrangementName}`, description: errorMessage });
    }
  };

  const handleProcessAllReadyArrangements = async () => {
    if (!rootFolderId) {
      toast({ variant: "destructive", title: "Error", description: "Please select a root folder first." });
      return;
    }
    const readyArrangements = arrangements.filter(arr => arr.status === 'ready_to_process' && arr.files && arr.files.length > 0);
    if (readyArrangements.length === 0) {
      toast({ title: "Info", description: "No new arrangements ready to process." });
      return;
    }

    setIsProcessingGlobal(true);
    for (const arrangement of readyArrangements) {
      // Use a functional update or find from latest state if processArrangement modifies `arrangements` indirectly
      // For simplicity, assuming processArrangement internally fetches the latest state or works on a copy.
       const currentArrangementToProcess = arrangements.find(a => a.id === arrangement.id);
        if (currentArrangementToProcess) {
            await processArrangement(currentArrangementToProcess);
        }
    }
    setIsProcessingGlobal(false);
  };

  const clearArrangements = () => {
    setArrangements([]);
    arrangementIdCounter = 0; 
  };
  
  const allDoneOrError = arrangements.length > 0 && arrangements.every(a => a.status === 'done' || a.status === 'error' || a.status === 'all_parts_processed');
  const numReadyToProcess = arrangements.filter(arr => arr.status === 'ready_to_process' && arr.files && arr.files.length > 0).length;

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center bg-background">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-primary-foreground mb-2 flex items-center justify-center">
          <Music2 className="w-12 h-12 mr-3 text-accent" />
          DriveTune
        </h1>
        <p className="text-xl text-muted-foreground">Organize Your Music Sheets with AI Magic</p>
      </header>

      <div className="w-full max-w-3xl space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><LinkIcon className="mr-2 h-6 w-6 text-primary" />Step 1: Connect to Google Drive</CardTitle>
            <CardDescription>Securely connect your Google Drive account.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isDriveConnected ? (
              <Button onClick={handleConnectDrive} disabled={isConnecting} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                {isConnecting ? "Connecting..." : "Connect to Google Drive"}
              </Button>
            ) : (
              <div className="flex items-center text-green-600 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="mr-2 h-5 w-5" />
                <span>Successfully connected to Google Drive (Simulated).</span>
              </div>
            )}
          </CardContent>
        </Card>

        {isDriveConnected && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><FolderOpenDot className="mr-2 h-6 w-6 text-primary" />Step 2: Select Root Folder</CardTitle>
              <CardDescription>Choose or create a main folder name in your Drive.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="rootFolder">Root Folder Name (Simulated)</Label>
                <Input
                  id="rootFolder"
                  value={tempFolderId}
                  onChange={(e) => setTempFolderId(e.target.value)}
                  placeholder="e.g., My Music Sheets"
                  disabled={!!rootFolderId || isSelectingFolder}
                />
              </div>
            </CardContent>
            <CardFooter>
              {!rootFolderId ? (
                <Button onClick={handleSelectRootFolder} disabled={isSelectingFolder || !tempFolderId.trim()} className="w-full">
                  {isSelectingFolder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Set Root Folder
                </Button>
              ) : (
                 <div className="flex items-center text-green-600 p-3 bg-green-50 border border-green-200 rounded-md w-full">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    <span>Root folder: "{rootFolderId}"</span>
                  </div>
              )}
            </CardFooter>
          </Card>
        )}

        {rootFolderId && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary" />Step 3: Add & Organize Arrangements</CardTitle>
              <CardDescription>Add arrangements. Upload one or more PDF files per arrangement tray. They will be merged for AI processing. AI extracts metadata, names parts, and organizes them into the structure: {rootFolderId}/[Arrangement Type]/[Arrangement Name] - [Part Instrumentation].pdf</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={addNewArrangement} variant="outline" className="w-full mb-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Arrangement Tray
              </Button>
              
              {arrangements.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold mb-2 text-primary-foreground">Arrangements:</h3>
                  <ScrollArea className="h-[400px] w-full p-1 border rounded-md bg-muted/20">
                    <div className="space-y-4 p-2">
                    {arrangements.map(arrangement => (
                      <ArrangementListItem 
                        key={arrangement.id} 
                        arrangement={arrangement}
                        onFileChange={handleFileChangeForArrangement}
                        onProcess={processArrangement}
                        isProcessingGlobal={isProcessingGlobal}
                        updateArrangementName={(id, newName) => updateArrangement(id, { name: newName })}
                      />
                    ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleProcessAllReadyArrangements}
                disabled={isProcessingGlobal || numReadyToProcess === 0}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isProcessingGlobal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isProcessingGlobal ? "Processing Arrangements..." : `Organize ${numReadyToProcess} Ready Arrangement(s)`}
              </Button>
            </CardFooter>
          </Card>
        )}
         {allDoneOrError && !isProcessingGlobal && arrangements.length > 0 && (
            <Card className="shadow-lg mt-6 bg-green-50 border-green-200">
                <CardHeader>
                    <CardTitle className="flex items-center text-green-700"><CheckCircle className="mr-2 h-6 w-6" />All Submitted Arrangements Processed!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-green-600">You can add more arrangements or clear the list to start fresh.</p>
                     <Button onClick={clearArrangements} variant="outline" className="mt-4">Clear Arrangements List</Button>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
