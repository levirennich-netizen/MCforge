export type GenerateAssetType = "image" | "sfx" | "animated_intro" | "video";
export type ImageStyle = "minecraft" | "thumbnail" | "overlay" | "pixel_art";
export type AnimatedIntroType = "title_card" | "lower_third" | "end_screen";
export type ColorScheme = "emerald" | "gold" | "crimson" | "diamond";

export interface GeneratedAsset {
  id: string;
  project_id: string;
  asset_type: GenerateAssetType;
  name: string;
  prompt: string;
  file_path: string;
  thumbnail_path: string;
  duration_seconds: number;
  file_size_bytes: number;
  metadata_json: string;
  created_at: string;
}
