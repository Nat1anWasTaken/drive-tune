"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "./use-toast"; // Assuming useToast is in the same directory or adjust path

// Ensure these are set in your .env.local file
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
// Sufficient for picker and file operations
// const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file";
const DRIVE_SCOPES =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly"; // Added metadata scope for picker

// Define types for Google Sign-In and API if not globally available
// These might come from @types/google.accounts and @types/gapi
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

type TokenClient = any; // Replace with actual type from google.accounts
type TokenResponse = any; // Replace with actual type from google.accounts

export interface GoogleDriveAuth {
  accessToken: string | null;
  gapiReady: boolean;
  gisReady: boolean;
  pickerApiLoaded: boolean;
  isConnecting: boolean;
  isDriveConnected: boolean;
  handleConnectDrive: () => void;
  tokenClient: TokenClient | null; // Exposing tokenClient if needed by other hooks like picker
}

export function useGoogleDriveAuth(): GoogleDriveAuth {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<TokenClient | null>(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const { toast } = useToast();

  const isDriveConnected = !!accessToken && gapiReady && gisReady;

  useEffect(() => {
    const scriptGapi = document.createElement("script");
    scriptGapi.src = "https://apis.google.com/js/api.js";
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = () => {
      window.gapi.load("client:picker", () => {
        setGapiReady(true); // gapi.client is available
        setPickerApiLoaded(true); // gapi.picker is available
        // console.log("GAPI and Picker API loaded.");
      });
    };
    document.body.appendChild(scriptGapi);

    const scriptGis = document.createElement("script");
    scriptGis.src = "https://accounts.google.com/gsi/client";
    scriptGis.async = true;
    scriptGis.defer = true;
    scriptGis.onload = () => {
      setGisReady(true);
      // console.log("GIS loaded.");
    };
    document.body.appendChild(scriptGis);

    return () => {
      document.body.removeChild(scriptGapi);
      document.body.removeChild(scriptGis);
    };
  }, []); // Removed toast from dependencies as it's stable

  useEffect(() => {
    if (gisReady && GOOGLE_CLIENT_ID && window.google?.accounts?.oauth2) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPES,
        callback: (tokenResponse: TokenResponse) => {
          setIsConnecting(false);
          if (tokenResponse && tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
            // console.log("Access token received:", tokenResponse.access_token);
            toast({
              title: "Google Drive Connected",
              description: "Access token received.",
            });
          } else {
            // console.error("Connection Failed: Could not get access token.", tokenResponse);
            toast({
              variant: "destructive",
              title: "Connection Failed",
              description:
                "Could not get access token. Check console for details.",
            });
          }
        },
      });
      setTokenClient(client);
      // console.log("Token client initialized.");
    }
    if (gisReady && !GOOGLE_CLIENT_ID) {
      // console.error("Configuration Error: Google Client ID is missing.");
      toast({
        variant: "destructive",
        title: "Configuration Error",
        description:
          "Google Client ID is missing. App functionality will be limited.",
      });
    }
  }, [gisReady, toast]);

  const handleConnectDrive = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      toast({
        variant: "destructive",
        title: "Configuration Missing",
        description: "Client ID is not set. Cannot connect to Google Drive.",
      });
      return;
    }
    if (tokenClient) {
      setIsConnecting(true);
      // console.log("Requesting access token...");
      tokenClient.requestAccessToken();
    } else {
      // console.error("Initialization Error: Google Identity Service not ready for connect.");
      toast({
        variant: "destructive",
        title: "Initialization Error",
        description:
          "Google Identity Service not ready. Please wait or refresh.",
      });
    }
  }, [tokenClient, toast]);

  return {
    accessToken,
    gapiReady,
    gisReady,
    pickerApiLoaded,
    isConnecting,
    isDriveConnected,
    handleConnectDrive,
    tokenClient,
  };
}
