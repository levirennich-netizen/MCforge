"use client";

import { useState } from "react";
import { generateImage } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { ImageStyle } from "@/types/generate";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { SelectionCard } from "@/components/ui/SelectionCard";

const STYLES: { key: ImageStyle; label: string; description: string }[] = [
  { key: "minecraft", label: "Minecraft", description: "Blocky voxel game art" },
  { key: "thumbnail", label: "Thumbnail", description: "Eye-catching YouTube style" },
  { key: "overlay", label: "Overlay", description: "Stream overlay graphics" },
  { key: "pixel_art", label: "Pixel Art", description: "Retro 8-bit aesthetic" },
];

interface Props {
  projectId: string;
  loading: boolean;
  onSubmit: () => void;
}

export function ImageGeneratorForm({ projectId, loading, onSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<ImageStyle>("minecraft");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    try {
      await generateImage(projectId, prompt.trim(), style);
      toast.info("Generating image...");
      onSubmit();
    } catch {
      toast.error("Failed to start image generation");
    }
  };

  return (
    <div className="space-y-5">
      <Textarea
        label="Image Prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., Epic Minecraft castle at sunset with dragon flying overhead"
        rows={3}
      />

      <div>
        <label className="block text-sm font-medium mb-3">Style</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STYLES.map((s) => (
            <SelectionCard
              key={s.key}
              selected={style === s.key}
              onClick={() => setStyle(s.key)}
              label={s.label}
              description={s.description}
              className="text-center"
            />
          ))}
        </div>
      </div>

      <Button
        size="lg"
        loading={loading}
        onClick={handleGenerate}
        disabled={!prompt.trim() || loading}
        className="w-full !from-violet-500 !to-violet-600 hover:!from-violet-400 hover:!to-violet-500 !shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(139,92,246,0.15)]"
      >
        Generate Image
      </Button>
    </div>
  );
}
