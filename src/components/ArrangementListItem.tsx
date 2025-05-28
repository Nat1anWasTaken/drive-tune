"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  formatFileSize,
  getProcessingMethodDescription,
} from "@/lib/file-size-utils";
import type { Arrangement, ArrangementStatus } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  FileSymlink,
  FileUp,
  HardDrive,
  Hourglass,
  Info,
  Loader2,
  Merge,
  Pencil,
  Sparkles,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { PartListItem } from "./FileListItem";

interface ArrangementListItemProps {
  arrangement: Arrangement;
  onFileChange: (
    arrangementId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  onProcess: (arrangement: Arrangement) => Promise<void>;
  isProcessingGlobal: boolean;
  updateArrangementName: (arrangementId: string, newName: string) => void;
  rootFolderName: string; // Added to pass to PartListItem
}

const getArrangementStatusIcon = (status: ArrangementStatus) => {
  switch (status) {
    case "pending_upload":
      return <FileUp className="h-5 w-5 text-muted-foreground" />;
    case "ready_to_process":
      return <FileSymlink className="h-5 w-5 text-blue-500" />;
    case "merging_files":
      return <Merge className="h-5 w-5 animate-pulse text-accent" />;
    case "reading_file":
    case "extracting_metadata":
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case "creating_drive_folder_structure":
      return <CloudCog className="h-5 w-5 animate-spin text-sky-500" />; // New Icon
    case "processing_parts":
      return <Hourglass className="h-5 w-5 animate-spin text-orange-500" />;
    case "all_parts_processed": // Some parts might have errors
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "done":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "error":
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <FileUp className="h-5 w-5 text-muted-foreground" />;
  }
};

const getArrangementProgressValue = (
  status: ArrangementStatus,
  partsProcessed?: number,
  totalParts?: number
): number => {
  switch (status) {
    case "pending_upload":
      return 0;
    case "ready_to_process":
      return 5;
    case "merging_files":
      return 8;
    case "reading_file":
      return 10;
    case "extracting_metadata":
      return 25;
    case "creating_drive_folder_structure":
      return 35;
    case "processing_parts":
      if (totalParts && totalParts > 0 && partsProcessed !== undefined) {
        return 40 + (partsProcessed / totalParts) * 50; // processing_parts takes from 40% to 90%
      }
      return 40;
    case "all_parts_processed":
      return 95;
    case "done":
      return 100;
    case "error":
      return 100;
    default:
      return 0;
  }
};

export function ArrangementListItem({
  arrangement,
  onFileChange,
  onProcess,
  isProcessingGlobal,
  updateArrangementName,
  rootFolderName,
}: ArrangementListItemProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState(arrangement.name);
  const [fileInfo, setFileInfo] = useState<{
    totalSize: number;
    files: Array<{
      name: string;
      size: number;
      processingMethod: ReturnType<typeof getProcessingMethodDescription>;
    }>;
  } | null>(null);

  useEffect(() => {
    setEditableName(arrangement.name);
  }, [arrangement.name]);

  // Calculate file information when files change
  useEffect(() => {
    if (arrangement.files && arrangement.files.length > 0) {
      const totalSize = arrangement.files.reduce(
        (sum, file) => sum + file.size,
        0
      );
      const filesWithInfo = arrangement.files.map((file) => ({
        name: file.name,
        size: file.size,
        processingMethod: getProcessingMethodDescription(file.size),
      }));

      setFileInfo({
        totalSize,
        files: filesWithInfo,
      });
    } else {
      setFileInfo(null);
    }
  }, [arrangement.files]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableName(e.target.value);
  };

  const saveName = () => {
    if (editableName.trim() && editableName.trim() !== arrangement.name) {
      updateArrangementName(arrangement.id, editableName.trim());
    } else {
      setEditableName(arrangement.name);
    }
    setIsEditingName(false);
  };

  const partsProcessedCount = arrangement.processedParts.filter(
    (p) => p.status === "done" || p.status === "error"
  ).length;
  const totalPartsCount = arrangement.processedParts.length;
  const progressValue = getArrangementProgressValue(
    arrangement.status,
    partsProcessedCount,
    totalPartsCount
  );
  const canProcess =
    arrangement.status === "ready_to_process" &&
    !!arrangement.files &&
    arrangement.files.length > 0 &&
    !isProcessingGlobal;
  const canEditName =
    arrangement.status === "pending_upload" ||
    arrangement.status === "ready_to_process";

  return (
    <Card className="shadow-md bg-card/70 border">
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          {isEditingName && canEditName ? (
            <Input
              value={editableName}
              onChange={handleNameChange}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="text-lg font-semibold h-8 mr-2"
              autoFocus
            />
          ) : (
            <CardTitle
              className="text-lg flex items-center"
              onClick={() => canEditName && setIsEditingName(true)}
              title={canEditName ? "Click to edit name" : arrangement.name}
            >
              {arrangement.name}
              {canEditName && (
                <Pencil className="h-4 w-4 ml-2 text-muted-foreground hover:text-primary cursor-pointer" />
              )}
            </CardTitle>
          )}

          {getArrangementStatusIcon(arrangement.status)}
        </div>
        <CardDescription className="text-xs">
          {arrangement.statusMessage}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Progress value={progressValue} className="h-2 mb-3" />

        {arrangement.status === "pending_upload" && (
          <>
            <Input
              type="file"
              ref={fileInputRef}
              onChange={(e) => onFileChange(arrangement.id, e)}
              className="hidden"
              accept=".pdf"
              multiple
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <FileUp className="mr-2 h-4 w-4" /> Upload PDF(s) for this
              Arrangement
            </Button>
          </>
        )}
        {arrangement.files &&
          arrangement.files.length > 0 &&
          arrangement.status !== "pending_upload" && (
            <div className="text-xs text-muted-foreground mb-2">
              <div className="flex items-center justify-between mb-1">
                <p>File(s) ({arrangement.files.length}):</p>
                {fileInfo && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">
                      Total: {formatFileSize(fileInfo.totalSize)}
                    </span>
                    {fileInfo.files.some(
                      (f) => f.processingMethod.method === "files-api"
                    ) && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <CloudCog className="h-3 w-3" />
                        <span>Files API</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ul className="list-disc list-inside pl-2 max-h-20 overflow-y-auto space-y-0.5">
                {arrangement.files.map((file, index) => {
                  const fileProcessingInfo = fileInfo?.files[index];
                  return (
                    <li
                      key={index}
                      className="truncate flex items-center justify-between"
                      title={file.name}
                    >
                      <span className="truncate">{file.name}</span>
                      {fileProcessingInfo && (
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(fileProcessingInfo.size)}
                          </span>
                          {fileProcessingInfo.processingMethod.method ===
                            "files-api" && (
                            <div
                              title={
                                fileProcessingInfo.processingMethod.description
                              }
                            >
                              <CloudCog className="h-3 w-3 text-amber-600" />
                            </div>
                          )}
                          {fileProcessingInfo.processingMethod.method ===
                            "direct" && (
                            <div
                              title={
                                fileProcessingInfo.processingMethod.description
                              }
                            >
                              <HardDrive className="h-3 w-3 text-green-600" />
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {fileInfo &&
                fileInfo.files.some(
                  (f) => f.processingMethod.method === "files-api"
                ) && (
                  <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                    <Info className="h-3 w-3 inline mr-1" />
                    Large files will use Files API (may take longer to process)
                  </div>
                )}
            </div>
          )}

        {arrangement.error && (
          <p className="text-destructive text-sm mt-2">{arrangement.error}</p>
        )}

        {arrangement.processedParts &&
          arrangement.processedParts.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium mb-1.5 text-primary-foreground/80">
                Parts:
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {arrangement.processedParts.map((part) => (
                  <PartListItem
                    key={part.id}
                    part={part}
                    arrangementName={arrangement.name} // This is the extracted title
                    arrangementType={
                      arrangement.extractedMetadata?.arrangement_type
                    }
                    rootFolderName={rootFolderName}
                  />
                ))}
              </div>
            </div>
          )}
      </CardContent>
      {arrangement.status === "ready_to_process" && (
        <CardFooter className="p-4 pt-0">
          <Button
            onClick={() => onProcess(arrangement)}
            disabled={!canProcess}
            className="w-full bg-primary hover:bg-primary/90"
            size="sm"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Process This Arrangement
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
