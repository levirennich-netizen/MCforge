"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium mb-2 text-foreground/80">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white/[0.03] border rounded-xl px-4 py-2.5 text-foreground text-sm resize-none",
            "placeholder:text-muted/60 transition-all duration-200",
            "focus:outline-none focus:ring-1",
            error
              ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
              : "border-white/[0.08] focus:border-emerald-500/50 focus:ring-emerald-500/20 hover:border-white/[0.12]",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
export { Textarea };
