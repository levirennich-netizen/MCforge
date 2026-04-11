export type StylePreset = "funny" | "high_energy" | "cinematic";
export type ProjectStatus = "created" | "uploading" | "analyzing" | "planning" | "composing" | "exported";

export interface Project {
  id: string;
  name: string;
  style_preset: StylePreset;
  status: ProjectStatus;
  target_duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClipMetadata {
  id: string;
  project_id: string;
  filename: string;
  file_path: string;
  duration_seconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  audio_channels: number;
  file_size_bytes: number;
  thumbnail_path: string;
  audio_path: string;
  sort_order: number;
  created_at: string;
}
