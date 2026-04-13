"""Stage 6: Compose — FFmpeg assembles final video from edit plan."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Optional

from config import settings
from models import EditPlan, NarrationSync
from services.file_manager import export_dir, preview_dir
import database as db


async def compose_video(
    project_id: str,
    edit_plan: EditPlan,
    narration: Optional[NarrationSync] = None,
    quality: str = "preview",
    progress_callback=None,
) -> Path:
    """
    Build and execute FFmpeg commands to assemble the final video.

    Strategy: Trim segments individually, then concatenate with transitions.
    """
    if quality == "preview":
        out_dir = preview_dir(project_id)
    else:
        out_dir = export_dir(project_id)

    # Step 1: Trim each segment from source clips
    if progress_callback:
        progress_callback("Trimming segments...")

    trimmed_paths: list[Path] = []
    clips_cache: dict[str, str] = {}  # clip_id -> file_path

    for i, segment in enumerate(edit_plan.segments):
        # Resolve clip file path
        if segment.clip_id not in clips_cache:
            clip = db.get_clip(segment.clip_id)
            if clip:
                clips_cache[segment.clip_id] = clip.file_path

        clip_path = clips_cache.get(segment.clip_id)
        if not clip_path:
            continue

        out_path = out_dir / f"seg_{i:03d}.mp4"
        _trim_segment(clip_path, out_path, segment.start_time, segment.end_time,
                       segment.speed_factor, quality)
        if out_path.exists():
            trimmed_paths.append(out_path)

    if not trimmed_paths:
        raise RuntimeError("No segments could be trimmed")

    # Step 2: Concatenate all segments
    if progress_callback:
        progress_callback("Concatenating segments...")

    concat_path = out_dir / "concat.mp4"
    _concat_segments(trimmed_paths, concat_path)

    # Step 3: Mix audio if narration exists
    if narration and narration.audio_path and Path(narration.audio_path).exists():
        if progress_callback:
            progress_callback("Mixing audio layers...")
        final_path = out_dir / f"final_{quality}.mp4"
        _mix_with_narration(concat_path, narration.audio_path, final_path)
    else:
        final_path = concat_path

    # Cleanup trimmed segments
    for p in trimmed_paths:
        p.unlink(missing_ok=True)
    if concat_path != final_path:
        concat_path.unlink(missing_ok=True)

    return final_path


def _trim_segment(
    input_path: str,
    output_path: Path,
    start: float,
    end: float,
    speed: float,
    quality: str,
) -> None:
    """Trim a single segment with speed adjustment."""
    q = {"preview": ("28", "ultrafast"), "1080p": ("18", "medium"), "4k": ("15", "slow")}
    crf, preset = q.get(quality, q["preview"])

    cmd = [
        settings.FFMPEG_PATH, "-y",
        "-ss", str(start),
        "-to", str(end),
        "-i", str(input_path),
    ]

    if speed != 1.0:
        pts = 1.0 / speed
        # atempo only supports 0.5-2.0, chain for extreme values
        atempo_chain = _build_atempo_chain(speed)
        cmd.extend([
            "-filter_complex",
            f"[0:v]setpts={pts}*PTS[v];[0:a]{atempo_chain}[a]",
            "-map", "[v]", "-map", "[a]",
        ])

    cmd.extend([
        "-c:v", "libx264", "-preset", preset, "-crf", crf,
        "-c:a", "aac", "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ])
    result = subprocess.run(cmd, capture_output=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"Segment trim failed: {result.stderr.decode()[:500]}")


def _build_atempo_chain(speed: float) -> str:
    """Build atempo filter chain (each filter limited to 0.5-2.0x)."""
    filters = []
    remaining = speed
    while remaining > 2.0:
        filters.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        filters.append("atempo=0.5")
        remaining *= 2.0
    filters.append(f"atempo={remaining:.4f}")
    return ",".join(filters)


def _concat_segments(paths: list[Path], output_path: Path) -> None:
    """Concatenate trimmed segments using concat demuxer."""
    list_file = output_path.parent / "concat_list.txt"
    with open(list_file, "w") as f:
        for p in paths:
            f.write(f"file '{p.as_posix()}'\n")

    cmd = [
        settings.FFMPEG_PATH, "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(list_file),
        "-c", "copy",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=600)
    list_file.unlink(missing_ok=True)
    if result.returncode != 0:
        raise RuntimeError(f"Concat failed: {result.stderr.decode()[:500]}")


def _mix_with_narration(video_path: Path, narration_path: str, output_path: Path) -> None:
    """Mix video audio with narration track."""
    cmd = [
        settings.FFMPEG_PATH, "-y",
        "-i", str(video_path),
        "-i", str(narration_path),
        "-filter_complex",
        "[0:a]volume=0.6[game];[1:a]volume=1.0[narr];[game][narr]amix=inputs=2:duration=first[out]",
        "-map", "0:v", "-map", "[out]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"Audio mix failed: {result.stderr.decode()[:500]}")
