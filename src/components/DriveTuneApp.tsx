"use client";
// gapi types are available via @types/gapi, google.accounts types via @types/google.accounts

import { extractMusicSheetMetadata } from "@/ai/flows/extract-music-sheet-metadata"; // AI Flow
import { useArrangementManager } from "@/hooks/use-arrangement-manager"; // Custom Hook
import { useGoogleDriveAuth } from "@/hooks/use-google-drive-auth"; // Custom Hook
import { useGoogleDriveFolderManager } from "@/hooks/use-google-drive-folder-manager"; // Custom Hook
import { useToast } from "@/hooks/use-toast"; // Adjusted path
import { Arrangement } from "@/types"; // Import Arrangement from central types
// Import UI Components as needed, e.g.:
// import { Button } from "./ui/button";
// import { Input } from "./ui/input";
// import { Progress } from "./ui/progress";
import { ArrangementListItem } from "./ArrangementListItem"; // Assuming you have this component

// Ensure this is set in your .env.local file
// const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; // Managed by useGoogleDriveAuth
// const GOOGLE_PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY; // Managed by useGoogleDriveFolderManager
// const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly"; // Managed by useGoogleDriveAuth

// Helper to convert ArrayBuffer to Base64 - This could be moved to a utils file if used elsewhere
// function arrayBufferToBase64(buffer: ArrayBufferLike): string { ... } // Managed by useArrangementManager or utils

// Minimal type for Google Picker document - This could be in useGoogleDriveFolderManager or a types file
// interface PickerDocument { ... } // Managed by useGoogleDriveFolderManager

// Types for Arrangement, ProcessedPart, PartStatus are now imported from useArrangementManager
// interface Arrangement { ... }
// interface ProcessedPart { ... }
// type PartStatus = ...;

export default function DriveTuneApp() {
  const { toast } = useToast(); // Keep toast here or pass it to hooks if they don't have their own instance

  // --- Authentication Hook ---
  const auth = useGoogleDriveAuth();
  const {
    accessToken,
    isDriveConnected,
    isConnecting,
    handleConnectDrive,
    // gapiReady, gisReady, pickerApiLoaded, // these are usually internal to the auth/folder hooks
  } = auth;

  // --- Folder Management Hook ---
  const folderManager = useGoogleDriveFolderManager(auth); // Pass auth state
  const {
    rootFolderDisplayId,
    rootFolderDriveId,
    isSettingRootFolder,
    tempRootFolderName,
    setTempRootFolderName,
    findOrCreateFolderAPI, // This is also used by arrangement manager
    handleSetRootFolderByName,
    handleSelectExistingFolder,
  } = folderManager;

  // --- Arrangement Management Hook ---
  const arrangementManager = useArrangementManager(auth); // Pass auth state
  const {
    arrangements,
    isProcessingGlobal,
    addNewArrangement,
    // updateArrangement, // Used internally or if specific UI needs it
    // updatePartStatus, // Used internally
    handleFileChangeForArrangement,
    processArrangement, // The main processing function
    handleProcessAllReadyArrangements,
    clearArrangements,
    // uploadFileToDriveAPI, // Usually internal to the hook
    updateArrangementName, // Added this function from the hook
  } = arrangementManager;

  // useEffect for loading Google APIs is now inside useGoogleDriveAuth
  // useEffect for initializing token client is now inside useGoogleDriveAuth

  // handleConnectDrive is from useGoogleDriveAuth

  // findOrCreateFolderAPI is from useGoogleDriveFolderManager
  // handleSetRootFolderByName is from useGoogleDriveFolderManager
  // handleSelectExistingFolder is from useGoogleDriveFolderManager

  // addNewArrangement, updateArrangement, updatePartStatus are from useArrangementManager
  // handleFileChangeForArrangement is from useArrangementManager

  // PDF processing functions (readFileAsDataURL, mergePdfs, splitPdfPart) are now inside useArrangementManager
  // uploadFileToDriveAPI is now inside useArrangementManager or called by it

  // processArrangement logic is now primarily within useArrangementManager's processArrangement
  // It will need rootFolderDriveId and findOrCreateFolderAPI from folderManager,
  // and extractMusicSheetMetadata (AI function) passed to it.

  const handleProcessArrangementWrapper = async (arrangement: Arrangement) => {
    // Wrapper to pass necessary dependencies from other hooks/context
    await processArrangement(
      arrangement,
      rootFolderDriveId,
      findOrCreateFolderAPI, // from folderManager
      extractMusicSheetMetadata // from AI import
    );
  };

  const handleProcessAllReadyArrangementsWrapper = async () => {
    // Wrapper to pass necessary dependencies
    await handleProcessAllReadyArrangements(
      rootFolderDriveId,
      findOrCreateFolderAPI, // from folderManager
      extractMusicSheetMetadata // from AI import
    );
  };

  // clearArrangements is from useArrangementManager

  // Derived state for UI rendering
  const allDoneOrError =
    arrangements.length > 0 &&
    arrangements.every(
      (a) =>
        a.status === "done" ||
        a.status === "error" ||
        a.status === "all_parts_processed"
    );
  const numReadyToProcess = arrangements.filter(
    (arr) =>
      arr.status === "ready_to_process" && arr.files && arr.files.length > 0
  ).length;

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center bg-background">
      {/* Header Section */}
      <header className="w-full max-w-4xl mb-8">
        <h1 className="text-4xl font-bold text-center text-primary">
          DriveTune
        </h1>
        <p className="text-center text-muted-foreground">
          Tune up your Google Drive with organized music sheets.
        </p>
      </header>

      {/* Connection Status and Controls */}
      <section className="w-full max-w-2xl mb-6 p-6 bg-card shadow-lg rounded-lg">
        <h2 className="text-2xl font-semibold mb-4 text-card-foreground">
          Google Drive Connection
        </h2>
        {!isDriveConnected ? (
          <button
            onClick={handleConnectDrive}
            disabled={isConnecting}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
          >
            {isConnecting ? "Connecting..." : "Connect to Google Drive"}
          </button>
        ) : (
          <div className="text-green-600 font-semibold">
            <p>Connected to Google Drive.</p>
            {accessToken && (
              <p className="text-xs text-muted-foreground truncate">
                Token: {accessToken.substring(0, 30)}...
              </p>
            )}
          </div>
        )}
      </section>

      {/* Root Folder Configuration */}
      {isDriveConnected && (
        <section className="w-full max-w-2xl mb-6 p-6 bg-card shadow-lg rounded-lg">
          <h2 className="text-2xl font-semibold mb-4 text-card-foreground">
            Root Folder Setup
          </h2>
          {rootFolderDriveId && rootFolderDisplayId ? (
            <div className="mb-4 p-3 bg-secondary rounded">
              <p className="text-secondary-foreground">
                Current Root Folder: <strong>{rootFolderDisplayId}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Drive ID: {rootFolderDriveId}
              </p>
            </div>
          ) : (
            <p className="mb-4 text-muted-foreground">
              No root folder selected. Processed arrangements will be saved
              here.
            </p>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="rootFolderName"
                className="block text-sm font-medium text-card-foreground mb-1"
              >
                Create or Use Folder by Name:
              </label>
              <div className="flex space-x-2">
                <input
                  id="rootFolderName"
                  type="text"
                  value={tempRootFolderName}
                  onChange={(e) => setTempRootFolderName(e.target.value)}
                  placeholder="e.g., My Processed Music Sheets"
                  className="flex-grow p-2 border rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  disabled={isSettingRootFolder}
                />
                <button
                  onClick={handleSetRootFolderByName}
                  disabled={isSettingRootFolder || !tempRootFolderName.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
                >
                  {isSettingRootFolder ? "Setting..." : "Set/Create"}
                </button>
              </div>
            </div>
            <div>
              <button
                onClick={handleSelectExistingFolder}
                disabled={isSettingRootFolder}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded transition duration-150 ease-in-out disabled:opacity-50"
              >
                {isSettingRootFolder
                  ? "Loading Picker..."
                  : "Select Existing Folder from Drive"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Arrangements Section */}
      {isDriveConnected && rootFolderDriveId && (
        <section className="w-full max-w-4xl mb-6 p-6 bg-card shadow-lg rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-card-foreground">
              Music Arrangements
            </h2>
            <button
              onClick={addNewArrangement}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
            >
              + Add Arrangement
            </button>
          </div>

          {arrangements.length === 0 && (
            <p className="text-center text-muted-foreground">
              No arrangements added yet. Click "+ Add Arrangement" to start.
            </p>
          )}

          <div className="space-y-4">
            {/* Replace with your ArrangementListItem component */}
            {arrangements.map((arrangement) => (
              <ArrangementListItem
                key={arrangement.id}
                arrangement={arrangement}
                onFileChange={handleFileChangeForArrangement}
                onProcess={handleProcessArrangementWrapper}
                isProcessingGlobal={isProcessingGlobal}
                updateArrangementName={updateArrangementName} // Pass the function here
                rootFolderName={rootFolderDisplayId || "DriveTune Files"} // Pass root folder name
              />
            ))}
          </div>

          {/* Global Actions */}
          {arrangements.length > 0 && (
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={handleProcessAllReadyArrangementsWrapper}
                disabled={isProcessingGlobal || numReadyToProcess === 0}
                className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded transition duration-150 ease-in-out disabled:opacity-50"
              >
                {isProcessingGlobal
                  ? "Processing All..."
                  : `Process All Ready (${numReadyToProcess})`}
              </button>
              <button
                onClick={clearArrangements}
                disabled={isProcessingGlobal}
                className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded transition duration-150 ease-in-out disabled:opacity-50"
              >
                Clear All Arrangements
              </button>
            </div>
          )}
          {isProcessingGlobal && (
            <div className="mt-4 w-full bg-blue-100 p-3 rounded-md text-center">
              <p className="text-blue-700 font-semibold">
                Global processing in progress, please wait...
              </p>
              {/* You could add a spinner or a more detailed progress bar here if tracking overall progress */}
            </div>
          )}
          {allDoneOrError && arrangements.length > 0 && !isProcessingGlobal && (
            <p className="mt-6 text-center text-green-600 font-semibold">
              All arrangements have been processed or encountered an error.
            </p>
          )}
        </section>
      )}

      {/* Footer or additional info */}
      <footer className="w-full max-w-4xl mt-auto pt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} DriveTune. All rights reserved.</p>
        <p>
          Ensure you have the necessary rights to upload and process any
          copyrighted material.
        </p>
      </footer>
    </div>
  );
}
