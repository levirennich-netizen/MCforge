"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, listClips, uploadClip, startAnalysis, getAnalysis, generatePlan, getHighlights } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import { useJobProgress } from "@/lib/sse";
import { toast, catchToast } from "@/lib/toast";
import type { Highlight } from "@/types/analysis";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StepIndicator } from "@/components/layout/StepIndicator";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JobProgressCard } from "@/components/ui/JobProgressCard";
import { Skeleton, SkeletonClip } from "@/components/ui/Skeleton";
import { DropZone } from "@/components/upload/DropZone";
import { ClipCard } from "@/components/upload/ClipCard";
import { HighlightCard } from "@/components/analysis/HighlightCard";

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "analyze", label: "Analyze" },
  { key: "edit", label: "Edit Timeline" },
  { key: "narration", label: "Narration" },
  { key: "generate", label: "Generate" },
  { key: "export", label: "Export" },
];

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { project, clips, activeJobs, setProject, setClips, addClip, setAnalyses } = useProjectStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  useJobProgress(projectId);

  useEffect(() => {
    getProject(projectId).then(setProject).catch(() => { toast.error("Project not found"); router.push("/"); });
    listClips(projectId).then(setClips).catch(catchToast("Failed to load clips"));
    getAnalysis(projectId).then(setAnalyses).catch(() => {});
    getHighlights(projectId).then(setHighlights).catch(() => {});
  }, [projectId]);

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const clip = await uploadClip(projectId, file, clips.length + i, (p) => {
          setUploadProgress(p);
        });
        addClip(clip);
        toast.success(`Uploaded ${file.name}`);
      } catch {
        toast.error(`Upload failed: ${file.name}`);
      }
    }
    setUploading(false);
    setUploadProgress(0);
  }, [projectId, clips.length, addClip]);

  const handleAnalyze = async () => {
    try {
      await startAnalysis(projectId);
      toast.info("Analysis started");
    } catch {
      toast.error("Failed to start analysis");
    }
  };

  const handleGeneratePlan = async () => {
    try {
      await generatePlan(projectId, project?.style_preset || "high_energy");
      toast.info("Generating edit plan...");
    } catch {
      toast.error("Failed to start plan generation");
    }
  };

  const handleStepClick = (key: string) => {
    if (key === "upload") return;
    router.push(`/projects/${projectId}/${key}`);
  };

  if (!project) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2 mt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 h-10 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2 space-y-3">
              <SkeletonClip />
              <SkeletonClip />
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  const jobEntries = Object.entries(activeJobs);
  const hasRunningJobs = jobEntries.some(([, j]) => j.status === "running");

  return (
    <PageContainer>
      <PageHeader
        title={project.name}
        subtitle={`Style: ${project.style_preset} | Status: ${project.status}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/projects/${projectId}/edit`)}>
              Timeline Editor
            </Button>
            <Button size="sm" onClick={() => router.push(`/projects/${projectId}/export`)}>
              Export
            </Button>
          </>
        }
      />

      <StepIndicator
        steps={STEPS}
        currentStep="upload"
        onStepClick={handleStepClick}
      />

      {/* Job Progress */}
      {jobEntries.length > 0 && (
        <div className="mb-6 space-y-2.5">
          {jobEntries.map(([jobId, job]) => (
            <JobProgressCard
              key={jobId}
              stage={job.stage}
              status={job.status}
              progress={job.progress}
              message={job.message}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2">
          <h3 className="text-base font-semibold mb-4 text-foreground/80">
            Clips <span className="text-muted/50 font-normal">({clips.length})</span>
          </h3>

          <DropZone
            onFiles={handleUpload}
            uploading={uploading}
            progress={uploadProgress}
            accept=".mp4,.mov,.mkv,.avi,.webm"
            label="Drop Minecraft clips here or click to browse"
            sublabel="MP4, MOV, MKV, AVI, WebM"
          />

          <div className="space-y-2.5 mt-4">
            {clips.map((clip, i) => (
              <div key={clip.id} className="animate-fade-in opacity-0" style={{ animationDelay: `${i * 60}ms` }}>
                <ClipCard clip={clip} projectId={projectId} />
              </div>
            ))}
          </div>
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold mb-4 text-foreground/80 uppercase tracking-wider">Actions</h3>
            <div className="space-y-2.5">
              <Button
                onClick={handleAnalyze}
                disabled={clips.length === 0 || hasRunningJobs}
                className="w-full !from-blue-500 !to-blue-600 hover:!from-blue-400 hover:!to-blue-500 !shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(59,130,246,0.15)]"
              >
                Analyze Clips (AI)
              </Button>
              <Button
                onClick={handleGeneratePlan}
                disabled={hasRunningJobs}
                className="w-full !from-purple-500 !to-purple-600 hover:!from-purple-400 hover:!to-purple-500 !shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(168,85,247,0.15)]"
              >
                Generate Edit Plan
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/projects/${projectId}/narration`)}
                className="w-full"
              >
                Add Narration
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/projects/${projectId}/generate`)}
                className="w-full"
              >
                Generate Assets
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push(`/projects/${projectId}/export`)}
                className="w-full"
              >
                Export Video
              </Button>
            </div>
          </Card>

          {/* Highlights */}
          {highlights.length > 0 && (
            <Card padding="md">
              <h3 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">Top Highlights</h3>
              <div className="space-y-3">
                {highlights.slice(0, 5).map((h, i) => (
                  <HighlightCard key={i} highlight={h} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
