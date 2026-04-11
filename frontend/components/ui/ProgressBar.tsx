import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number;
  color?: "accent" | "blue" | "purple" | "yellow";
  size?: "sm" | "md";
  animated?: boolean;
  label?: string;
  className?: string;
}

const colorStyles = {
  accent: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  blue: "bg-gradient-to-r from-blue-500 to-blue-400",
  purple: "bg-gradient-to-r from-purple-500 to-purple-400",
  yellow: "bg-gradient-to-r from-amber-500 to-amber-400",
};

const glowStyles = {
  accent: "shadow-[0_0_8px_rgba(16,185,129,0.3)]",
  blue: "shadow-[0_0_8px_rgba(59,130,246,0.3)]",
  purple: "shadow-[0_0_8px_rgba(168,85,247,0.3)]",
  yellow: "shadow-[0_0_8px_rgba(245,158,11,0.3)]",
};

const sizeStyles = {
  sm: "h-1.5",
  md: "h-2.5",
};

function ProgressBar({
  progress,
  color = "accent",
  size = "md",
  animated,
  label,
  className,
}: ProgressBarProps) {
  const percent = Math.round(progress * 100);
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">{label}</span>
          <span className="text-xs text-muted font-mono">{percent}%</span>
        </div>
      )}
      <div className={cn("w-full bg-white/[0.06] rounded-full overflow-hidden", sizeStyles[size])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            colorStyles[color],
            animated && cn("animate-progress-pulse", glowStyles[color]),
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export { ProgressBar };
