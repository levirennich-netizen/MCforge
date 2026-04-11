"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface DropZoneProps {
  onFiles: (files: FileList) => void;
  uploading: boolean;
  progress: number;
  accept: string;
  label: string;
  sublabel: string;
}

function DropZone({ onFiles, uploading, progress, accept, label, sublabel }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = accept;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) onFiles(files);
    };
    input.click();
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={uploading ? undefined : handleClick}
      className={cn(
        "border border-dashed rounded-2xl p-10 text-center transition-all duration-300",
        uploading ? "cursor-default" : "cursor-pointer",
        dragOver
          ? "border-emerald-500/50 bg-emerald-500/[0.04] scale-[1.01] shadow-[0_0_32px_rgba(16,185,129,0.06)]"
          : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]",
      )}
    >
      {uploading ? (
        <div className="space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-sm text-foreground/80">Uploading... {Math.round(progress * 100)}%</p>
          <ProgressBar progress={progress} size="sm" className="max-w-xs mx-auto" />
        </div>
      ) : (
        <>
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm text-foreground/70 mb-1">{label}</p>
          <p className="text-xs text-muted/50">{sublabel}</p>
        </>
      )}
    </div>
  );
}

export { DropZone };
