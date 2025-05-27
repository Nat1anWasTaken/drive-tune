
"use client";

import type { ProcessedPart, PartStatus } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, FileText, Edit3, Cog } from "lucide-react";

interface PartListItemProps {
  part: ProcessedPart;
  arrangementType?: string; // Arrangement type, e.g., "Percussion Ensemble"
  rootFolderName?: string; // e.g., "My Music Sheets"
}

const getStatusIcon = (status: PartStatus) => {
  switch (status) {
    case 'pending':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'naming':
      return <Edit3 className="h-4 w-4 text-primary animate-pulse" />;
    case 'organizing':
        return <Cog className="h-4 w-4 animate-spin text-accent" />; 
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

const getProgressValue = (status: PartStatus): number => {
  switch (status) {
    case 'pending': return 0;
    case 'naming': return 33;
    case 'organizing': return 66;
    case 'done': return 100;
    case 'error': return 100; 
    default: return 0;
  }
}

export function PartListItem({ part, arrangementType, rootFolderName }: PartListItemProps) {
  const progressValue = getProgressValue(part.status);

  const getDisplayPath = () => {
    // The filename (part.generatedFilename) now includes the arrangement name.
    // e.g., "- MIRA - - Glockenspiel.pdf"
    if (!part.generatedFilename || !arrangementType) {
      return part.generatedFilename || "Filename pending...";
    }
    // Display path is like: {Arrangement Type}/{Generated Filename}
    // e.g. "Percussion Ensemble/- MIRA - - Glockenspiel.pdf"
    const displaySegments = [arrangementType, part.generatedFilename];
    const displayStr = displaySegments.join('/');
    
    if (displayStr.length > 60) { // Heuristic for long paths to shorten display
        return `.../${part.generatedFilename}`;
    }
    return displayStr;
  }

  const fullPathTitle = () => {
    if (!part.generatedFilename || !arrangementType || !rootFolderName) {
        return part.generatedFilename || "Path details unavailable";
    }
    return `${rootFolderName}/${arrangementType}/${part.generatedFilename}`;
  }

  return (
    <Card className="mb-2 shadow-sm border-border/70">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate max-w-[calc(100%-2.5rem)]" title={`Part Label: ${part.label} | Primary Instrumentation: ${part.primaryInstrumentation}`}>
            Part: {part.label} 
          </span>
          {getStatusIcon(part.status)}
        </div>
        <div className="text-xs text-muted-foreground mb-2">{part.statusMessage}</div>
        <Progress value={progressValue} className="h-1.5" />
        {part.error && <p className="text-destructive text-xs mt-1.5">{part.error}</p>}
        
        {part.status === 'done' && part.generatedFilename && arrangementType && rootFolderName && (
          <p className="text-xs text-green-600 mt-1.5 truncate" title={fullPathTitle()}>
            Organized as: {getDisplayPath()}
          </p>
        )}
         {part.status !== 'done' && part.generatedFilename && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Filename preview: {part.generatedFilename}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
