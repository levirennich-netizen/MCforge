"use client";

import { useState } from "react";
import { generateIntro } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { AnimatedIntroType, ColorScheme } from "@/types/generate";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Slider } from "@/components/ui/Slider";
import { SelectionCard } from "@/components/ui/SelectionCard";

const INTRO_TYPES: { key: AnimatedIntroType; label: string; description: string }[] = [
  { key: "title_card", label: "Title Card", description: "Full-screen centered title" },
  { key: "lower_third", label: "Lower Third", description: "Bottom bar name tag" },
  { key: "end_screen", label: "End Screen", description: "Outro with subscribe CTA" },
];

const COLOR_SCHEMES: { key: ColorScheme; label: string; color: string }[] = [
  { key: "emerald", label: "Emerald", color: "bg-emerald-500" },
  { key: "gold", label: "Gold", color: "bg-amber-500" },
  { key: "crimson", label: "Crimson", color: "bg-red-500" },
  { key: "diamond", label: "Diamond", color: "bg-cyan-500" },
];

interface Props {
  projectId: string;
  loading: boolean;
  onSubmit: () => void;
}

export function IntroGeneratorForm({ projectId, loading, onSubmit }: Props) {
  const [introType, setIntroType] = useState<AnimatedIntroType>("title_card");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [duration, setDuration] = useState(5);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("emerald");

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error("Enter a title first");
      return;
    }
    try {
      await generateIntro(projectId, introType, title.trim(), subtitle.trim(), duration, colorScheme);
      toast.info("Generating animated intro...");
      onSubmit();
    } catch {
      toast.error("Failed to start intro generation");
    }
  };

  return (
    <div className="space-y-5">
      {/* Type picker */}
      <div>
        <label className="block text-sm font-medium mb-3">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {INTRO_TYPES.map((t) => (
            <SelectionCard
              key={t.key}
              selected={introType === t.key}
              onClick={() => setIntroType(t.key)}
              label={t.label}
              description={t.description}
              className="text-center"
            />
          ))}
        </div>
      </div>

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g., Epic Survival Series"
      />

      <Input
        label="Subtitle (optional)"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        placeholder="e.g., Episode 1 - The Beginning"
      />

      <Slider
        label="Duration"
        value={duration}
        onChange={setDuration}
        min={3}
        max={15}
        step={1}
        formatValue={(v) => `${v}s`}
      />

      {/* Color scheme */}
      <div>
        <label className="block text-sm font-medium mb-3">Color Scheme</label>
        <div className="grid grid-cols-4 gap-2">
          {COLOR_SCHEMES.map((c) => (
            <button
              key={c.key}
              onClick={() => setColorScheme(c.key)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
                colorScheme === c.key
                  ? "border-emerald-500/40 bg-emerald-500/[0.08] ring-1 ring-emerald-500/20"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
              }`}
            >
              <span className={`w-4 h-4 rounded-full ${c.color}`} />
              <span className="text-xs font-medium">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Button
        size="lg"
        loading={loading}
        onClick={handleGenerate}
        disabled={!title.trim() || loading}
        className="w-full !from-cyan-500 !to-cyan-600 hover:!from-cyan-400 hover:!to-cyan-500 !shadow-[0_1px_2px_rgba(0,0,0,0.3),0_0_12px_rgba(6,182,212,0.15)]"
      >
        Generate Animated Intro
      </Button>
    </div>
  );
}
