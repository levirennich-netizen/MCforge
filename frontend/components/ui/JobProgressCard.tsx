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
};

function JobProgressCard({ stage, status, progress, message }: JobProgressCardProps) {
  return (
    <Card padding="sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium capitalize">{stage}</span>
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
