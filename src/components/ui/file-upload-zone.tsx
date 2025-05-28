"use client";

import { Input } from "@/components/ui/input";
import { FileUp } from "lucide-react";
import React, { useState } from "react";
{
}
interface FileUploadZoneProps {
  /** Callback function when files are selected or dropped */
  onFileChange: (files: FileList | File[]) => void;
  /** Accepted file types (e.g., '.pdf', '.jpg', '.png') */
  accept?: string;
  /** Whether multiple files can be selected */
  multiple?: boolean;
  /** Whether the upload zone is disabled */
  disabled?: boolean;
  /** Custom class name for the upload zone */
  className?: string;
  /** Custom content for the upload zone */
  children?: React.ReactNode;
  /** Maximum file size in bytes (optional validation) */
  maxFileSize?: number;
  /** Filter function to validate dropped files */
  fileFilter?: (file: File) => boolean;
  /** Text to display when files are being dragged over */
  dragOverText?: string;
  /** Text to display in the upload zone */
  uploadText?: string;
  /** Text to display as description */
  descriptionText?: string;
}

export function FileUploadZone({
  onFileChange,
  accept = "*",
  multiple = false,
  disabled = false,
  className = "",
  children,
  maxFileSize,
  fileFilter,
  dragOverText = "Release to upload files",
  uploadText = "Drag and drop files here or click to select",
  descriptionText,
}: FileUploadZoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Validate files based on props
  const validateFiles = (files: File[]): File[] => {
    let validFiles = files;

    // Apply custom file filter if provided
    if (fileFilter) {
      validFiles = validFiles.filter(fileFilter);
    }

    // Apply file size validation if provided
    if (maxFileSize) {
      validFiles = validFiles.filter((file) => file.size <= maxFileSize);
    }

    return validFiles;
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(files);

    if (validFiles.length > 0) {
      onFileChange(validFiles);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return;

    const files = Array.from(e.target.files);
    const validFiles = validateFiles(files);

    if (validFiles.length > 0) {
      onFileChange(validFiles);
    }

    // Reset input value to allow selecting the same file again
    e.target.value = "";
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const baseClasses = `border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
    disabled
      ? "border-muted-foreground/20 opacity-50 cursor-not-allowed"
      : isDragOver
      ? "border-primary bg-primary/10"
      : "border-muted-foreground/30 hover:border-primary/50 cursor-pointer"
  }`;

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`${baseClasses} ${className}`}
    >
      <Input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
      />

      {children ? (
        children
      ) : isDragOver ? (
        <div className="space-y-2">
          <FileUp className="mx-auto h-8 w-8 text-primary animate-bounce" />
          <p className="text-sm font-medium text-primary">{dragOverText}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{uploadText}</p>
          {descriptionText && (
            <p className="text-xs text-muted-foreground">{descriptionText}</p>
          )}
        </div>
      )}
    </div>
  );
}
