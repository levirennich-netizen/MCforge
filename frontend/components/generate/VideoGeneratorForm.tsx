"use client";

import { useState } from "react";
import { generateVideo } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { SelectionCard } from "@/components/ui/SelectionCard";

const MODELS: { key: string; label: string; description: string }[] = [
  { key: "seedance", label: "Seedance", description: "Best quality, slower" },
  { key: "wan-fast", label: "Wan Fast", description: "Fast generation" },
  { key: "wan", label: "Wan", description: "Balanced quality" },
  { key: "veo", label: "Veo", description: "Google model (alpha)" },
  { key: "ltx-2", label: "LTX-2", description: "Lightweight model" },
];

const DURATIONS: { key: number; label: string }[] = [
  { key: 5, label: "5s" },
  { key: 10, label: "10s" },
];

interface Props {
  projectId: string;
  loading: boolean;
  onSubmit: () => void;
}

export function VideoGeneratorForm({ projectId, loading, onSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance");
  const [duration, setDuration] = useState(5);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    try {
      await generateVideo(projectId, prompt.trim(), model, duration);
      toast.info("Generating video...");
      onSubmit();
    } catch {
      toast.error("Failed to start video generation");
    }
  };

  return (
    <div className="space-y-5">
      <Textarea
        label="Video Prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., Minecraft Steve building a castle in a cherry blossom biome at sunset"
        rows={3}
      />

      <div>
        <label className="block text-sm font-medium mb-3">Model</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {MODELS.map((m) => (
            <SelectionCard
              key={m.key}
              selected={model === m.key}
              onClick={() => setModel(m.key)}
              label={m.label}
              description={m.description}
              className="text-center"
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-3">Duration</label>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <SelectionCard
              key={d.key}
              selected={duration === d.key}
              onClick={() => setDuration(d.key)}
              label={d.label}
              description=""
              className="text-center px-6"
            />
          ))}
        </div>
      </div>

      <Button
        size="lg"
        loading={loading}
        onClick={handleGenerate}
        disabled={!prompt.trim() || loading}
        className="w-full !from-emerald-500 !to-green-600 hover:!from-emerald-400 hover:!to-green-500 !shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(16,185,129,0.15)]"
      >
        Generate Video
      </Button>
    </div>
  );
}
