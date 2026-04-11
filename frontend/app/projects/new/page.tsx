"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { StylePreset } from "@/types/project";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SelectionCard } from "@/components/ui/SelectionCard";
import { Button } from "@/components/ui/Button";

const STYLES: { value: StylePreset; label: string; desc: string }[] = [
  { value: "funny", label: "Funny", desc: "Jump cuts, meme SFX, zoom-ins, fast pace" },
  { value: "high_energy", label: "High Energy", desc: "Rapid cuts, bass drops, intense transitions" },
  { value: "cinematic", label: "Cinematic", desc: "Smooth crossfades, ambient music, clean feel" },
];

export default function NewProject() {
  const [name, setName] = useState("");
  const [style, setStyle] = useState<StylePreset>("high_energy");
  const [duration, setDuration] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const project = await createProject({
        name: name.trim(),
        style_preset: style,
        target_duration_seconds: duration ? parseFloat(duration) * 60 : undefined,
      });
      router.push(`/projects/${project.id}`);
    } catch {
      toast.error("Failed to create project. Is the backend running?");
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageContainer size="sm">
      <div className="text-center mb-10 pt-4">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Create New Project</h2>
        <p className="text-sm text-muted">Set up your Minecraft video edit</p>
      </div>

      <Card padding="lg" className="space-y-8">
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Epic Survival Episode 12"
        />

        <div>
          <label className="block text-sm font-medium mb-3 text-foreground/80">Editing Style</label>
          <div className="grid grid-cols-3 gap-3">
            {STYLES.map((s) => (
              <SelectionCard
                key={s.value}
                selected={style === s.value}
                onClick={() => setStyle(s.value)}
                label={s.label}
                description={s.desc}
              />
            ))}
          </div>
        </div>

        <Input
          label="Target Duration (minutes, optional)"
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Leave empty for auto (3-8 min)"
          min={1}
          max={60}
        />

        <Button
          size="lg"
          loading={creating}
          disabled={!name.trim()}
          onClick={handleCreate}
          className="w-full"
        >
          Create Project
        </Button>
      </Card>
    </PageContainer>
  );
}
