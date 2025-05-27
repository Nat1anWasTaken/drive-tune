
"use client";

import { useState, useRef } from 'react';
import type { Arrangement, ProcessedPart, PartInformation, ArrangementStatus, PartStatus, ExtractedMusicSheetMetadata } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrangementListItem } from "@/components/ArrangementListItem"; // New component
import { extractMusicSheetMetadata } from "@/ai/flows/extract-music-sheet-metadata";
import { generateMusicSheetFilename } from "@/ai/flows/generate-music-sheet-filename";
import { createMusicSheetDirectory } from "@/ai/flows/create-music-sheet-directory";
import { UploadCloud, HardDrive, CheckCircle, FolderOpenDot, LogIn, Link as LinkIcon, Sparkles, Loader2, PlusCircle, Music2 } from "lucide-react";

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
      name: `Arrangement ${arrangementIdCounter}`,
      status: 'pending_upload',
      statusMessage: 'Please upload a PDF file for this arrangement.',
      processedParts: [],
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
      const file = event.target.files[0];
      if (file.type !== 'application/pdf') {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a PDF file." });
        if (event.target) event.target.value = ""; // Clear the input
        return;
      }
      updateArrangement(arrangementId, { file, status: 'ready_to_process', statusMessage: `File "${file.name}" ready.` });
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

  const processArrangement = async (arrangement: Arrangement) => {
    if (!arrangement.file) {
      updateArrangement(arrangement.id, { status: 'error', statusMessage: 'No file uploaded for this arrangement.', error: 'No file.' });
      return;
    }

    try {
      updateArrangement(arrangement.id, { status: 'reading_file', statusMessage: 'Reading file...' });
      const dataUri = await readFileAsDataURL(arrangement.file);
      updateArrangement(arrangement.id, { dataUri, status: 'extracting_metadata', statusMessage: 'Extracting metadata with AI...' });

      const metadata: ExtractedMusicSheetMetadata = await extractMusicSheetMetadata({ musicSheetDataUri: dataUri });
      if (!metadata.parts || metadata.parts.length === 0) {
        throw new Error("AI did not identify any parts in the music sheet.");
      }
      
      const initialProcessedParts: ProcessedPart[] = metadata.parts.map((partInfo, index) => ({
        ...partInfo,
        id: `${arrangement.id}-part-${index}-${partInfo.label.replace(/\s+/g, '-')}`,
        parentId: arrangement.id,
        status: 'pending',
        statusMessage: 'Waiting for processing',
      }));
      updateArrangement(arrangement.id, { extractedMetadata: metadata, processedParts: initialProcessedParts, status: 'creating_directory', statusMessage: 'Determining directory structure...' });
      
      const composerArrangers = metadata.composers.join(', ');
      const directoryResult = await createMusicSheetDirectory({
        rootFolderName: rootFolderId!,
        compositionType: metadata.arrangement_type,
        compositionName: metadata.title,
        composerArrangers: composerArrangers,
      });

      if (!directoryResult.success || !directoryResult.directoryPath) {
        throw new Error("AI failed to determine directory structure.");
      }
      const targetDirectoryPath = directoryResult.directoryPath;
      updateArrangement(arrangement.id, { targetDirectoryPath, status: 'processing_parts', statusMessage: 'Processing individual parts...' });

      for (const part of initialProcessedParts) {
        try {
          updatePartStatus(arrangement.id, part.id, 'naming', 'Generating filename with AI...');
          const filenameResult = await generateMusicSheetFilename({ partLabel: part.label });
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
      
      // Check if all parts are done or have errored
      const finalArrangementState = arrangements.find(a => a.id === arrangement.id);
      if (finalArrangementState && finalArrangementState.processedParts.every(p => p.status === 'done' || p.status === 'error')) {
        const hasErrors = finalArrangementState.processedParts.some(p => p.status === 'error');
        updateArrangement(arrangement.id, {
          status: hasErrors ? 'all_parts_processed' : 'done', // 'done' if no errors, 'all_parts_processed' if some parts had errors
          statusMessage: hasErrors ? 'Arrangement processed with some errors.' : 'Arrangement processed successfully!',
        });
        if (!hasErrors) {
            toast({ title: "Arrangement Organized", description: `${arrangement.name} processed successfully.` });
        } else {
            toast({ variant: "destructive", title: "Arrangement Processed with Errors", description: `${arrangement.name} had issues with some parts.` });
        }
      }


    } catch (error: any) {
      console.error("Error processing arrangement:", arrangement.name, error);
      const errorMessage = error.message || "An unknown error occurred during arrangement processing.";
      updateArrangement(arrangement.id, { status: 'error', statusMessage: `Error: ${errorMessage}`, error: errorMessage });
      toast({ variant: "destructive", title: `Error processing ${arrangement.name}`, description: errorMessage });
    }
  };

  const handleProcessAllReadyArrangements = async () => {
    if (!rootFolderId) {
      toast({ variant: "destructive", title: "Error", description: "Please select a root folder first." });
      return;
    }
    const readyArrangements = arrangements.filter(arr => arr.status === 'ready_to_process' && arr.file);
    if (readyArrangements.length === 0) {
      toast({ title: "Info", description: "No new arrangements ready to process." });
      return;
    }

    setIsProcessingGlobal(true);
    for (const arrangement of readyArrangements) {
      await processArrangement(arrangement);
    }
    setIsProcessingGlobal(false);
  };

  const clearArrangements = () => {
    setArrangements([]);
    arrangementIdCounter = 0; // Reset counter if desired
  };
  
  const allDoneOrError = arrangements.length > 0 && arrangements.every(a => a.status === 'done' || a.status === 'error' || a.status === 'all_parts_processed');
  const numReadyToProcess = arrangements.filter(arr => arr.status === 'ready_to_process' && arr.file).length;

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
        {/* Step 1: Connect to Drive */}
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

        {/* Step 2: Select Root Folder */}
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

        {/* Step 3: Add and Process Arrangements */}
        {rootFolderId && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary" />Step 3: Add & Organize Arrangements</CardTitle>
              <CardDescription>Add arrangements (PDF files). AI will extract metadata, identify parts, name them, and organize them into folders. For now, upload one PDF per arrangement.</CardDescription>
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
         {allDoneOrError && !isProcessingGlobal && (
            <Card className="shadow-lg mt-6 bg-green-50 border-green-200">
                <CardHeader>
                    <CardTitle className="flex items-center text-green-700"><CheckCircle className="mr-2 h-6 w-6" />All Submitted Arrangements Processed!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-green-600">You can add more arrangements or clear the list.</p>
                     <Button onClick={clearArrangements} variant="outline" className="mt-4">Clear Arrangements List</Button>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
