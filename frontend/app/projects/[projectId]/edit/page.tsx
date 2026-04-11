"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPlan, updatePlan, generatePlan } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import { useJobProgress } from "@/lib/sse";
import { formatDuration } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { EditSegment } from "@/types/timeline";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { JobProgressCard } from "@/components/ui/JobProgressCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentProperties } from "@/components/timeline/SegmentProperties";
import { TimelineTrack } from "@/components/timeline/TimelineTrack";

export default function EditPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { editPlan, activeJobs, setEditPlan } = useProjectStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useJobProgress(projectId);

  useEffect(() => {
    getPlan(projectId).then(setEditPlan).catch(() => {});
  }, [projectId]);

  const planJob = Object.values(activeJobs).find((j) => j.stage === "plan");
  useEffect(() => {
    if (planJob?.status === "completed") {
      getPlan(projectId).then(setEditPlan).catch(() => {});
    }
  }, [planJob?.status]);

  const selectedSegment = editPlan?.segments.find((s) => s.segment_id === selectedId);

  const handleSegmentUpdate = (segId: string, updates: Partial<EditSegment>) => {
    if (!editPlan) return;
    const newSegments = editPlan.segments.map((s) =>
      s.segment_id === segId ? { ...s, ...updates } : s,
    );
    setEditPlan({ ...editPlan, segments: newSegments, is_user_modified: true });
  };

  const handleDeleteSegment = (segId: string) => {
    if (!editPlan) return;
    const newSegments = editPlan.segments.filter((s) => s.segment_id !== segId);
    setEditPlan({ ...editPlan, segments: newSegments, is_user_modified: true });
    if (selectedId === segId) setSelectedId(null);
  };

  const handleSave = async () => {
    if (!editPlan) return;
    setSaving(true);
    try {
      const updated = await updatePlan(projectId, editPlan.segments);
      setEditPlan(updated);
      toast.success("Timeline saved");
    } catch {
      toast.error("Failed to save timeline changes");
    }
    setSaving(false);
  };

  const handleRegenerate = async () => {
    try {
      await generatePlan(projectId);
      toast.info("Regenerating edit plan...");
    } catch {
      toast.error("Failed to regenerate plan");
    }
  };

  if (!editPlan) {
    return (
      <PageContainer size="lg">
        <PageHeader title="Timeline Editor" backHref={`/projects/${projectId}`} />
        {planJob?.status === "running" ? (
          <JobProgressCard
            stage={planJob.stage}
            status={planJob.status}
            progress={planJob.progress}
            message={planJob.message}
          />
        ) : (
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4V2m0 2a2 2 0 012 2v12a2 2 0 01-2 2 2 2 0 01-2-2V6a2 2 0 012-2zm10 0V2m0 2a2 2 0 012 2v12a2 2 0 01-2 2 2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            }
            title="No edit plan yet"
            description="Generate an AI edit plan from your analyzed clips"
            action={{ label: "Go Back & Generate Plan", onClick: () => router.push(`/projects/${projectId}`) }}
          />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer size="xl">
      <PageHeader
        title="Timeline Editor"
        subtitle={`${editPlan.segments.length} segments | ${formatDuration(editPlan.total_duration)} total${editPlan.is_user_modified ? " | Modified" : ""}`}
        backHref={`/projects/${projectId}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleRegenerate} className="bg-purple-600 hover:bg-purple-700 border-none text-white">
              Regenerate
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              Save Changes
            </Button>
          </>
        }
      />

      {/* AI Reasoning */}
      {editPlan.reasoning && (
        <Card padding="sm" className="mb-6">
          <p className="text-xs text-muted mb-1">AI Reasoning</p>
          <p className="text-sm">{editPlan.reasoning}</p>
        </Card>
      )}

      <div className="flex gap-6">
        {/* Timeline */}
        <div className="flex-1 overflow-x-auto">
          <TimelineTrack
            segments={editPlan.segments}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDeleteSegment}
          />
        </div>

        {/* Properties Panel */}
        <div className="w-72 shrink-0">
          {selectedSegment ? (
            <SegmentProperties
              segment={selectedSegment}
              onUpdate={(updates) => handleSegmentUpdate(selectedSegment.segment_id, updates)}
            />
          ) : (
            <Card padding="md" className="text-center text-muted text-sm">
              Select a segment to edit
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
