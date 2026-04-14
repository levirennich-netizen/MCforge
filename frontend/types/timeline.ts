export type TransitionType = "cut" | "crossfade" | "fade_black" | "zoom_in" | "swipe";
export type EffectType = "zoom" | "shake" | "slow_mo" | "speed_up";

export interface Effect {
  type: EffectType;
  start_offset: number;
  duration: number;
  intensity: number;
}

export interface SoundEffect {
  sound: string;
  offset: number;
  volume: number;
}

export interface EditSegment {
  segment_id: string;
  clip_id: string;
  start_time: number;
  end_time: number;
  timeline_position: number;
  label: string;
  transition_in: TransitionType;
  transition_duration: number;
  effects: Effect[];
  sfx: SoundEffect[];
  subtitle_text: string | null;
  speed_factor: number;
  mute_original_audio: boolean;
}

export interface EditPlan {
  id: string;
  project_id: string;
  version: number;
  style_preset: string;
  segments: EditSegment[];
  background_music: string;
  music_volume: number;
  total_duration: number;
  reasoning: string;
  is_user_modified: boolean;
  created_at: string;
}
