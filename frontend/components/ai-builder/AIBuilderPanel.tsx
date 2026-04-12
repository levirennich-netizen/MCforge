"use client";

import { useState, useEffect, useCallback } from "react";
import { generateVideoPair, clipFromGenerated, listGeneratedAssets, getGeneratedAssetFileUrl, getGeneratedAssetThumbnailUrl } from "@/lib/api";
import { useJobProgress } from "@/lib/sse";
import { useProjectStore } from "@/stores/project-store";
import { toast } from "@/lib/toast";
import type { GeneratedAsset } from "@/types/generate";
import type { ClipMetadata } from "@/types/project";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Phase = "prompt" | "generating" | "voting" | "deciding" | "finishing";

const MODELS = [
  { value: "seedance", label: "Seedance", desc: "Best quality" },
  { value: "wan-fast", label: "Wan Fast", desc: "Fast" },
  { value: "wan", label: "Wan", desc: "Balanced" },
];

interface Props {
  projectId: string;
  onDone: (clips: ClipMetadata[]) => void;
  onCancel: () => void;
}

export function AIBuilderPanel({ projectId, onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance");
  const [duration, setDuration] = useState(5);

  const [pairOptions, setPairOptions] = useState<GeneratedAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<GeneratedAsset[]>([]);

  const { activeJobs } = useProjectStore();
  useJobProgress(projectId);

  const pairJob = Object.values(activeJobs).find((j) => j.stage === "generate_video_pair");

  // When pair generation completes, fetch the 2 newest video assets
  useEffect(() => {
    if (pairJob?.status === "completed" && phase === "generating") {
      listGeneratedAssets(projectId, "video").then((assets) => {
        // Get the 2 most recent
        const sorted = [...assets].sort((a, b) => b.created_at.localeCompare(a.created_at));
        setPairOptions(sorted.slice(0, 2));
        setPhase("voting");
      }).catch(() => toast.error("Failed to load generated videos"));
    }
    if (pairJob?.status === "failed") {
      toast.error("Video generation failed");
      setPhase("prompt");
    }
  }, [pairJob?.status, phase, projectId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    try {
      await generateVideoPair(projectId, prompt.trim(), model, duration);
      setPhase("generating");
      toast.info("Generating 2 options...");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start generation";
      toast.error(msg);
    }
  };

  const handlePick = (asset: GeneratedAsset) => {
    setSelectedAssets((prev) => [...prev, asset]);
    setPairOptions([]);
    setPhase("deciding");
  };

  const handleAddMore = () => {
    setPhase("prompt");
  };

  const handleFinish = useCallback(async () => {
    setPhase("finishing");
    try {
      const clips: ClipMetadata[] = [];
      for (const asset of selectedAssets) {
        const clip = await clipFromGenerated(projectId, asset.id);
        clips.push(clip);
      }
      toast.success(`Added ${clips.length} AI clip${clips.length > 1 ? "s" : ""}!`);
      onDone(clips);
    } catch {
      toast.error("Failed to convert clips");
      setPhase("deciding");
    }
  }, [selectedAssets, projectId, onDone]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground/80">
          Completely with AI
          {selectedAssets.length > 0 && (
            <span className="ml-2 text-sm text-emerald-400 font-normal">
              {selectedAssets.length} clip{selectedAssets.length > 1 ? "s" : ""} selected
            </span>
          )}
        </h3>
        <button
          onClick={onCancel}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Back to Upload
        </button>
      </div>

      {/* Selected clips preview */}
      {selectedAssets.length > 0 && phase !== "finishing" && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {selectedAssets.map((asset, i) => (
            <div key={asset.id} className="shrink-0 w-28">
              <div className="aspect-video rounded-lg overflow-hidden bg-black border border-white/10">
                <video
                  src={getGeneratedAssetFileUrl(projectId, asset.id)}
                  poster={getGeneratedAssetThumbnailUrl(projectId, asset.id)}
                  className="w-full h-full object-cover"
                  muted
                />
              </div>
              <p className="text-[10px] text-muted mt-1 truncate">Clip {i + 1}</p>
            </div>
          ))}
        </div>
      )}

      {/* Phase: Prompt */}
      {phase === "prompt" && (
        <Card padding="md" className="!border-purple-500/30 !bg-purple-500/5 space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='Describe the scene... e.g. "Steve exploring a dark cave with torch, finding diamonds"'
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-purple-500/50 resize-none"
          />

          <div className="flex gap-2">
            {MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  model === m.value
                    ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                    : "bg-white/5 border border-white/10 text-muted hover:border-white/20"
                }`}
              >
                <div>{m.label}</div>
                <div className="text-[10px] opacity-60">{m.desc}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {[5, 10].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  duration === d
                    ? "bg-purple-500/20 border border-purple-500/50 text-purple-300"
                    : "bg-white/5 border border-white/10 text-muted hover:border-white/20"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>

          <Button
            onClick={handleGenerate}
            size="lg"
            className="w-full !from-purple-500 !to-violet-600 hover:!from-purple-400 hover:!to-violet-500 !shadow-[0_4px_16px_rgba(0,0,0,0.4),0_0_30px_rgba(139,92,246,0.3)]"
          >
            Generate 2 Options
          </Button>
        </Card>
      )}

      {/* Phase: Generating */}
      {phase === "generating" && (
        <Card padding="md" className="!border-purple-500/30 !bg-purple-500/5">
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-sm text-foreground/80">
              {pairJob?.message || "Generating 2 video options..."}
            </p>
            <ProgressBar
              progress={pairJob?.progress || 0}
              size="sm"
              className="max-w-xs mx-auto"
            />
            <p className="text-xs text-muted">This may take a few minutes</p>
          </div>
        </Card>
      )}

      {/* Phase: Voting — pick one of 2 */}
      {phase === "voting" && pairOptions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-center text-foreground/70">Pick the one you like better</p>
          <div className="grid grid-cols-2 gap-3">
            {pairOptions.map((asset, i) => (
              <Card
                key={asset.id}
                padding="none"
                hover
                className="!border-white/10 hover:!border-purple-500/50 group overflow-hidden"
                onClick={() => handlePick(asset)}
              >
                <div className="aspect-video bg-black relative">
                  <video
                    controls
                    className="w-full h-full"
                    src={getGeneratedAssetFileUrl(projectId, asset.id)}
                    poster={getGeneratedAssetThumbnailUrl(projectId, asset.id)}
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-xs text-white/70 font-medium">
                    {i === 0 ? "A" : "B"}
                  </span>
                </div>
                <div className="p-3">
                  <Button
                    size="sm"
                    className="w-full !from-purple-500 !to-violet-600 hover:!from-purple-400 hover:!to-violet-500"
                  >
                    Pick This One
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Phase: Deciding — add more or finish */}
      {phase === "deciding" && (
        <Card padding="md" className="!border-emerald-500/30 !bg-emerald-500/5">
          <div className="text-center space-y-4 py-2">
            <p className="text-sm text-foreground/80">
              Great pick! Add more frames or finish?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleAddMore}
                size="lg"
                className="flex-1 !from-purple-500 !to-violet-600 hover:!from-purple-400 hover:!to-violet-500"
              >
                Add More Frames
              </Button>
              <Button
                onClick={handleFinish}
                size="lg"
                className="flex-1 !from-emerald-500 !to-green-600 hover:!from-emerald-400 hover:!to-green-500"
              >
                Good — Use These
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Phase: Finishing — converting to clips */}
      {phase === "finishing" && (
        <Card padding="md" className="!border-emerald-500/30 !bg-emerald-500/5">
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-sm text-foreground/80">
              Converting {selectedAssets.length} video{selectedAssets.length > 1 ? "s" : ""} into clips...
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
