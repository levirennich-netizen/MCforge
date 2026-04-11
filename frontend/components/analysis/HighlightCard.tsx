import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/utils";
import type { Highlight } from "@/types/analysis";

interface HighlightCardProps {
  highlight: Highlight;
}

function HighlightCard({ highlight }: HighlightCardProps) {
  const variant = highlight.excitement >= 8 ? "success" : highlight.excitement >= 5 ? "warning" : "muted";
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-accent font-mono text-xs pt-0.5 shrink-0">
        {formatDuration(highlight.timestamp)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted truncate">{highlight.description}</p>
      </div>
      <Badge variant={variant} className="shrink-0">{highlight.excitement}/10</Badge>
    </div>
  );
}

export { HighlightCard };
