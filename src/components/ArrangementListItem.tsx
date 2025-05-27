
"use client";

import type { Arrangement, ArrangementStatus } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PartListItem } from "./FileListItem"; // Renamed FileListItem to PartListItem effectively
import { CheckCircle2, XCircle, Loader2, FileUp, AlertTriangle, Sparkles, FileSymlink, Pencil, Hourglass, FolderCog } from "lucide-react";
import React, { useState } from "react";

interface ArrangementListItemProps {
  arrangement: Arrangement;
  onFileChange: (arrangementId: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  onProcess: (arrangement: Arrangement) => Promise<void>;
  isProcessingGlobal: boolean;
  updateArrangementName: (arrangementId: string, newName: string) => void;
}

const getArrangementStatusIcon = (status: ArrangementStatus) => {
  switch (status) {
    case 'pending_upload':
      return <FileUp className="h-5 w-5 text-muted-foreground" />;
    case 'ready_to_process':
      return <FileSymlink className="h-5 w-5 text-blue-500" />;
    case 'reading_file':
    case 'extracting_metadata':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'creating_directory':
      return <FolderCog className="h-5 w-5 animate-spin text-purple-500" />;
    case 'processing_parts':
      return <Hourglass className="h-5 w-5 animate-spin text-orange-500" />;
    case 'all_parts_processed':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'done':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <FileUp className="h-5 w-5 text-muted-foreground" />;
  }
};

const getArrangementProgressValue = (status: ArrangementStatus, partsProcessed?: number, totalParts?: number): number => {
  switch (status) {
    case 'pending_upload': return 0;
    case 'ready_to_process': return 5;
    case 'reading_file': return 10;
    case 'extracting_metadata': return 25;
    case 'creating_directory': return 40;
    case 'processing_parts':
      if (totalParts && totalParts > 0 && partsProcessed !== undefined) {
        return 40 + (partsProcessed / totalParts) * 50; // processing_parts takes from 40% to 90%
      }
      return 40;
    case 'all_parts_processed': return 95; // Indicates completion but with potential part errors
    case 'done': return 100;
    case 'error': return 100;
    default: return 0;
  }
}

export function ArrangementListItem({ arrangement, onFileChange, onProcess, isProcessingGlobal, updateArrangementName }: ArrangementListItemProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState(arrangement.name);
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableName(e.target.value);
  };

  const saveName = () => {
    if (editableName.trim()) {
      updateArrangementName(arrangement.id, editableName.trim());
    } else {
      setEditableName(arrangement.name); // Reset if empty
    }
    setIsEditingName(false);
  };

  const partsProcessedCount = arrangement.processedParts.filter(p => p.status === 'done' || p.status === 'error').length;
  const totalPartsCount = arrangement.processedParts.length;
  const progressValue = getArrangementProgressValue(arrangement.status, partsProcessedCount, totalPartsCount);
  const canProcess = arrangement.status === 'ready_to_process' && !!arrangement.file && !isProcessingGlobal;

  return (
    <Card className="shadow-md bg-card/70 border">
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
            {isEditingName ? (
                 <Input 
                    value={editableName} 
                    onChange={handleNameChange} 
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    className="text-lg font-semibold h-8 mr-2"
                    autoFocus
                 />
            ) : (
                <CardTitle className="text-lg flex items-center" onClick={() => setIsEditingName(true)} title="Click to edit name">
                    {arrangement.name}
                    <Pencil className="h-4 w-4 ml-2 text-muted-foreground hover:text-primary cursor-pointer"/>
                </CardTitle>
            )}

          {getArrangementStatusIcon(arrangement.status)}
        </div>
        <CardDescription className="text-xs">{arrangement.statusMessage}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Progress value={progressValue} className="h-2 mb-3" />

        {arrangement.status === 'pending_upload' && (
          <>
            <Input
              type="file"
              ref={fileInputRef}
              onChange={(e) => onFileChange(arrangement.id, e)}
              className="hidden"
              accept=".pdf"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full">
              <FileUp className="mr-2 h-4 w-4" /> Upload PDF for this Arrangement
            </Button>
          </>
        )}
        {arrangement.file && arrangement.status !== 'pending_upload' && (
            <p className="text-xs text-muted-foreground mb-2">File: {arrangement.file.name}</p>
        )}

        {arrangement.error && <p className="text-destructive text-sm mt-2">{arrangement.error}</p>}

        {arrangement.processedParts && arrangement.processedParts.length > 0 && (
          <div className="mt-3">
            <h4 className="text-sm font-medium mb-1.5 text-primary-foreground/80">Parts:</h4>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {arrangement.processedParts.map(part => (
                <PartListItem key={part.id} part={part} targetDirectoryPath={arrangement.targetDirectoryPath} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
      {arrangement.status === 'ready_to_process' && (
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
