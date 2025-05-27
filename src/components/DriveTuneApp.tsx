"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ProcessedFile, FileStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FileListItem } from "@/components/FileListItem";
import { extractMusicSheetMetadata, type ExtractMusicSheetMetadataOutput } from "@/ai/flows/extract-music-sheet-metadata";
import { generateMusicSheetFilename } from "@/ai/flows/generate-music-sheet-filename";
import { createMusicSheetDirectory } from "@/ai/flows/create-music-sheet-directory";
import { UploadCloud, HardDrive, CheckCircle, AlertTriangle, FolderOpenDot, LogIn, Link as LinkIcon, Sparkles } from "lucide-react";

const MOCK_DRIVE_CONNECTED_DELAY = 1000;
const MOCK_FOLDER_SELECTED_DELAY = 500;

export default function DriveTuneApp() {
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [tempFolderId, setTempFolderId] = useState("My Music Sheets Root"); // Default mock folder ID
  const [filesToProcess, setFilesToProcess] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
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
      toast({ variant: "destructive", title: "Error", description: "Please enter a root folder name/ID." });
      return;
    }
    setIsSelectingFolder(true);
    setTimeout(() => {
      setRootFolderId(tempFolderId.trim());
      setIsSelectingFolder(false);
      toast({ title: "Success", description: `Root folder set to: "${tempFolderId.trim()}" (Simulated).` });
    }, MOCK_FOLDER_SELECTED_DELAY);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map(file => ({
        file,
        id: `${file.name}-${Date.now()}`,
        status: 'pending' as FileStatus,
        statusMessage: "Ready to process",
      }));
      setFilesToProcess(prevFiles => [...prevFiles, ...newFiles]);
    }
  };
  
  const updateFileStatus = (id: string, status: FileStatus, message: string, details?: Partial<ProcessedFile>) => {
    setFilesToProcess(prevFiles =>
      prevFiles.map(f => (f.id === id ? { ...f, status, statusMessage: message, ...details } : f))
    );
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const processSingleFile = async (item: ProcessedFile) => {
    try {
      updateFileStatus(item.id, 'reading', "Reading file...");
      const dataUri = await readFileAsDataURL(item.file);
      updateFileStatus(item.id, 'extracting', "Extracting metadata with AI...", { dataUri });

      const metadata = await extractMusicSheetMetadata({ musicSheetDataUri: dataUri });
      if (!metadata || !metadata.compositionName) {
        throw new Error("AI could not extract metadata or composition name is missing.");
      }
      updateFileStatus(item.id, 'naming', "Generating filename with AI...", { metadata });
      
      const filenameResult = await generateMusicSheetFilename(metadata);
      if (!filenameResult || !filenameResult.filename) {
        throw new Error("AI could not generate a filename.");
      }
      const generatedFilename = filenameResult.filename;
      updateFileStatus(item.id, 'creating_dir', "Creating directory structure with AI...", { generatedFilename });

      const composerArrangers = metadata.arranger ? `${metadata.composer} (Arr. ${metadata.arranger})` : metadata.composer;
      const directoryResult = await createMusicSheetDirectory({
        rootFolderId: rootFolderId!, // Asserting rootFolderId is not null as this step is guarded
        compositionType: metadata.compositionType,
        compositionName: metadata.compositionName,
        composerArrangers: composerArrangers,
      });

      if (!directoryResult.success) {
        throw new Error("AI failed to create directory structure.");
      }
      const targetDirectoryPath = directoryResult.directoryPath;
      updateFileStatus(item.id, 'organizing', "Finalizing organization (Simulated)...", { targetDirectoryPath });

      // Simulate final upload/move step
      await new Promise(resolve => setTimeout(resolve, 500));

      updateFileStatus(item.id, 'done', "Successfully organized!");
      toast({ title: "File Organized", description: `${item.file.name} processed successfully.` });

    } catch (error: any) {
      console.error("Error processing file:", item.file.name, error);
      const errorMessage = error.message || "An unknown error occurred during processing.";
      updateFileStatus(item.id, 'error', `Error: ${errorMessage}`, { error: errorMessage });
      toast({ variant: "destructive", title: `Error processing ${item.file.name}`, description: errorMessage });
    }
  };

  const handleProcessFiles = async () => {
    if (!rootFolderId) {
      toast({ variant: "destructive", title: "Error", description: "Please select a root folder first." });
      return;
    }
    if (filesToProcess.filter(f => f.status === 'pending').length === 0) {
        toast({ title: "Info", description: "No new files to process."});
        return;
    }

    setIsProcessing(true);
    for (const file of filesToProcess) {
      if (file.status === 'pending') { // Only process pending files
        await processSingleFile(file);
      }
    }
    setIsProcessing(false);
  };
  
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center bg-background">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-primary-foreground mb-2 flex items-center justify-center">
          <HardDrive className="w-12 h-12 mr-3 text-accent" />
          DriveTune
        </h1>
        <p className="text-xl text-muted-foreground">Organize Your Music Sheets with AI Magic</p>
      </header>

      <div className="w-full max-w-2xl space-y-6">
        {/* Step 1: Connect to Drive */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><LinkIcon className="mr-2 h-6 w-6 text-primary" />Step 1: Connect to Google Drive</CardTitle>
            <CardDescription>Securely connect your Google Drive account to start organizing.</CardDescription>
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
              <CardDescription>Choose or create a main folder in your Drive for DriveTune.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="rootFolder">Root Folder Name/ID (Simulated)</Label>
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

        {/* Step 3: Upload and Process Files */}
        {rootFolderId && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary" />Step 3: Upload & Organize Music Sheets</CardTitle>
              <CardDescription>Upload your music sheet files (PDF, image, etc.). AI will extract metadata, name them, and organize them into folders.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="mb-4 flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                onClick={openFileDialog}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                     const newFiles = Array.from(e.dataTransfer.files).map(file => ({
                        file,
                        id: `${file.name}-${Date.now()}`,
                        status: 'pending' as FileStatus,
                        statusMessage: "Ready to process",
                      }));
                      setFilesToProcess(prevFiles => [...prevFiles, ...newFiles]);
                  }
                }}
              >
                <UploadCloud className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Drag & drop files here, or click to select</p>
                <Input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.musicxml,.mxl" 
                />
              </div>

              {filesToProcess.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold mb-2 text-primary-foreground">Files to Process:</h3>
                  <ScrollArea className="h-[300px] w-full p-1 border rounded-md">
                    {filesToProcess.map(item => (
                      <FileListItem key={item.id} item={item} />
                    ))}
                  </ScrollArea>
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleProcessFiles}
                disabled={isProcessing || filesToProcess.filter(f => f.status === 'pending').length === 0}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isProcessing ? "Processing Files..." : `Organize ${filesToProcess.filter(f => f.status === 'pending').length} Files`}
              </Button>
            </CardFooter>
          </Card>
        )}
         {filesToProcess.length > 0 && filesToProcess.every(f => f.status === 'done' || f.status === 'error') && !isProcessing && (
            <Card className="shadow-lg mt-6 bg-green-50 border-green-200">
                <CardHeader>
                    <CardTitle className="flex items-center text-green-700"><CheckCircle className="mr-2 h-6 w-6" />All Files Processed!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-green-600">You can upload more files or refresh the page to start over.</p>
                     <Button onClick={() => setFilesToProcess([])} variant="outline" className="mt-4">Clear Processed Files List</Button>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
