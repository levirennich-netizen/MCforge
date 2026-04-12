"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject, listClips, uploadClip, startAnalysis, getAnalysis, generatePlan, getHighlights, startAutoEdit, listExports, getExportDownloadUrl } from "@/lib/api";
import type { ExportRecord } from "@/types/api";
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
import { AIBuilderPanel } from "@/components/ai-builder/AIBuilderPanel";

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
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [aiMode, setAiMode] = useState(false);

  useJobProgress(projectId);

  useEffect(() => {
    getProject(projectId).then(setProject).catch(() => { toast.error("Project not found"); router.push("/"); });
    listClips(projectId).then(setClips).catch(catchToast("Failed to load clips"));
    getAnalysis(projectId).then(setAnalyses).catch(() => {});
    getHighlights(projectId).then(setHighlights).catch(() => {});
    listExports(projectId).then(setExports).catch(() => {});
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(`${file.name}: ${msg}`);
      }
    }
    setUploading(false);
    setUploadProgress(0);
  }, [projectId, clips.length, addClip]);

  const handleAnalyze = async () => {
    try {
      await startAnalysis(projectId);
      toast.info("Analysis started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start analysis");
    }
  };

  const handleGeneratePlan = async () => {
    try {
      await generatePlan(projectId, project?.style_preset || "high_energy");
      toast.info("Generating edit plan...");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start plan generation";
      toast.error(msg);
    }
  };

  const handleAutoEdit = async () => {
    try {
      await startAutoEdit(projectId, project?.style_preset || "high_energy", "1080p", videoPrompt);
      toast.info("AI is making your video...");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start auto-edit");
    }
  };

  // Refresh exports when auto_edit job completes
  const autoEditJob = Object.values(activeJobs).find((j) => j.stage === "auto_edit");
  useEffect(() => {
    if (autoEditJob?.status === "completed") {
      listExports(projectId).then(setExports).catch(() => {});
      toast.success("Your video is ready!");
    }
  }, [autoEditJob?.status, projectId]);

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
        {/* Upload / AI Builder Section */}
        <div className="lg:col-span-2">
          {/* Video Player — shows latest export */}
          {exports.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-3 text-foreground/80">
                Your Video
              </h3>
              <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-black">
                <video
                  key={exports[0].id}
                  controls
                  className="w-full"
                  src={getExportDownloadUrl(projectId, exports[0].id)}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted">{exports[0].quality.toUpperCase()}</span>
                <a
                  href={getExportDownloadUrl(projectId, exports[0].id)}
                  download
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
          )}

          {aiMode ? (
            <AIBuilderPanel
              projectId={projectId}
              onDone={(newClips) => {
                for (const c of newClips) addClip(c);
                setAiMode(false);
              }}
              onCancel={() => setAiMode(false)}
            />
          ) : (
            <>
              {/* Completely with AI button */}
              <button
                onClick={() => setAiMode(true)}
                className="w-full mb-4 px-4 py-3 rounded-xl border border-dashed border-purple-500/30 bg-purple-500/[0.04] hover:bg-purple-500/[0.08] hover:border-purple-500/50 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-purple-300">Completely with AI</p>
                    <p className="text-xs text-muted/60">No footage needed — AI generates everything</p>
                  </div>
                </div>
              </button>

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
            </>
          )}
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          {/* Big Generate Video button + prompt */}
          <Card padding="md" className="!border-emerald-500/30 !bg-emerald-500/5">
            <textarea
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="Describe your video... e.g. &quot;Epic Minecraft montage with fast cuts and dramatic moments&quot;"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-500/50 resize-none mb-3"
            />
            <Button
              onClick={handleAutoEdit}
              disabled={clips.length === 0 || hasRunningJobs}
              size="lg"
              className="w-full !text-xl !py-5 !from-emerald-500 !to-green-600 hover:!from-emerald-400 hover:!to-green-500 !shadow-[0_4px_16px_rgba(0,0,0,0.4),0_0_30px_rgba(16,185,129,0.3)]"
            >
              {hasRunningJobs ? "Working..." : "Generate Video"}
            </Button>
            <p className="text-xs text-muted text-center mt-2">
              AI analyzes, edits, and exports your video
            </p>
          </Card>

          {/* Downloads */}
          {exports.length > 0 && (
            <Card padding="md">
              <h3 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">Your Videos</h3>
              <div className="space-y-2">
                {exports.map((exp) => (
                  <a
                    key={exp.id}
                    href={getExportDownloadUrl(projectId, exp.id)}
                    download
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm">{exp.quality.toUpperCase()}</span>
                    <span className="text-xs text-emerald-400">Download</span>
                  </a>
                ))}
              </div>
            </Card>
          )}

          <Card padding="md">
            <h3 className="text-sm font-semibold mb-4 text-foreground/80 uppercase tracking-wider">Advanced</h3>
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
