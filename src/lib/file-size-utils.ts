/**
 * Client-side utilities for file size validation and Files API detection
 * These functions can be safely used in client components
 */

/**
 * Converts a data URI to a Buffer and extracts MIME type, or validates Files API URI
 */
function processInputUri(uri: string): {
  buffer?: Buffer;
  mimeType?: string;
  isFilesApiUri: boolean;
  byteSize?: number;
} {
  // Check if it's a Files API URI
  if (
    uri.startsWith("https://generativelanguage.googleapis.com/v1beta/files/")
  ) {
    return { isFilesApiUri: true };
  }

  // Handle data URI
  const match = uri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error(
      "Invalid URI format. Expected either a data URI (format: 'data:<mimetype>;base64,<encoded_data>') or Files API URI (format: 'https://generativelanguage.googleapis.com/v1beta/files/<file-id>')"
    );
  }

  const mimeType = match[1];
  const base64Data = match[2];

  // For client-side, we calculate size without creating a full Buffer
  // Base64 padding calculation for accurate size
  let paddingLength = 0;
  if (base64Data.endsWith("==")) {
    paddingLength = 2;
  } else if (base64Data.endsWith("=")) {
    paddingLength = 1;
  }

  // Calculate actual byte size
  const byteSize = (base64Data.length * 3) / 4 - paddingLength;

  return {
    buffer: undefined, // Don't create buffer on client-side
    mimeType,
    isFilesApiUri: false,
    byteSize,
  };
}

/**
 * Utility function to check if a file should use Files API based on size
 */
export function shouldUseFilesAPI(fileSizeBytes: number): boolean {
  const MAX_INLINE_SIZE = 20 * 1024 * 1024; // 20 MB
  return fileSizeBytes > MAX_INLINE_SIZE;
}

/**
 * Utility function to get file size from data URI (client-safe)
 */
export function getFileSizeFromDataUri(dataUri: string): number {
  const inputInfo = processInputUri(dataUri);
  if (inputInfo.isFilesApiUri) {
    throw new Error("Cannot determine file size from Files API URI");
  }
  return (inputInfo as any).byteSize || 0;
}

/**
 * Utility function to get file size from File object
 */
export function getFileSizeFromFile(file: File): number {
  return file.size;
}

/**
 * Utility function to check file size limits
 */
export function validateFileSize(fileSizeBytes: number): {
  valid: boolean;
  recommendation: string;
} {
  const MAX_INLINE_SIZE = 20 * 1024 * 1024; // 20 MB
  const MAX_FILES_API_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
  const fileSizeMB = Math.round(fileSizeBytes / (1024 * 1024));

  if (fileSizeBytes > MAX_FILES_API_SIZE) {
    return {
      valid: false,
      recommendation: `File size (${fileSizeMB} MB) exceeds the maximum limit of 2 GB. Please reduce the file size or split the PDF.`,
    };
  } else if (fileSizeBytes > MAX_INLINE_SIZE) {
    return {
      valid: true,
      recommendation: `File size (${fileSizeMB} MB) will use Files API (slower but supports larger files up to 2 GB).`,
    };
  } else {
    return {
      valid: true,
      recommendation: `File size (${fileSizeMB} MB) will use direct upload (faster, up to 20 MB).`,
    };
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Get processing method description
 */
export function getProcessingMethodDescription(fileSizeBytes: number): {
  method: "direct" | "files-api";
  description: string;
  icon: string;
} {
  const usesFilesAPI = shouldUseFilesAPI(fileSizeBytes);

  if (usesFilesAPI) {
    return {
      method: "files-api",
      description: "Large file - will use Files API (may take longer)",
      icon: "CloudCog",
    };
  } else {
    return {
      method: "direct",
      description: "Normal file - will use direct processing (faster)",
      icon: "HardDrive",
    };
  }
}
