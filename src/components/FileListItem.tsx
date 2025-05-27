
"use client";

import type { ProcessedPart, PartStatus } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, FileText, Edit3, Cog } from "lucide-react";

interface PartListItemProps {
  part: ProcessedPart;
  arrangementName?: string;
  arrangementType?: string;
  rootFolderName?: string;
  // targetDirectoryPath is no longer needed as we reconstruct the path preview
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

export function PartListItem({ part, arrangementName, arrangementType, rootFolderName }: PartListItemProps) {
  const progressValue = getProgressValue(part.status);

  const getDisplayPath = () => {
    if (!part.generatedFilename || !arrangementName || !arrangementType || !rootFolderName) {
      return part.generatedFilename || "Filename pending...";
    }
    // Show a simplified path like: .../Arrangement Type/Arrangement Name/filename.pdf
    // This assumes rootFolderName is just one segment. If it can be complex, adjust.
    const pathSegments = [arrangementType, arrangementName, part.generatedFilename];
    if (pathSegments.length > 3) {
        return `.../${pathSegments.slice(-3).join('/')}`;
    }
    return `${pathSegments.join('/')}`;
  }

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
        
        {part.status === 'done' && part.generatedFilename && arrangementName && arrangementType && rootFolderName && (
          <p className="text-xs text-green-600 mt-1.5 truncate" title={`${rootFolderName}/${arrangementType}/${arrangementName}/${part.generatedFilename}`}>
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

