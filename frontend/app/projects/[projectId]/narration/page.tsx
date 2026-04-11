"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getVoices, generateNarration } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import { useJobProgress } from "@/lib/sse";
import { toast, catchToast } from "@/lib/toast";
import type { Voice } from "@/types/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { SelectionCard } from "@/components/ui/SelectionCard";
import { JobProgressCard } from "@/components/ui/JobProgressCard";

export default function NarrationPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { activeJobs } = useProjectStore();

  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("rex");
  const [instructions, setInstructions] = useState("");
  const [mode, setMode] = useState("generate");

  useJobProgress(projectId);

  useEffect(() => {
    getVoices().then(setVoices).catch(catchToast("Failed to load voices"));
  }, []);

  const narrationJob = Object.values(activeJobs).find((j) => j.stage === "narrate");

  const handleGenerate = async () => {
    try {
      await generateNarration(projectId, selectedVoice, instructions);
      toast.info("Generating narration...");
    } catch {
      toast.error("Failed to start narration generation");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await fetch(`http://localhost:8000/projects/${projectId}/narration/upload`, {
        method: "POST",
        body: formData,
      });
      toast.success("Narration uploaded successfully");
    } catch {
      toast.error("Failed to upload narration");
    }
  };

  return (
    <PageContainer size="sm">
      <PageHeader title="Narration" backHref={`/projects/${projectId}`} />

      <Tabs
        tabs={[
          { key: "generate", label: "AI Generate" },
          { key: "upload", label: "Upload Your Own" },
        ]}
        activeKey={mode}
        onChange={setMode}
        className="mb-6"
      />

      {/* Progress */}
      {narrationJob?.status === "running" && (
        <div className="mb-6">
          <JobProgressCard
            stage={narrationJob.stage}
            status={narrationJob.status}
            progress={narrationJob.progress}
            message={narrationJob.message}
          />
        </div>
      )}

      {mode === "generate" ? (
        <div className="space-y-6">
          {/* Voice Picker */}
          <div>
            <label className="block text-sm font-medium mb-3">Voice</label>
            <div className="grid grid-cols-5 gap-2">
              {voices.map((v) => (
                <SelectionCard
                  key={v.id}
                  selected={selectedVoice === v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  label={v.name}
                  description={v.description}
                  className="text-center"
                />
              ))}
            </div>
          </div>

          <Textarea
            label="Custom Instructions (optional)"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g., Sound extra excited about the diamonds, mention the creeper jumpscare..."
            rows={3}
          />

          <Button
            size="lg"
            loading={narrationJob?.status === "running"}
            onClick={handleGenerate}
            className="w-full"
          >
            Generate AI Narration
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <Card padding="lg" className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-card-hover flex items-center justify-center">
              <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-muted mb-3">Upload your narration audio file</p>
            <input
              type="file"
              accept=".mp3,.wav,.ogg,.m4a"
              onChange={handleUpload}
              className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-card-hover file:text-foreground file:cursor-pointer hover:file:bg-muted/20"
            />
            <p className="text-xs text-muted mt-3">MP3, WAV, OGG, M4A supported</p>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
