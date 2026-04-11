"use client";

import { Card } from "@/components/ui/Card";
import { formatDuration, formatFileSize } from "@/lib/utils";
import type { ClipMetadata } from "@/types/project";

interface ClipCardProps {
  clip: ClipMetadata;
  projectId: string;
  onDelete?: (clipId: string) => void;
}

function ClipCard({ clip, projectId, onDelete }: ClipCardProps) {
  return (
    <Card padding="sm" className="flex items-center gap-4 group">
      <img
        src={`http://localhost:8000/projects/${projectId}/clips/${clip.id}/thumbnail`}
        alt={clip.filename}
        className="w-24 h-14 object-cover rounded bg-card-hover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{clip.filename}</p>
        <p className="text-xs text-muted">
          {formatDuration(clip.duration_seconds)} | {clip.width}x{clip.height} | {clip.fps.toFixed(0)}fps | {formatFileSize(clip.file_size_bytes)}
        </p>
      </div>
      {onDelete && (
        <button
          onClick={() => onDelete(clip.id)}
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-destructive transition-all p-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </Card>
  );
}

export { ClipCard };
