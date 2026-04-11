"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listProjects, deleteProject } from "@/lib/api";
import type { Project } from "@/types/project";
import { formatDuration } from "@/lib/utils";
import { toast, catchToast } from "@/lib/toast";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonList } from "@/components/ui/Skeleton";

const STATUS_VARIANT: Record<string, "muted" | "info" | "warning" | "success" | "error"> = {
  created: "muted",
  uploading: "info",
  analyzing: "warning",
  planning: "warning",
  composing: "info",
  exported: "success",
};

const STYLE_LABELS: Record<string, string> = {
  funny: "Funny",
  high_energy: "High Energy",
  cinematic: "Cinematic",
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(catchToast("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget);
      setProjects((p) => p.filter((proj) => proj.id !== deleteTarget));
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
    setDeleteTarget(null);
  };

  return (
    <PageContainer size="md">
      <div className="text-center mb-12 pt-4">
        <h2 className="text-3xl font-bold tracking-tight mb-2">
          <span className="text-gradient">Your Projects</span>
        </h2>
        <p className="text-muted text-sm">AI-powered Minecraft video editing</p>
        <div className="mt-6">
          <Button size="lg" onClick={() => router.push("/projects/new")}>
            + New Project
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
          title="No projects yet"
          description="Create your first project to start editing Minecraft videos with AI"
          action={{ label: "Create Project", onClick: () => router.push("/projects/new") }}
        />
      ) : (
        <div className="grid gap-3">
          {projects.map((project, i) => (
            <Card
              key={project.id}
              hover
              padding="md"
              onClick={() => router.push(`/projects/${project.id}`)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="animate-fade-in opacity-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-foreground/90 group-hover:text-emerald-400 transition">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2.5 mt-2">
                    <Badge variant={STATUS_VARIANT[project.status] || "muted"}>
                      {project.status}
                    </Badge>
                    <span className="text-xs text-muted/70">
                      {STYLE_LABELS[project.style_preset] || project.style_preset}
                    </span>
                    {project.target_duration_seconds && (
                      <span className="text-xs text-muted/70">
                        {formatDuration(project.target_duration_seconds)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted/50">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(project.id); }}
                    className="text-muted/40 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Project"
        description="This will permanently delete this project and all its files. This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
      />
    </PageContainer>
  );
}
