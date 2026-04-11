"use client";

import { cn } from "@/lib/utils";

interface SelectionCardProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

function SelectionCard({ selected, onClick, label, description, disabled, className }: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-4 rounded-xl border text-left transition-all duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        selected
          ? "border-emerald-500/40 bg-emerald-500/[0.08] shadow-[0_0_16px_rgba(16,185,129,0.08)] ring-1 ring-emerald-500/20"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]",
        className,
      )}
    >
      <span className={cn("font-semibold block text-sm", selected && "text-emerald-400")}>{label}</span>
      {description && <span className="text-xs text-muted mt-1 block leading-relaxed">{description}</span>}
    </button>
  );
}

export { SelectionCard };
