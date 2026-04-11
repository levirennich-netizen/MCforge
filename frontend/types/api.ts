export interface JobProgress {
  job_id: string;
  project_id: string;
  status: "running" | "completed" | "failed";
  progress: number;
  message: string;
  stage: string;
}

export interface Voice {
  id: string;
  name: string;
  description: string;
}

export interface ExportRecord {
  id: string;
  project_id: string;
  quality: string;
  output_path: string;
  file_size_bytes: number;
  duration_seconds: number;
  status: string;
  created_at: string;
}
