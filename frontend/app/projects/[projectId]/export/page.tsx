"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { startExport, listExports, getExportDownloadUrl } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import { useJobProgress } from "@/lib/sse";
import { formatDuration, formatFileSize } from "@/lib/utils";
import { toast, catchToast } from "@/lib/toast";
import type { ExportRecord } from "@/types/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { SelectionCard } from "@/components/ui/SelectionCard";
import { JobProgressCard } from "@/components/ui/JobProgressCard";

const QUALITIES = [
  { value: "preview", label: "Preview", desc: "720p, fast render" },
  { value: "1080p", label: "1080p", desc: "Full HD, YouTube ready" },
  { value: "4k", label: "4K", desc: "Ultra HD, slow render" },
];

export default function ExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { activeJobs } = useProjectStore();

  const [quality, setQuality] = useState("1080p");
  const [includeNarration, setIncludeNarration] = useState(true);
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [exports, setExports] = useState<ExportRecord[]>([]);

  useJobProgress(projectId);

  useEffect(() => {
    listExports(projectId).then(setExports).catch(catchToast("Failed to load exports"));
  }, [projectId]);

  const exportJob = Object.values(activeJobs).find((j) => j.stage === "export");

  useEffect(() => {
    if (exportJob?.status === "completed") {
      listExports(projectId).then(setExports).catch(() => {});
      toast.success("Export complete!");
    }
  }, [exportJob?.status]);

  const handleExport = async () => {
    try {
      await startExport(projectId, quality, {
        include_narration: includeNarration,
        include_subtitles: includeSubtitles,
        include_music: includeMusic,
      });
      toast.info("Export started...");
    } catch {
      toast.error("Failed to start export");
    }
  };

  return (
    <PageContainer size="sm">
      <PageHeader title="Export Video" backHref={`/projects/${projectId}`} />

      {/* Progress */}
      {exportJob?.status === "running" && (
        <div className="mb-6">
          <JobProgressCard
            stage={exportJob.stage}
            status={exportJob.status}
            progress={exportJob.progress}
            message={exportJob.message}
          />
        </div>
      )}

      {/* Settings */}
      <Card padding="lg" className="mb-6 space-y-6">
        {/* Quality */}
        <div>
          <label className="block text-sm font-medium mb-3">Quality</label>
          <div className="grid grid-cols-3 gap-3">
            {QUALITIES.map((q) => (
              <SelectionCard
                key={q.value}
                selected={quality === q.value}
                onClick={() => setQuality(q.value)}
                label={q.label}
                description={q.desc}
                className="text-center"
              />
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <Checkbox checked={includeNarration} onChange={setIncludeNarration} label="Include Narration" />
          <Checkbox checked={includeSubtitles} onChange={setIncludeSubtitles} label="Include Subtitles" />
          <Checkbox checked={includeMusic} onChange={setIncludeMusic} label="Include Music" />
        </div>

        <Button
          size="lg"
          loading={exportJob?.status === "running"}
          onClick={handleExport}
          className="w-full"
        >
          {exportJob?.status === "running" ? "Rendering..." : `Export ${quality.toUpperCase()}`}
        </Button>
      </Card>

      {/* Previous Exports */}
      {exports.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Previous Exports</h3>
          <div className="space-y-2">
            {exports.map((exp, i) => (
              <Card
                key={exp.id}
                padding="sm"
                className="flex items-center justify-between animate-fade-in opacity-0"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div>
                  <p className="text-sm font-medium">{exp.quality.toUpperCase()}</p>
                  <p className="text-xs text-muted">
                    {formatDuration(exp.duration_seconds)} | {formatFileSize(exp.file_size_bytes)} |{" "}
                    {new Date(exp.created_at).toLocaleString()}
                  </p>
                </div>
                <a href={getExportDownloadUrl(projectId, exp.id)} download>
                  <Button size="sm">Download</Button>
                </a>
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
