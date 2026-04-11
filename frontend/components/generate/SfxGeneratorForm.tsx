"use client";

import { useState } from "react";
import { generateSfx } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SelectionCard } from "@/components/ui/SelectionCard";

const PRESETS = [
  "Creeper explosion",
  "Enchantment magic sparkle",
  "Sword clash clang",
  "Portal whoosh",
  "Level up fanfare",
  "Zombie groan",
  "Arrow swoosh & hit",
  "TNT fuse sizzle",
];

const VOICES = [
  { id: "rex", label: "Rex" },
  { id: "eve", label: "Eve" },
  { id: "sal", label: "Sal" },
];

const DURATIONS = [
  { key: "short", label: "Short", description: "1-3 sec" },
  { key: "medium", label: "Medium", description: "3-6 sec" },
  { key: "long", label: "Long", description: "6-12 sec" },
];

interface Props {
  projectId: string;
  loading: boolean;
  onSubmit: () => void;
}

export function SfxGeneratorForm({ projectId, loading, onSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const [voice, setVoice] = useState("rex");
  const [duration, setDuration] = useState("short");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe the sound effect first");
      return;
    }
    try {
      await generateSfx(projectId, prompt.trim(), voice, duration);
      toast.info("Generating sound effect...");
      onSubmit();
    } catch {
      toast.error("Failed to start SFX generation");
    }
  };

  return (
    <div className="space-y-5">
      <Input
        label="Sound Effect Description"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g., Creeper hissing then exploding"
      />

      {/* Quick presets */}
      <div>
        <label className="block text-sm font-medium mb-2">Quick Presets</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPrompt(p)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                prompt === p
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-white/[0.03] text-muted border border-white/[0.06] hover:border-white/[0.12] hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Voice picker */}
      <div>
        <label className="block text-sm font-medium mb-2">Voice</label>
        <div className="grid grid-cols-3 gap-2">
          {VOICES.map((v) => (
            <SelectionCard
              key={v.id}
              selected={voice === v.id}
              onClick={() => setVoice(v.id)}
              label={v.label}
              className="text-center"
            />
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium mb-2">Duration</label>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <SelectionCard
              key={d.key}
              selected={duration === d.key}
              onClick={() => setDuration(d.key)}
              label={d.label}
              description={d.description}
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
        className="w-full !from-amber-500 !to-amber-600 hover:!from-amber-400 hover:!to-amber-500 !shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(245,158,11,0.15)]"
      >
        Generate Sound Effect
      </Button>
    </div>
  );
}
