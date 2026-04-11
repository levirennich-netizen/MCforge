"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listProjects, deleteProject, warmUpBackend } from "@/lib/api";
import type { Project } from "@/types/project";
import { formatDuration } from "@/lib/utils";
import { toast, catchToast } from "@/lib/toast";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MineRunner } from "@/components/ui/MineRunner";

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

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
      </svg>
    ),
    title: "AI Analysis",
    desc: "Auto-detects highlights, kills, builds & epic moments",
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    ),
    title: "AI Image Gen",
    desc: "Generate thumbnails, overlays & pixel art instantly",
    color: "from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    title: "Animated Intros",
    desc: "Title cards, lower thirds & end screens in one click",
    color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-400",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    title: "Smart Timeline",
    desc: "AI builds your edit plan — you just tweak & export",
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400",
  },
];

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    warmUpBackend();
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
      {/* Hero Section */}
      <div className="relative text-center pt-8 pb-12 mb-8">
        {/* Animated background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-emerald-500/[0.07] rounded-full blur-[100px] animate-float-slow" />
          <div className="absolute top-8 right-1/4 w-48 h-48 bg-blue-500/[0.06] rounded-full blur-[80px] animate-float-slower" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-violet-500/[0.04] rounded-full blur-[100px]" />
        </div>

        <div className="relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] mb-6 animate-fade-in opacity-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium tracking-wide">AI-POWERED</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4 animate-fade-in opacity-0" style={{ animationDelay: "100ms" }}>
            <span className="text-gradient">MC</span>
            <span className="text-foreground">Forge</span>
          </h1>

          <p className="text-lg text-muted max-w-md mx-auto mb-8 animate-fade-in opacity-0" style={{ animationDelay: "200ms" }}>
            Turn raw Minecraft footage into<br />
            <span className="text-foreground font-medium">fire content</span> with AI
          </p>

          <div className="flex items-center justify-center gap-3 animate-fade-in opacity-0" style={{ animationDelay: "300ms" }}>
            <Button size="lg" onClick={() => router.push("/projects/new")} className="px-8">
              + New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="animate-fade-in opacity-0"
            style={{ animationDelay: `${400 + i * 80}ms` }}
          >
            <div className={`rounded-xl border p-4 bg-gradient-to-br ${f.color} transition-all duration-300 hover:scale-[1.03] hover:shadow-lg`}>
              <div className="mb-3">{f.icon}</div>
              <h3 className="text-sm font-bold mb-1">{f.title}</h3>
              <p className="text-[11px] text-muted leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Projects Section */}
      <div className="animate-fade-in opacity-0" style={{ animationDelay: "700ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight">
            Your Projects
            {!loading && projects.length > 0 && (
              <span className="text-muted/40 font-normal ml-2 text-sm">({projects.length})</span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            <p className="text-xs text-muted/60 text-center">Waking up server... play while you wait!</p>
            <MineRunner />
          </div>
        ) : projects.length === 0 ? (
          <Card padding="lg" className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-foreground/80 font-medium mb-1">No projects yet</p>
            <p className="text-sm text-muted mb-5">Drop your clips and let AI do the editing</p>
            <Button onClick={() => router.push("/projects/new")}>
              Create Your First Project
            </Button>
          </Card>
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
      </div>

      {/* Footer */}
      <div className="text-center py-8 mt-8 border-t border-white/[0.04]">
        <p className="text-xs text-muted/40">Built with AI. Made for Minecraft creators.</p>
      </div>

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
