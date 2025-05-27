
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { TokenClient, TokenResponse } from 'google-accounts';
// gapi types are available via @types/gapi, google.accounts types via @types/google.accounts
import type { Arrangement, ProcessedPart, ExtractedMusicSheetMetadata, ArrangementStatus, PartStatus } from "@/types";
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
import { UploadCloud, CheckCircle, FolderOpenDot, LogIn, Link as LinkIcon, Sparkles, Loader2, PlusCircle, Music2, Merge, AlertTriangle } from "lucide-react";
import { PDFDocument } from 'pdf-lib';

// Ensure these are set in your .env.local file
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

let arrangementIdCounter = 0;

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


export default function DriveTuneApp() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<TokenClient | null>(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  const [isConnecting, setIsConnecting] = useState(false);
  const [rootFolderDisplayId, setRootFolderDisplayId] = useState<string | null>(null); 
  const [rootFolderDriveId, setRootFolderDriveId] = useState<string | null>(null); 
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [tempRootFolderName, setTempRootFolderName] = useState("My DriveTune Sheets");
  
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);

  const { toast } = useToast();
  
  const isDriveConnected = !!accessToken && gapiReady && gisReady;

  useEffect(() => {
    const scriptGapi = document.createElement('script');
    scriptGapi.src = 'https://apis.google.com/js/api.js';
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = () => {
        (window as any).gapi.load('client', () => {
          setGapiReady(true);
          if (GOOGLE_API_KEY) {
            (window as any).gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] })
              .catch((error: any) => {
                console.error("Error initializing GAPI client:", error);
                toast({ variant: "destructive", title: "GAPI Init Error", description: "Could not initialize Google API client." });
              });
          }
        });
    };
    document.body.appendChild(scriptGapi);

    const scriptGis = document.createElement('script');
    scriptGis.src = 'https://accounts.google.com/gsi/client';
    scriptGis.async = true;
    scriptGis.defer = true;
    scriptGis.onload = () => setGisReady(true);
    document.body.appendChild(scriptGis);

    return () => {
      document.body.removeChild(scriptGapi);
      document.body.removeChild(scriptGis);
    };
  }, [toast]);

  useEffect(() => {
    if (gisReady && GOOGLE_CLIENT_ID && (window as any).google?.accounts?.oauth2) {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPES,
        callback: (tokenResponse: TokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
             // gapi.client.setToken can be called if gapi client is initialized and used for other things
            if ((window as any).gapi && (window as any).gapi.client && (window as any).gapi.client.getToken() === null) {
                (window as any).gapi.client.setToken({ access_token: tokenResponse.access_token });
            }
            toast({ title: "Google Drive Connected", description: "Access token received." });
          } else {
            toast({ variant: "destructive", title: "Connection Failed", description: "Could not get access token."});
          }
          setIsConnecting(false);
        },
      });
      setTokenClient(client);
    }
     if (gisReady && !GOOGLE_CLIENT_ID){
       toast({ variant: "destructive", title: "Configuration Error", description: "Google Client ID is missing." });
    }
  }, [gisReady, toast]);


  const handleConnectDrive = () => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
        toast({ variant: "destructive", title: "Configuration Missing", description: "Client ID or API Key is not set for client." });
        return;
    }
    if (tokenClient) {
      setIsConnecting(true);
      tokenClient.requestAccessToken();
    } else {
      toast({ variant: "destructive", title: "Initialization Error", description: "Google Identity Service not ready." });
    }
  };
  
  const findOrCreateFolderAPI = useCallback(async (folderName: string, parentFolderId: string | 'root' = 'root'): Promise<string | null> => {
    if (!accessToken) {
      toast({ variant: "destructive", title: "Not Connected", description: "Connect to Google Drive first." });
      return null;
    }
    try {
      const response = await fetch('/api/drive-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'findOrCreateFolder',
          folderName,
          parentFolderId,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to find or create folder "${folderName}"`);
      }
      return result.driveId;
    } catch (error: any) {
      console.error('Error finding or creating folder via API:', error);
      toast({ variant: "destructive", title: "Drive Error (API)", description: `Could not find or create folder "${folderName}": ${error.message}` });
      return null;
    }
  }, [accessToken, toast]);


  const handleSelectRootFolder = async () => {
    if (!tempRootFolderName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a root folder name." });
      return;
    }
    if (!isDriveConnected) {
       toast({ variant: "destructive", title: "Not Connected", description: "Connect to Google Drive first."});
      return;
    }
    setIsSelectingFolder(true);
    const driveId = await findOrCreateFolderAPI(tempRootFolderName.trim());
    if (driveId) {
      setRootFolderDriveId(driveId);
      setRootFolderDisplayId(tempRootFolderName.trim());
      toast({ title: "Success", description: `Root folder set to: "${tempRootFolderName.trim()}".` });
    }
    setIsSelectingFolder(false);
  };

  const addNewArrangement = () => {
    arrangementIdCounter++;
    const newArrangement: Arrangement = {
      id: `arr-${Date.now()}-${arrangementIdCounter}`,
      name: `Arrangement ${arrangementIdCounter}`,
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
    setArrangements(prevArrangements => prevArrangements.map(arr => {
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

  async function mergePdfs(files: File[]): Promise<File> { 
    const mergedPdfDoc = await PDFDocument.create();
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      try {
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdfDoc.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdfDoc.addPage(page);
        });
      } catch (e) {
        console.error(`Error loading or copying pages from ${file.name}:`, e);
        throw new Error(`Could not process ${file.name}. It might be corrupted or password-protected.`);
      }
    }
    const mergedPdfBytes = await mergedPdfDoc.save();
    return new File([mergedPdfBytes], `merged_${Date.now()}.pdf`, { type: 'application/pdf' });
  }

  async function splitPdfPart(originalPdfDoc: PDFDocument, startPage: number, endPage: number): Promise<Uint8Array> {
    const newPdfDoc = await PDFDocument.create();
    const pageIndices = [];
    for (let i = startPage - 1; i < endPage; i++) {
        if (i < originalPdfDoc.getPageCount()) {
            pageIndices.push(i);
        }
    }
    if (pageIndices.length === 0) {
        throw new Error(`No valid pages found for range ${startPage}-${endPage}`);
    }
    const copiedPages = await newPdfDoc.copyPages(originalPdfDoc, pageIndices);
    copiedPages.forEach(page => newPdfDoc.addPage(page));
    return newPdfDoc.save();
  }

  async function uploadFileToDriveAPI(fileContentBytes: Uint8Array, fileName: string, parentFolderId: string): Promise<string | null> {
    if (!accessToken) {
      toast({ variant: "destructive", title: "Not Connected", description: "Authentication token is missing." });
      return null;
    }
    try {
      const fileContentBase64 = arrayBufferToBase64(fileContentBytes.buffer);
      const response = await fetch('/api/drive-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'uploadFile',
          fileName,
          fileContentBase64,
          parentFolderId,
          mimeType: 'application/pdf',
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to upload file "${fileName}"`);
      }
      return result.driveFileId;
    } catch (error: any) {
      console.error('Error uploading file to Drive via API:', error);
      toast({ variant: "destructive", title: "Drive Upload Error (API)", description: `Could not upload ${fileName}: ${error.message}` });
      return null;
    }
  }


  const processArrangement = async (arrangement: Arrangement) => {
    if (!rootFolderDriveId) {
       updateArrangement(arrangement.id, { status: 'error', statusMessage: 'Root Drive folder not set.', error: 'Root folder missing.' });
       return;
    }
    if (!arrangement.files || arrangement.files.length === 0) {
      updateArrangement(arrangement.id, { status: 'error', statusMessage: 'No files uploaded for this arrangement.', error: 'No file(s).' });
      return;
    }

    let fileToProcess: File;
    let currentArrangementName = arrangement.name; 

    try {
      if (arrangement.files.length > 1) {
        updateArrangement(arrangement.id, { status: 'merging_files', statusMessage: 'Merging PDF files...' });
        try {
            fileToProcess = await mergePdfs(arrangement.files);
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
      const mainPdfBytes = await fileToProcess.arrayBuffer();
      const mainPdfDoc = await PDFDocument.load(mainPdfBytes);


      updateArrangement(arrangement.id, { dataUri, status: 'extracting_metadata', statusMessage: 'Extracting metadata with AI...' });
      const metadata: ExtractedMusicSheetMetadata = await extractMusicSheetMetadata({ musicSheetDataUri: dataUri });
      
      if (!metadata.parts || metadata.parts.length === 0) {
        throw new Error("AI did not identify any parts in the music sheet.");
      }
      if (metadata.parts.some(p => !p.primaryInstrumentation)) {
        throw new Error("AI failed to provide primary instrumentation for one or more parts.");
      }
      
      currentArrangementName = metadata.title;
      updateArrangement(arrangement.id, { 
        name: metadata.title, 
        extractedMetadata: metadata, 
        status: 'creating_drive_folder_structure',
        statusMessage: `Metadata extracted. Creating folders in Drive for "${metadata.title}"...`
      });
      
      const conceptualDirResult = await createMusicSheetDirectory({
        rootFolderName: rootFolderDisplayId!, 
        arrangement_type: metadata.arrangement_type,
      });

      if (!conceptualDirResult.success || !conceptualDirResult.directoryPath) {
        throw new Error("AI failed to determine conceptual directory structure.");
      }
      
      const arrangementTypeFolderDriveId = await findOrCreateFolderAPI(metadata.arrangement_type, rootFolderDriveId);
      if (!arrangementTypeFolderDriveId) {
         throw new Error(`Failed to create or find folder for arrangement type: ${metadata.arrangement_type}`);
      }
      updateArrangement(arrangement.id, { targetDirectoryDriveId: arrangementTypeFolderDriveId, status: 'processing_parts', statusMessage: 'Processing individual parts...' });
      
      const initialProcessedParts: ProcessedPart[] = metadata.parts.map((partInfo, index) => ({
        ...partInfo,
        id: `${arrangement.id}-part-${index}-${partInfo.label.replace(/\s+/g, '-')}`,
        parentId: arrangement.id,
        status: 'pending',
        statusMessage: 'Waiting for processing',
      }));
      updateArrangement(arrangement.id, { processedParts: initialProcessedParts }); 

      for (const part of initialProcessedParts) {
        try {
          updatePartStatus(arrangement.id, part.id, 'splitting', `Preparing part: ${part.label}...`);
          const partPdfBytes = await splitPdfPart(mainPdfDoc, part.start_page, part.end_page);
          
          updatePartStatus(arrangement.id, part.id, 'naming', 'Generating filename with AI...');
          const filenameResult = await generateMusicSheetFilename({ 
            arrangementName: currentArrangementName, 
            partInstrumentation: part.primaryInstrumentation 
          });

          if (!filenameResult || !filenameResult.filename) {
            throw new Error("AI could not generate a filename for this part.");
          }
          const generatedFilename = filenameResult.filename;
          updatePartStatus(arrangement.id, part.id, 'uploading_to_drive', `Uploading "${generatedFilename}" to Drive...`, { generatedFilename });

          const driveFileId = await uploadFileToDriveAPI(partPdfBytes, generatedFilename, arrangementTypeFolderDriveId);
          if (!driveFileId) {
            throw new Error(`Failed to upload "${generatedFilename}" to Drive.`);
          }
          updatePartStatus(arrangement.id, part.id, 'done', `Organized in Drive as ${metadata.arrangement_type}/${generatedFilename}`, { driveFileId });
        } catch (partError: any) {
          console.error("Error processing part:", part.label, partError);
          const partErrorMessage = partError.message || "Unknown error processing part.";
          updatePartStatus(arrangement.id, part.id, 'error', `Error: ${partErrorMessage}`, { error: partErrorMessage });
        }
      }
      
      let finalStatus: ArrangementStatus = 'done';
      let finalMessage = `Arrangement "${currentArrangementName}" processed successfully!`;

      setArrangements(prevArrangements => {
        const currentArr = prevArrangements.find(a => a.id === arrangement.id);
        if (currentArr) {
            const allPartsDoneOrError = currentArr.processedParts.every(p => p.status === 'done' || p.status === 'error');
            if (allPartsDoneOrError) {
              const hasErrors = currentArr.processedParts.some(p => p.status === 'error');
              finalStatus = hasErrors ? 'all_parts_processed' : 'done';
              finalMessage = hasErrors 
                ? `Arrangement "${currentArrangementName}" processed. Some parts had errors.` 
                : `Arrangement "${currentArrangementName}" processed and uploaded to Drive!`;
              
              if (!hasErrors) {
                  toast({ title: "Arrangement Organized", description: `"${currentArrangementName}" uploaded to Drive.` });
              } else {
                  toast({ variant: "default", title: "Arrangement Processed", description: `"${currentArrangementName}" processed. Check part statuses.`, duration: 5000 });
              }
                return prevArrangements.map(a => 
                    a.id === arrangement.id ? { ...a, status: finalStatus, statusMessage: finalMessage } : a
                );
            }
        }
        return prevArrangements; 
      });

    } catch (error: any) {
      console.error("Error processing arrangement:", currentArrangementName, error);
      const errorMessage = error.message || "An unknown error occurred during arrangement processing.";
      updateArrangement(arrangement.id, { status: 'error', statusMessage: `Error processing "${currentArrangementName}": ${errorMessage}`, error: errorMessage });
      toast({ variant: "destructive", title: `Error processing ${currentArrangementName}`, description: errorMessage });
    }
  };

  const handleProcessAllReadyArrangements = async () => {
    if (!rootFolderDriveId) {
      toast({ variant: "destructive", title: "Error", description: "Please select and confirm a root folder in Google Drive first." });
      return;
    }
    const readyArrangements = arrangements.filter(arr => arr.status === 'ready_to_process' && arr.files && arr.files.length > 0);
    if (readyArrangements.length === 0) {
      toast({ title: "Info", description: "No new arrangements ready to process." });
      return;
    }

    setIsProcessingGlobal(true);
    for (const arrangement of readyArrangements) {
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
        <p className="text-xl text-muted-foreground">Organize Your Music Sheets in Google Drive</p>
      </header>

      <div className="w-full max-w-3xl space-y-6">
        {!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID ? (
            <Card className="border-destructive bg-destructive/10">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2 h-6 w-6"/>Configuration Incomplete</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive-foreground">
                        Client-side Google API Key or Client ID is not configured. Please set <code className="bg-destructive/20 px-1 rounded">NEXT_PUBLIC_GOOGLE_API_KEY</code> and <code className="bg-destructive/20 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your environment variables.
                        Follow the instructions in the <code className="bg-destructive/20 px-1 rounded">.env</code> file.
                    </p>
                </CardContent>
            </Card>
        ): null}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><LinkIcon className="mr-2 h-6 w-6 text-primary" />Step 1: Connect to Google Drive</CardTitle>
            <CardDescription>Sign in with Google and authorize access to your Drive.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isDriveConnected ? (
              <Button onClick={handleConnectDrive} disabled={isConnecting || !gapiReady || !gisReady || !tokenClient || !GOOGLE_CLIENT_ID || !GOOGLE_API_KEY} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                {isConnecting ? "Connecting..." : "Connect to Google Drive"}
              </Button>
            ) : (
              <div className="flex items-center text-green-600 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="mr-2 h-5 w-5" />
                <span>Successfully connected to Google Drive.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {isDriveConnected && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><FolderOpenDot className="mr-2 h-6 w-6 text-primary" />Step 2: Select/Create Root Folder</CardTitle>
              <CardDescription>Choose a name for the main folder in your Drive where sheets will be organized.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="rootFolder">Root Folder Name</Label>
                <Input
                  id="rootFolder"
                  value={tempRootFolderName}
                  onChange={(e) => setTempRootFolderName(e.target.value)}
                  placeholder="e.g., My DriveTune Sheets"
                  disabled={!!rootFolderDriveId || isSelectingFolder}
                />
              </div>
            </CardContent>
            <CardFooter>
              {!rootFolderDriveId ? (
                <Button onClick={handleSelectRootFolder} disabled={isSelectingFolder || !tempRootFolderName.trim() || !isDriveConnected} className="w-full">
                  {isSelectingFolder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Set Root Folder in Drive
                </Button>
              ) : (
                 <div className="flex items-center text-green-600 p-3 bg-green-50 border border-green-200 rounded-md w-full">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    <span>Root folder in Drive: "{rootFolderDisplayId}"</span>
                  </div>
              )}
            </CardFooter>
          </Card>
        )}

        {rootFolderDriveId && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><UploadCloud className="mr-2 h-6 w-6 text-primary" />Step 3: Add & Organize Arrangements</CardTitle>
              <CardDescription>Upload PDF(s) per arrangement. They'll be merged, metadata extracted by AI, parts split, named, and organized into: {rootFolderDisplayId}/[Arrangement Type]/[Arrangement Name] - [Part Name].pdf</CardDescription>
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
                        rootFolderName={rootFolderDisplayId || "Root"}
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
                disabled={isProcessingGlobal || numReadyToProcess === 0 || !isDriveConnected}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isProcessingGlobal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isProcessingGlobal ? "Processing Arrangements..." : `Organize ${numReadyToProcess} Ready Arrangement(s) in Drive`}
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

