"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { listGeneratedAssets } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import { useJobProgress } from "@/lib/sse";
import { catchToast } from "@/lib/toast";
import type { GeneratedAsset, GenerateAssetType } from "@/types/generate";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { JobProgressCard } from "@/components/ui/JobProgressCard";
import { ImageGeneratorForm } from "@/components/generate/ImageGeneratorForm";
import { SfxGeneratorForm } from "@/components/generate/SfxGeneratorForm";
import { IntroGeneratorForm } from "@/components/generate/IntroGeneratorForm";
import { VideoGeneratorForm } from "@/components/generate/VideoGeneratorForm";
import { AssetGrid } from "@/components/generate/AssetGrid";
import { WaitingScreen } from "@/components/ui/WaitingScreen";

const TABS = [
  { key: "video", label: "Videos" },
  { key: "image", label: "Images" },
  { key: "sfx", label: "Sound Effects" },
  { key: "animated_intro", label: "Animated Intros" },
];

const ASSET_TYPE_FOR_TAB: Record<string, GenerateAssetType> = {
  video: "video",
  image: "image",
  sfx: "sfx",
  animated_intro: "animated_intro",
};

const JOB_STAGE_FOR_TAB: Record<string, string> = {
  video: "generate_video",
  image: "generate_image",
  sfx: "generate_sfx",
  animated_intro: "generate_intro",
};

export default function GeneratePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { activeJobs } = useProjectStore();

  const [activeTab, setActiveTab] = useState("video");
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [waitingForGame, setWaitingForGame] = useState(false);

  useJobProgress(projectId);

  const loadAssets = useCallback(() => {
    listGeneratedAssets(projectId)
      .then(setAssets)
      .catch(catchToast("Failed to load assets"));
  }, [projectId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Reload when a generate job completes
  const jobEntries = Object.entries(activeJobs);
  const generateJobs = jobEntries.filter(([, j]) =>
    ["generate_video", "generate_image", "generate_sfx", "generate_intro"].includes(j.stage)
  );

  useEffect(() => {
    const completed = generateJobs.some(([, j]) => j.status === "completed");
    if (completed) {
      loadAssets();
      setWaitingForGame(false);
    }
    const failed = generateJobs.some(([, j]) => j.status === "failed");
    if (failed) setWaitingForGame(false);
  }, [generateJobs.map(([, j]) => j.status).join(",")]);

  const currentJobStage = JOB_STAGE_FOR_TAB[activeTab];
  const activeGenJob = generateJobs.find(([, j]) => j.stage === currentJobStage && j.status === "running");
  const isLoading = !!activeGenJob;

  // Filter assets by active tab
  const filteredAssets = assets.filter((a) => a.asset_type === ASSET_TYPE_FOR_TAB[activeTab]);

  return (
    <PageContainer size="sm">
      <PageHeader title="Generate Assets" backHref={`/projects/${projectId}`} />

      <Tabs
        tabs={TABS}
        activeKey={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {/* Running job progress */}
      {generateJobs
        .filter(([, j]) => j.status === "running")
        .map(([jobId, job]) => (
          <div key={jobId} className="mb-4">
            <JobProgressCard
              stage={job.stage}
              status={job.status}
              progress={job.progress}
              message={job.message}
            />
          </div>
        ))}

      {/* Generator Form */}
      <div className="mb-8">
        {activeTab === "video" && (
          <VideoGeneratorForm projectId={projectId} loading={isLoading} onSubmit={() => setWaitingForGame(true)} />
        )}
        {activeTab === "image" && (
          <ImageGeneratorForm projectId={projectId} loading={isLoading} onSubmit={() => setWaitingForGame(true)} />
        )}
        {activeTab === "sfx" && (
          <SfxGeneratorForm projectId={projectId} loading={isLoading} onSubmit={() => setWaitingForGame(true)} />
        )}
        {activeTab === "animated_intro" && (
          <IntroGeneratorForm projectId={projectId} loading={isLoading} onSubmit={() => setWaitingForGame(true)} />
        )}
      </div>

      {/* MineRunner loading section */}
      {(isLoading || waitingForGame) && (
        <WaitingScreen
          startedAt={activeGenJob ? activeGenJob[1]?.startedAt : Date.now()}
          onDismiss={() => setWaitingForGame(false)}
        />
      )}

      {/* Asset Grid */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">
          Generated {TABS.find((t) => t.key === activeTab)?.label}
          <span className="text-muted/50 font-normal ml-1">({filteredAssets.length})</span>
        </h3>
        <AssetGrid projectId={projectId} assets={filteredAssets} onDeleted={loadAssets} />
      </div>
    </PageContainer>
  );
}
