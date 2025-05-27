"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "./use-toast"; // Assuming useToast is in the same directory or adjust path
import { GoogleDriveAuth } from "./useGoogleDriveAuth"; // Import the auth hook

// Ensure this is set in your .env.local file
const GOOGLE_PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;

// Minimal type for Google Picker document
interface PickerDocument {
  id: string;
  name: string;
  // Add other fields if needed, e.g., mimeType
}

export interface GoogleDriveFolderManager {
  rootFolderDisplayId: string | null;
  rootFolderDriveId: string | null;
  isSettingRootFolder: boolean;
  tempRootFolderName: string;
  setTempRootFolderName: (name: string) => void;
  findOrCreateFolderAPI: (
    folderName: string,
    parentFolderId?: string | "root"
  ) => Promise<string | null>;
  handleSetRootFolderByName: () => Promise<void>;
  handleSelectExistingFolder: () => void;
  listSubFolders: (
    parentFolderId?: string
  ) => Promise<{ id: string; name: string }[]>; // Added
}

export function useGoogleDriveFolderManager(
  auth: GoogleDriveAuth // Pass the auth state from useGoogleDriveAuth
): GoogleDriveFolderManager {
  const [rootFolderDisplayId, setRootFolderDisplayId] = useState<string | null>(
    () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("driveTuneRootFolderDisplayName");
      }
      return null;
    }
  );
  const [rootFolderDriveId, setRootFolderDriveId] = useState<string | null>(
    () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("driveTuneRootFolderId");
      }
      return null;
    }
  );
  const [isSettingRootFolder, setIsSettingRootFolder] = useState(false);
  const [tempRootFolderName, setTempRootFolderName] = useState(
    "My DriveTune Sheets"
  );

  const { toast } = useToast();
  const { accessToken, isDriveConnected, pickerApiLoaded } = auth;

  useEffect(() => {
    if (rootFolderDriveId) {
      localStorage.setItem("driveTuneRootFolderId", rootFolderDriveId);
    } else {
      localStorage.removeItem("driveTuneRootFolderId");
    }
    if (rootFolderDisplayId) {
      localStorage.setItem(
        "driveTuneRootFolderDisplayName",
        rootFolderDisplayId
      );
    } else {
      localStorage.removeItem("driveTuneRootFolderDisplayName");
    }
  }, [rootFolderDriveId, rootFolderDisplayId]);

  const findOrCreateFolderAPI = useCallback(
    async (
      folderName: string,
      parentFolderId: string | "root" = "root"
    ): Promise<string | null> => {
      if (!accessToken) {
        toast({
          variant: "destructive",
          title: "Not Connected",
          description: "Connect to Google Drive first.",
        });
        return null;
      }
      setIsSettingRootFolder(true);
      try {
        const response = await fetch("/api/drive-handler", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            action: "findOrCreateFolder",
            folderName,
            parentFolderId,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(
            result.error || `Failed to find or create folder "${folderName}"`
          );
        }
        // Only update the global root folder state if we are actually creating/finding the root.
        if (parentFolderId === "root") {
          setRootFolderDriveId(result.driveId);
          setRootFolderDisplayId(folderName);
          toast({
            title: "Success",
            description: `Root folder set to: "${folderName}". Drive ID: ${result.driveId}`,
          });
        }
        return result.driveId;
      } catch (error: any) {
        console.error("Error finding or creating folder via API:", error);
        toast({
          variant: "destructive",
          title: "Drive Error (API)",
          description: `Could not find or create folder "${folderName}": ${error.message}`,
        });
        return null;
      } finally {
        setIsSettingRootFolder(false);
      }
    },
    [accessToken, toast]
  );

  const listSubFolders = useCallback(
    async (
      parentFolderId?: string
    ): Promise<{ id: string; name: string }[]> => {
      const effectiveParentFolderId =
        parentFolderId || rootFolderDriveId || "root";
      if (!accessToken) {
        toast({
          variant: "destructive",
          title: "Not Connected",
          description: "Connect to Google Drive first.",
        });
        return [];
      }
      try {
        const response = await fetch("/api/drive-handler", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            action: "listSubFolders",
            parentFolderId: effectiveParentFolderId,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              `Failed to list subfolders: ${response.statusText}`
          );
        }
        const data = await response.json();
        return data.subFolders || []; // Changed from data.folders to data.subFolders
      } catch (error: any) {
        console.error("Error listing subfolders:", error);
        toast({
          variant: "destructive",
          title: "Error Listing Subfolders",
          description: error.message || "Could not retrieve subfolder list.",
        });
        return [];
      }
    },
    [accessToken, rootFolderDriveId, toast]
  );

  const handleSetRootFolderByName = async () => {
    if (!tempRootFolderName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a root folder name.",
      });
      return;
    }
    if (!isDriveConnected) {
      toast({
        variant: "destructive",
        title: "Not Connected",
        description: "Connect to Google Drive first.",
      });
      return;
    }
    await findOrCreateFolderAPI(tempRootFolderName.trim());
  };

  const handleSelectExistingFolder = () => {
    if (
      !isDriveConnected ||
      !pickerApiLoaded ||
      !GOOGLE_PICKER_API_KEY ||
      !accessToken
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Drive not connected, Picker API not ready, API Key missing, or no access token.",
      });
      return;
    }
    setIsSettingRootFolder(true);
    try {
      const view = new window.google.picker.DocsView().setSelectFolderEnabled(
        true
      );
      view.setMimeTypes("application/vnd.google-apps.folder");

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_PICKER_API_KEY)
        .setCallback((data: any) => {
          // google.picker.ResponseObject
          setIsSettingRootFolder(false);
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data[
              window.google.picker.Response.DOCUMENTS
            ][0] as PickerDocument;
            setRootFolderDriveId(doc.id);
            setRootFolderDisplayId(doc.name);
            toast({
              title: "Folder Selected",
              description: `Root folder set to: "${doc.name}". Drive ID: ${doc.id}`,
            });
          } else if (data.action === window.google.picker.Action.CANCEL) {
            toast({
              title: "Picker Cancelled",
              description: "Folder selection was cancelled.",
            });
          }
        })
        .build();
      picker.setVisible(true);
    } catch (error: any) {
      console.error("Error opening Google Picker:", error);
      toast({
        variant: "destructive",
        title: "Picker Error",
        description: `Could not open folder picker: ${error.message}`,
      });
      setIsSettingRootFolder(false);
    }
  };

  return {
    rootFolderDisplayId,
    rootFolderDriveId,
    isSettingRootFolder,
    tempRootFolderName,
    setTempRootFolderName,
    findOrCreateFolderAPI,
    handleSetRootFolderByName,
    handleSelectExistingFolder,
    listSubFolders, // Added
  };
}
