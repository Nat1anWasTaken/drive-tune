
"use client";

import type { ProcessedPart, PartStatus } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, FileText, Edit3, Cog } from "lucide-react";

interface PartListItemProps {
  part: ProcessedPart;
  targetDirectoryPath?: string; // Passed from parent ArrangementListItem
}

const getStatusIcon = (status: PartStatus) => {
  switch (status) {
    case 'pending':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case 'naming':
      return <Edit3 className="h-4 w-4 text-primary animate-pulse" />;
    case 'organizing':
        return <Cog className="h-4 w-4 animate-spin text-accent" />; // Using Cog for organizing step
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

export function PartListItem({ part, targetDirectoryPath }: PartListItemProps) {
  const progressValue = getProgressValue(part.status);

  return (
    <Card className="mb-2 shadow-sm border-border/70">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate max-w-[calc(100%-2.5rem)]" title={part.label}>
            Part: {part.label}
          </span>
          {getStatusIcon(part.status)}
        </div>
        <div className="text-xs text-muted-foreground mb-2">{part.statusMessage}</div>
        <Progress value={progressValue} className="h-1.5" />
        {part.error && <p className="text-destructive text-xs mt-1.5">{part.error}</p>}
        {part.status === 'done' && targetDirectoryPath && part.generatedFilename && (
          <p className="text-xs text-green-600 mt-1.5">
            Organized as: .../{targetDirectoryPath.split('/').slice(-2).join('/')}/{part.generatedFilename}
          </p>
        )}
         {part.status !== 'done' && part.generatedFilename && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Filename: {part.generatedFilename}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
