"use client";

import type { ProcessedFile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Loader2, FileText, UploadCloud, Edit3, FolderPlus } from "lucide-react";

interface FileListItemProps {
  item: ProcessedFile;
}

const getStatusIcon = (status: ProcessedFile['status']) => {
  switch (status) {
    case 'pending':
      return <FileText className="h-5 w-5 text-muted-foreground" />;
    case 'reading':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'extracting':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'naming':
      return <Edit3 className="h-5 w-5 text-primary" />;
    case 'creating_dir':
      return <FolderPlus className="h-5 w-5 text-primary" />;
    case 'organizing':
        return <Loader2 className="h-5 w-5 animate-spin text-accent" />;
    case 'done':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-destructive" />;
    default:
      return <FileText className="h-5 w-5 text-muted-foreground" />;
  }
};

const getProgressValue = (status: ProcessedFile['status']): number => {
  switch (status) {
    case 'pending': return 0;
    case 'reading': return 10;
    case 'extracting': return 30;
    case 'naming': return 50;
    case 'creating_dir': return 70;
    case 'organizing': return 85;
    case 'done': return 100;
    case 'error': return 100; // Or 0 if you want to show error differently
    default: return 0;
  }
}

export function FileListItem({ item }: FileListItemProps) {
  const progressValue = getProgressValue(item.status);

  return (
    <Card className="mb-4 shadow-md">
      <CardHeader className="p-4">
        <CardTitle className="text-md flex items-center justify-between">
          <span className="truncate max-w-[calc(100%-3rem)]" title={item.file.name}>{item.file.name}</span>
          {getStatusIcon(item.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-sm text-muted-foreground mb-2">{item.statusMessage}</div>
        <Progress value={progressValue} className="h-2" />
        {item.error && <p className="text-destructive text-xs mt-2">{item.error}</p>}
        {item.status === 'done' && item.targetDirectoryPath && (
          <p className="text-xs text-green-600 mt-2">
            Organized as: {item.targetDirectoryPath}/{item.generatedFilename}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
