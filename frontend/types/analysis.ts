export interface SceneSegment {
  start_time: number;
  end_time: number;
  start_frame: number;
  end_frame: number;
}

export interface MotionScore {
  timestamp: number;
  score: number;
}

export interface FrameAnalysis {
  timestamp: number;
  categories: string[];
  excitement: number;
  description: string;
  frame_path: string;
}

export interface VideoAnalysis {
  clip_id: string;
  scenes: SceneSegment[];
  motion_scores: MotionScore[];
  frame_analyses: FrameAnalysis[];
  avg_excitement: number;
  highlight_timestamps: number[];
}

export interface SilenceSegment {
  start: number;
  end: number;
}

export interface AudioAnalysis {
  clip_id: string;
  silence_segments: SilenceSegment[];
  transcription: { language: string; words: { word: string; start: number; end: number }[] } | null;
  game_events: { timestamp: number; event_type: string; confidence: number }[];
}

export interface AnalysisResult {
  clip_id: string;
  video: VideoAnalysis | null;
  audio: AudioAnalysis | null;
  status: string;
  error_message: string | null;
}

export interface Highlight {
  clip_id: string;
  timestamp: number;
  categories: string[];
  excitement: number;
  description: string;
}
