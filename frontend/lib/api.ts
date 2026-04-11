import type { Project, ClipMetadata, StylePreset } from "@/types/project";
import type { ChatMessage } from "@/types/chat";
import type { AnalysisResult, Highlight } from "@/types/analysis";
import type { EditPlan, EditSegment } from "@/types/timeline";
import type { Voice, ExportRecord } from "@/types/api";
import type { GeneratedAsset, ImageStyle, AnimatedIntroType, ColorScheme } from "@/types/generate";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class APIError extends Error {
  status: number;
  constructor(res: Response) {
    super(`API Error ${res.status}: ${res.statusText}`);
    this.status = res.status;
  }
}

// Retry wrapper for Render cold-start resilience
async function fetchWithRetry(url: string, opts?: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), i === 0 ? 15000 : 30000);
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      if (i === retries) throw err;
      // Wait before retry (backend might be waking up)
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Request failed");
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}${path}`);
  if (!res.ok) throw new APIError(res);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new APIError(res);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new APIError(res);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetchWithRetry(`${API_BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new APIError(res);
}

// Wake up backend on app load (Render free tier sleeps after 15min)
export function warmUpBackend() {
  fetch(`${API_BASE}/health`).catch(() => {});
}

// ── Projects ──────────────────────────────────────────────────────────────

export const createProject = (data: { name: string; style_preset: StylePreset; target_duration_seconds?: number }) =>
  post<Project>("/projects", data);

export const listProjects = () => get<Project[]>("/projects");

export const getProject = (id: string) => get<Project>(`/projects/${id}`);

export const deleteProject = (id: string) => del(`/projects/${id}`);

// ── Clips ─────────────────────────────────────────────────────────────────

export async function uploadClip(
  projectId: string,
  file: File,
  sortOrder: number = 0,
  onProgress?: (progress: number) => void,
): Promise<ClipMetadata> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("sort_order", sortOrder.toString());

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded / e.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.open("POST", `${API_BASE}/projects/${projectId}/clips`);
    xhr.send(formData);
  });
}

export const listClips = (projectId: string) =>
  get<ClipMetadata[]>(`/projects/${projectId}/clips`);

export const deleteClip = (projectId: string, clipId: string) =>
  del(`/projects/${projectId}/clips/${clipId}`);

export const getClipThumbnailUrl = (projectId: string, clipId: string) =>
  `${API_BASE}/projects/${projectId}/clips/${clipId}/thumbnail`;

// ── Analysis ──────────────────────────────────────────────────────────────

export const startAnalysis = (projectId: string) =>
  post<{ job_id: string }>(`/projects/${projectId}/analyze`);

export const getAnalysis = (projectId: string) =>
  get<AnalysisResult[]>(`/projects/${projectId}/analysis`);

export const getHighlights = (projectId: string) =>
  get<Highlight[]>(`/projects/${projectId}/highlights`);

// ── Timeline ──────────────────────────────────────────────────────────────

export const generatePlan = (projectId: string, stylePreset: string = "high_energy", targetDuration?: number) =>
  post<{ job_id: string }>(`/projects/${projectId}/plan`, {
    style_preset: stylePreset,
    target_duration_seconds: targetDuration,
  });

export const getPlan = (projectId: string) =>
  get<EditPlan>(`/projects/${projectId}/plan`);

export const updatePlan = (projectId: string, segments: EditSegment[]) =>
  put<EditPlan>(`/projects/${projectId}/plan`, { segments: segments.map(s => ({ ...s })) });

// ── Narration ─────────────────────────────────────────────────────────────

export const generateNarration = (projectId: string, voiceId: string = "rex", instructions: string = "") =>
  post<{ job_id: string }>(`/projects/${projectId}/narration/generate`, {
    voice_id: voiceId,
    custom_instructions: instructions,
  });

export const getVoices = () => get<Voice[]>("/tts/voices");

// ── Auto-Edit (one-click AI video) ────────────────────────────────────────

export const startAutoEdit = (projectId: string, style: string = "high_energy", quality: string = "1080p") =>
  post<{ job_id: string }>(`/projects/${projectId}/auto-edit`, { style, quality });

// ── Export ─────────────────────────────────────────────────────────────────

export const startExport = (projectId: string, quality: string = "1080p", opts?: {
  include_narration?: boolean;
  include_subtitles?: boolean;
  include_music?: boolean;
}) =>
  post<{ job_id: string }>(`/projects/${projectId}/export`, {
    quality,
    include_narration: opts?.include_narration ?? true,
    include_subtitles: opts?.include_subtitles ?? true,
    include_music: opts?.include_music ?? true,
  });

export const listExports = (projectId: string) =>
  get<ExportRecord[]>(`/projects/${projectId}/exports`);

export const getExportDownloadUrl = (projectId: string, exportId: string) =>
  `${API_BASE}/projects/${projectId}/export/${exportId}/download`;

// ── Progress (SSE) ────────────────────────────────────────────────────────

export function streamProgress(
  projectId: string,
  onEvent: (event: { job_id: string; status: string; progress: number; message: string; stage: string }) => void,
): EventSource {
  const es = new EventSource(`${API_BASE}/projects/${projectId}/progress`);

  const handler = (e: MessageEvent) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
  };

  es.addEventListener("progress", handler);
  es.addEventListener("completed", handler);
  es.addEventListener("failed", handler);

  return es;
}

// ── Chat ──────────────────────────────────────────────────────────────────

export const getChatMessages = (projectId: string) =>
  get<ChatMessage[]>(`/projects/${projectId}/chat/messages`);

export const clearChat = (projectId: string) =>
  del(`/projects/${projectId}/chat`);

export async function streamChatMessage(
  projectId: string,
  message: string,
  onToken: (token: string) => void,
  onDone: (content: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    onError(`API Error ${res.status}: ${res.statusText}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (currentEvent === "token") {
            onToken(parsed.token);
          } else if (currentEvent === "done") {
            onDone(parsed.content);
          } else if (currentEvent === "error") {
            onError(parsed.error);
          }
        } catch {}
      }
    }
  }
}

// ── Generate ──────────────────────────────────────────────────────────────

export const generateImage = (projectId: string, prompt: string, style: ImageStyle = "minecraft") =>
  post<{ job_id: string }>(`/projects/${projectId}/generate/image`, { prompt, style });

export const generateSfx = (projectId: string, prompt: string, voice_id: string = "rex", duration_hint: string = "short") =>
  post<{ job_id: string }>(`/projects/${projectId}/generate/sfx`, { prompt, voice_id, duration_hint });

export const generateIntro = (
  projectId: string,
  intro_type: AnimatedIntroType,
  title: string,
  subtitle: string = "",
  duration_seconds: number = 5,
  color_scheme: ColorScheme = "emerald",
) =>
  post<{ job_id: string }>(`/projects/${projectId}/generate/intro`, {
    intro_type, title, subtitle, duration_seconds, color_scheme,
  });

export const listGeneratedAssets = (projectId: string, assetType?: string) =>
  get<GeneratedAsset[]>(`/projects/${projectId}/generate/assets${assetType ? `?asset_type=${assetType}` : ""}`);

export const getGeneratedAssetFileUrl = (projectId: string, assetId: string) =>
  `${API_BASE}/projects/${projectId}/generate/assets/${assetId}/file`;

export const getGeneratedAssetThumbnailUrl = (projectId: string, assetId: string) =>
  `${API_BASE}/projects/${projectId}/generate/assets/${assetId}/thumbnail`;

export const deleteGeneratedAsset = (projectId: string, assetId: string) =>
  del(`/projects/${projectId}/generate/assets/${assetId}`);
