"use client";

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import type { EditSegment, TransitionType } from "@/types/timeline";

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "crossfade", label: "Crossfade" },
  { value: "fade_black", label: "Fade Black" },
  { value: "zoom_in", label: "Zoom In" },
  { value: "swipe", label: "Swipe" },
];

interface SegmentPropertiesProps {
  segment: EditSegment;
  onUpdate: (updates: Partial<EditSegment>) => void;
}

function SegmentProperties({ segment, onUpdate }: SegmentPropertiesProps) {
  return (
    <Card padding="md" className="space-y-4">
      <h4 className="font-semibold text-sm">Segment Properties</h4>

      <Input
        label="Label"
        value={segment.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Start (s)"
          type="number"
          step={0.1}
          value={segment.start_time}
          onChange={(e) => onUpdate({ start_time: parseFloat(e.target.value) })}
        />
        <Input
          label="End (s)"
          type="number"
          step={0.1}
          value={segment.end_time}
          onChange={(e) => onUpdate({ end_time: parseFloat(e.target.value) })}
        />
      </div>

      <Select
        label="Transition"
        value={segment.transition_in}
        onChange={(e) => onUpdate({ transition_in: e.target.value as TransitionType })}
        options={TRANSITIONS}
      />

      <Slider
        label="Speed"
        value={segment.speed_factor}
        onChange={(v) => onUpdate({ speed_factor: v })}
        min={0.25}
        max={3}
        step={0.25}
        formatValue={(v) => `${v}x`}
      />

      <Input
        label="Subtitle"
        value={segment.subtitle_text || ""}
        onChange={(e) => onUpdate({ subtitle_text: e.target.value || null })}
        placeholder="Add subtitle text..."
      />
    </Card>
  );
}

export { SegmentProperties };
