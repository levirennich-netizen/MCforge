import { Card } from "./Card";
import { Badge } from "./Badge";
import { ProgressBar } from "./ProgressBar";

interface JobProgressCardProps {
  stage: string;
  status: string;
  progress: number;
  message: string;
}

const statusVariant: Record<string, "info" | "success" | "error"> = {
  running: "info",
  completed: "success",
  failed: "error",
};

const stageColor: Record<string, "accent" | "blue" | "purple" | "yellow"> = {
  analyze: "blue",
  plan: "purple",
  narrate: "accent",
  export: "accent",
  compose: "yellow",
  auto_edit: "accent",
};

const stageLabel: Record<string, string> = {
  analyze: "Analyzing Clips",
  plan: "Generating Edit Plan",
  narrate: "Creating Narration",
  export: "Exporting Video",
  compose: "Composing Video",
  auto_edit: "Generating Video",
};

function JobProgressCard({ stage, status, progress, message }: JobProgressCardProps) {
  return (
    <Card padding="sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {status === "running" && (
            <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin shrink-0" />
          )}
          <span className="text-sm font-medium">{stageLabel[stage] || stage}</span>
        </div>
        <Badge variant={statusVariant[status] || "info"}>{status}</Badge>
      </div>
      <ProgressBar
        progress={progress}
        color={stageColor[stage] || "accent"}
        size="sm"
        animated={status === "running"}
      />
      {message && <p className="text-xs text-muted mt-1.5">{message}</p>}
    </Card>
  );
}

export { JobProgressCard };
