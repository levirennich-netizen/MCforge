"""Stage 7: Export — final render with YouTube-optimized settings."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Optional

from config import settings
from models import ExportResult, now_iso
from services.file_manager import export_dir


QUALITY_PRESETS = {
    "preview": {
        "resolution": "1280:720",
        "crf": "28",
        "preset": "ultrafast",
        "audio_bitrate": "128k",
        "fps": "30",
    },
    "1080p": {
        "resolution": "1920:1080",
        "crf": "18",
        "preset": "medium",
        "audio_bitrate": "192k",
        "fps": "60",
    },
    "4k": {
        "resolution": "3840:2160",
        "crf": "15",
        "preset": "slow",
        "audio_bitrate": "320k",
        "fps": "60",
    },
}


async def export_final(
    project_id: str,
    composed_video_path: Path,
    quality: str = "1080p",
    subtitle_path: Optional[str] = None,
    progress_callback=None,
) -> ExportResult:
    """Final encoding pass with YouTube-optimized settings."""
    q = QUALITY_PRESETS.get(quality, QUALITY_PRESETS["1080p"])
    out = export_dir(project_id)
    output_path = out / f"MCForge_Final_{quality}.mp4"

    if progress_callback:
        progress_callback(f"Rendering final {quality} video...")

    cmd = [
        settings.FFMPEG_PATH, "-y",
        "-i", str(composed_video_path),
    ]

    # Video filters
    vf = [
        f"scale={q['resolution']}:force_original_aspect_ratio=decrease",
        f"pad={q['resolution']}:(ow-iw)/2:(oh-ih)/2",
    ]
    if subtitle_path and Path(subtitle_path).exists():
        # FFmpeg subtitle filter needs special escaping: \ → \\\\ and : → \\:
        sub_esc = Path(subtitle_path).as_posix().replace("\\", "\\\\\\\\").replace(":", "\\\\:")
        vf.append(f"subtitles={sub_esc}")

    cmd.extend(["-vf", ",".join(vf)])
    cmd.extend([
        "-c:v", "libx264",
        "-profile:v", "high",
        "-level", "4.1",
        "-pix_fmt", "yuv420p",
        "-preset", q["preset"],
        "-crf", q["crf"],
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", q["audio_bitrate"],
        "-ar", "48000",
        "-r", q["fps"],
        str(output_path),
    ])

    if progress_callback:
        progress_callback("Encoding...")

    result = subprocess.run(cmd, capture_output=True, timeout=1800)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg export failed: {result.stderr.decode()[:500]}")

    file_size = output_path.stat().st_size if output_path.exists() else 0

    # Get duration from output
    duration = 0.0
    try:
        from services.ffmpeg_service import probe
        probe_data = probe(str(output_path))
        duration = float(probe_data.get("format", {}).get("duration", 0))
    except Exception:
        pass

    return ExportResult(
        project_id=project_id,
        quality=quality,
        output_path=str(output_path),
        file_size_bytes=file_size,
        duration_seconds=duration,
        status="completed",
        completed_at=now_iso(),
    )
