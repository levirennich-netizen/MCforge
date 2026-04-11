"use client";

import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 cursor-pointer select-none group",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 shrink-0",
          checked
            ? "bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
            : "border-white/[0.15] bg-transparent group-hover:border-white/[0.25]",
        )}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className="text-sm text-foreground/80">{label}</span>
    </label>
  );
}

export { Checkbox };
