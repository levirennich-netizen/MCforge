"""Extract keyframes from video clips using FFmpeg."""

from __future__ import annotations

from pathlib import Path

from services import ffmpeg_service
from services.file_manager import frames_dir


def extract_keyframes(
    clip_path: str | Path,
    project_id: str,
    clip_id: str,
    timestamps: list[float],
) -> list[Path]:
    """Extract frames at specific timestamps."""
    out_dir = frames_dir(project_id, clip_id)
    paths = []
    for i, ts in enumerate(timestamps):
        out_path = out_dir / f"frame_{i:04d}.jpg"
        ffmpeg_service.extract_frame(clip_path, out_path, ts)
        if out_path.exists():
            paths.append(out_path)
    return paths
