"use client";

import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: string;
  onStepClick: (key: string) => void;
}

function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1.5 mb-8 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = step.key === currentStep;

        return (
          <button
            key={step.key}
            onClick={() => onStepClick(step.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200",
              isCurrent && "bg-emerald-500/15 text-emerald-400 shadow-[inset_0_1px_0_rgba(16,185,129,0.2)]",
              isCompleted && "text-emerald-400/70 hover:bg-white/[0.04]",
              !isCurrent && !isCompleted && "text-muted/60 hover:text-muted hover:bg-white/[0.03]",
            )}
          >
            <span
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all duration-200",
                isCurrent && "bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]",
                isCompleted && "bg-emerald-500/20 text-emerald-400",
                !isCurrent && !isCompleted && "bg-white/[0.06] text-muted/60",
              )}
            >
              {isCompleted ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="truncate">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { StepIndicator };
