"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAnalysis, getHighlights, startAnalysis } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import { useJobProgress } from "@/lib/sse";
import { formatDuration } from "@/lib/utils";
import { catchToast, toast } from "@/lib/toast";
import type { Highlight } from "@/types/analysis";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { JobProgressCard } from "@/components/ui/JobProgressCard";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { analyses, activeJobs, setAnalyses } = useProjectStore();
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  useJobProgress(projectId);

  useEffect(() => {
    getAnalysis(projectId).then(setAnalyses).catch(catchToast("Failed to load analysis"));
    getHighlights(projectId).then(setHighlights).catch(() => {});
  }, [projectId]);

  const analysisJob = Object.values(activeJobs).find((j) => j.stage === "analyze");
  useEffect(() => {
    if (analysisJob?.status === "completed") {
      getAnalysis(projectId).then(setAnalyses).catch(() => {});
      getHighlights(projectId).then(setHighlights).catch(() => {});
    }
  }, [analysisJob?.status]);

  const handleReAnalyze = async () => {
    try {
      await startAnalysis(projectId);
      toast.info("Re-analysis started");
    } catch {
      toast.error("Failed to start analysis");
    }
  };

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Analysis Results"
        backHref={`/projects/${projectId}`}
        actions={
          <Button onClick={handleReAnalyze} className="bg-blue-600 hover:bg-blue-700">
            Re-analyze
          </Button>
        }
      />

      {/* Progress */}
      {analysisJob?.status === "running" && (
        <div className="mb-6">
          <JobProgressCard
            stage={analysisJob.stage}
            status={analysisJob.status}
            progress={analysisJob.progress}
            message={analysisJob.message}
          />
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Detected Highlights ({highlights.length})</h3>
          <div className="grid gap-3">
            {highlights.map((h, i) => (
              <Card key={i} padding="sm" className="flex items-center gap-4 animate-fade-in opacity-0" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="text-center min-w-[60px]">
                  <span className="text-2xl font-bold text-yellow-400">{h.excitement}</span>
                  <span className="text-xs text-muted block">/10</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{h.description}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-accent font-mono">
                      {formatDuration(h.timestamp)}
                    </span>
                    {h.categories.map((c) => (
                      <Badge key={c} variant="muted">{c}</Badge>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Per-clip Analysis */}
      {analyses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Clip Analysis</h3>
          {analyses.map((a) => (
            <Card key={a.clip_id} padding="md" className="mb-4">
              <h4 className="font-medium mb-3">Clip: {a.clip_id}</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted">Scenes:</span>{" "}
                  {a.video?.scenes.length || 0}
                </div>
                <div>
                  <span className="text-muted">Avg Excitement:</span>{" "}
                  <span className="text-yellow-400">{a.video?.avg_excitement.toFixed(1) || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted">Silent Segments:</span>{" "}
                  {a.audio?.silence_segments.length || 0}
                </div>
              </div>

              {/* Motion Graph */}
              {a.video?.motion_scores && a.video.motion_scores.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted mb-2">Motion Intensity</p>
                  <div className="flex items-end gap-px h-16">
                    {a.video.motion_scores.slice(0, 100).map((ms, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-accent/60 rounded-t-sm min-w-[2px] transition-all hover:bg-accent"
                        style={{ height: `${ms.score * 100}%` }}
                        title={`${formatDuration(ms.timestamp)}: ${(ms.score * 100).toFixed(0)}%`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {analyses.length === 0 && !analysisJob && (
        <EmptyState
          icon={
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          title="No analysis results yet"
          description='Go back and click "Analyze Clips" to detect highlights and scenes'
          action={{ label: "Back to Project", onClick: () => router.push(`/projects/${projectId}`) }}
        />
      )}
    </PageContainer>
  );
}
