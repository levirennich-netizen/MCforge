from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Enums ────────────────────────────────────────────────────────────────────


class StylePreset(str, Enum):
    FUNNY = "funny"
    HIGH_ENERGY = "high_energy"
    CINEMATIC = "cinematic"


class ProjectStatus(str, Enum):
    CREATED = "created"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    ANALYZING = "analyzing"
    PLANNING = "planning"
    COMPOSING = "composing"
    EXPORTED = "exported"


class JobType(str, Enum):
    ANALYZE = "analyze"
    PLAN = "plan"
    NARRATE = "narrate"
    COMPOSE = "compose"
    EXPORT = "export"
    AUTO_EDIT = "auto_edit"
    GENERATE_IMAGE = "generate_image"
    GENERATE_SFX = "generate_sfx"
    GENERATE_INTRO = "generate_intro"
    GENERATE_VIDEO = "generate_video"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TransitionType(str, Enum):
    CUT = "cut"
    CROSSFADE = "crossfade"
    FADE_BLACK = "fade_black"
    ZOOM_IN = "zoom_in"
    SWIPE = "swipe"


class EffectType(str, Enum):
    ZOOM = "zoom"
    SHAKE = "shake"
    SLOW_MO = "slow_mo"
    SPEED_UP = "speed_up"


# ── Projects ─────────────────────────────────────────────────────────────────


class CreateProjectRequest(BaseModel):
    name: str
    style_preset: StylePreset = StylePreset.HIGH_ENERGY
    target_duration_seconds: Optional[float] = None


class Project(BaseModel):
    id: str = Field(default_factory=lambda: new_id("proj_"))
    name: str
    style_preset: StylePreset = StylePreset.HIGH_ENERGY
    status: ProjectStatus = ProjectStatus.CREATED
    target_duration_seconds: Optional[float] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ── Clips ────────────────────────────────────────────────────────────────────


class ClipMetadata(BaseModel):
    id: str = Field(default_factory=lambda: new_id("clip_"))
    project_id: str
    filename: str
    file_path: str
    duration_seconds: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 0.0
    codec: str = ""
    audio_channels: int = 0
    file_size_bytes: int = 0
    thumbnail_path: str = ""
    audio_path: str = ""
    sort_order: int = 0
    created_at: str = Field(default_factory=now_iso)


# ── Analysis ─────────────────────────────────────────────────────────────────


class SceneSegment(BaseModel):
    start_time: float
    end_time: float
    start_frame: int = 0
    end_frame: int = 0


class MotionScore(BaseModel):
    timestamp: float
    score: float  # 0.0 = still, 1.0 = max action


class FrameAnalysis(BaseModel):
    timestamp: float
    categories: list[str] = []
    excitement: int = 5
    description: str = ""
    frame_path: str = ""


class SilenceSegment(BaseModel):
    start: float
    end: float


class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    confidence: float = 1.0


class Transcription(BaseModel):
    language: str = "en"
    words: list[WordTimestamp] = []


class GameEvent(BaseModel):
    timestamp: float
    event_type: str
    confidence: float = 1.0


class VideoAnalysis(BaseModel):
    clip_id: str
    scenes: list[SceneSegment] = []
    motion_scores: list[MotionScore] = []
    frame_analyses: list[FrameAnalysis] = []
    avg_excitement: float = 5.0
    highlight_timestamps: list[float] = []


class AudioAnalysis(BaseModel):
    clip_id: str
    silence_segments: list[SilenceSegment] = []
    transcription: Optional[Transcription] = None
    game_events: list[GameEvent] = []


class AnalysisResult(BaseModel):
    clip_id: str
    video: Optional[VideoAnalysis] = None
    audio: Optional[AudioAnalysis] = None
    status: str = "pending"
    error_message: Optional[str] = None


# ── Edit Plan ────────────────────────────────────────────────────────────────


class Effect(BaseModel):
    type: EffectType
    start_offset: float = 0.0
    duration: float = 1.0
    intensity: float = 1.0


class SoundEffect(BaseModel):
    sound: str
    offset: float
    volume: float = 0.7


class EditSegment(BaseModel):
    segment_id: str = Field(default_factory=lambda: new_id("seg_"))
    clip_id: str
    start_time: float
    end_time: float
    timeline_position: float = 0.0
    label: str = ""
    transition_in: TransitionType = TransitionType.CUT
    transition_duration: float = 0.0
    effects: list[Effect] = []
    sfx: list[SoundEffect] = []
    subtitle_text: Optional[str] = None
    speed_factor: float = 1.0


class EditPlan(BaseModel):
    id: str = Field(default_factory=lambda: new_id("plan_"))
    project_id: str
    version: int = 1
    style_preset: StylePreset = StylePreset.HIGH_ENERGY
    segments: list[EditSegment] = []
    background_music: str = ""
    music_volume: float = 0.3
    total_duration: float = 0.0
    reasoning: str = ""
    is_user_modified: bool = False
    created_at: str = Field(default_factory=now_iso)


# ── Narration ────────────────────────────────────────────────────────────────


class NarrationSegment(BaseModel):
    segment_id: str
    narration_text: str


class NarrationSync(BaseModel):
    id: str = Field(default_factory=lambda: new_id("narr_"))
    project_id: str
    type: str = "generated"  # 'uploaded' | 'generated'
    voice_id: Optional[str] = None
    script: list[NarrationSegment] = []
    audio_path: str = ""
    word_timestamps: list[WordTimestamp] = []
    created_at: str = Field(default_factory=now_iso)


# ── Jobs ─────────────────────────────────────────────────────────────────────


class Job(BaseModel):
    id: str = Field(default_factory=lambda: new_id("job_"))
    project_id: str
    job_type: JobType
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    progress_message: str = ""
    result_json: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class JobProgress(BaseModel):
    job_id: str
    status: str
    progress: float
    message: str
    stage: str


# ── Export ────────────────────────────────────────────────────────────────────


class ExportRequest(BaseModel):
    quality: str = "1080p"
    include_narration: bool = True
    include_subtitles: bool = True
    include_music: bool = True


class ExportResult(BaseModel):
    id: str = Field(default_factory=lambda: new_id("exp_"))
    project_id: str
    edit_plan_id: str = ""
    quality: str = "1080p"
    output_path: str = ""
    file_size_bytes: int = 0
    duration_seconds: float = 0.0
    status: str = "pending"
    created_at: str = Field(default_factory=now_iso)
    completed_at: Optional[str] = None


# ── Chat ────────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str


# ── Generate ───────────────────────────────────────────────────────────────


class GenerateAssetType(str, Enum):
    IMAGE = "image"
    SFX = "sfx"
    ANIMATED_INTRO = "animated_intro"
    VIDEO = "video"


class AnimatedIntroType(str, Enum):
    TITLE_CARD = "title_card"
    LOWER_THIRD = "lower_third"
    END_SCREEN = "end_screen"


class GenerateImageRequest(BaseModel):
    prompt: str
    style: str = "minecraft"  # minecraft | thumbnail | overlay | pixel_art


class GenerateSfxRequest(BaseModel):
    prompt: str
    voice_id: str = "rex"
    duration_hint: str = "short"  # short | medium | long


class GenerateAnimatedIntroRequest(BaseModel):
    intro_type: AnimatedIntroType = AnimatedIntroType.TITLE_CARD
    title: str
    subtitle: str = ""
    duration_seconds: float = 5.0
    color_scheme: str = "emerald"  # emerald | gold | crimson | diamond


class GenerateVideoRequest(BaseModel):
    prompt: str
    model: str = "seedance"  # seedance | wan | wan-fast | veo | ltx-2
    duration: int = 5  # seconds


class GeneratedAsset(BaseModel):
    id: str = Field(default_factory=lambda: new_id("gen_"))
    project_id: str
    asset_type: GenerateAssetType
    name: str
    prompt: str = ""
    file_path: str = ""
    thumbnail_path: str = ""
    duration_seconds: float = 0.0
    file_size_bytes: int = 0
    metadata_json: str = "{}"
    created_at: str = Field(default_factory=now_iso)
