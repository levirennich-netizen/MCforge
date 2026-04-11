"use client";

import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

function Slider({ value, onChange, min, max, step = 1, label, formatValue, className }: SliderProps) {
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted">{label}</label>
          <span className="text-xs text-foreground font-mono">{display}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={cn("w-full")}
      />
    </div>
  );
}

export { Slider };
