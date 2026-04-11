"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { formatDuration } from "@/lib/utils";
import type { EditSegment } from "@/types/timeline";

interface TimelineTrackProps {
  segments: EditSegment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function TimelineTrack({ segments, selectedId, onSelect, onDelete }: TimelineTrackProps) {
  return (
    <Card padding="sm" className="overflow-x-auto">
      {/* Segment ruler */}
      <div className="flex items-end gap-1 mb-2 border-b border-border pb-2 min-w-min">
        {segments.map((seg, i) => {
          const duration = (seg.end_time - seg.start_time) / seg.speed_factor;
          const widthPx = Math.max(duration * 12, 60);
          return (
            <div
              key={seg.segment_id}
              onClick={() => onSelect(seg.segment_id)}
              className={cn(
                "relative cursor-pointer rounded transition-all duration-150 group",
                selectedId === seg.segment_id
                  ? "ring-2 ring-accent ring-offset-1 ring-offset-background"
                  : "hover:ring-1 hover:ring-muted",
              )}
              style={{ width: widthPx, minWidth: 60 }}
            >
              <div
                className={cn(
                  "h-16 rounded flex items-center justify-center text-xs overflow-hidden px-1 transition-all",
                  "hover:brightness-110",
                  seg.subtitle_text ? "bg-blue-900/40" : "bg-accent/20",
                )}
              >
                <span className="truncate">{seg.label || `Seg ${i + 1}`}</span>
              </div>
              {/* Transition indicator */}
              {seg.transition_in !== "cut" && (
                <div className="absolute -left-1 top-0 bottom-0 w-2 bg-purple-500/50 rounded-l" />
              )}
              {/* Duration */}
              <div className="text-[10px] text-muted text-center mt-1">
                {formatDuration(duration)}
              </div>
              {/* Delete */}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(seg.segment_id); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* SFX track */}
      <div className="h-8 flex items-center">
        <span className="text-[10px] text-muted w-12 shrink-0">SFX</span>
        <div className="flex-1 flex gap-1 flex-wrap">
          {segments.flatMap((seg) =>
            seg.sfx.map((sfx, i) => (
              <span
                key={`${seg.segment_id}-sfx-${i}`}
                className="text-[9px] bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded"
              >
                {sfx.sound}
              </span>
            )),
          )}
        </div>
      </div>
    </Card>
  );
}

export { TimelineTrack };
