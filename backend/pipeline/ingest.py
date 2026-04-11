"""Stage 1: Ingest — extract metadata, thumbnail, and audio from uploaded clips."""

from __future__ import annotations

from pathlib import Path

from models import ClipMetadata
from services import ffmpeg_service, file_manager


async def ingest_clip(project_id: str, file_path: Path, filename: str, sort_order: int = 0) -> ClipMetadata:
    """
    Process an uploaded clip:
    1. Extract metadata via ffprobe
    2. Generate thumbnail (first frame)
    3. Extract audio to WAV for analysis
    """
    # Probe metadata
    probe_data = ffmpeg_service.probe(file_path)

    duration = float(probe_data.get("format", {}).get("duration", 0))
    file_size = int(probe_data.get("format", {}).get("size", 0))

    # Find video stream
    width, height, fps, codec = 0, 0, 0.0, ""
    audio_channels = 0
    for stream in probe_data.get("streams", []):
        if stream.get("codec_type") == "video" and not width:
            width = int(stream.get("width", 0))
            height = int(stream.get("height", 0))
            codec = stream.get("codec_name", "")
            # Parse fps from r_frame_rate (e.g. "30/1")
            fps_str = stream.get("r_frame_rate", "0/1")
            if "/" in fps_str:
                num, den = fps_str.split("/")
                fps = float(num) / float(den) if float(den) > 0 else 0.0
            else:
                fps = float(fps_str)
        elif stream.get("codec_type") == "audio":
            audio_channels = int(stream.get("channels", 0))

    # Generate clip ID
    clip = ClipMetadata(
        project_id=project_id,
        filename=filename,
        file_path=str(file_path),
        duration_seconds=duration,
        width=width,
        height=height,
        fps=fps,
        codec=codec,
        audio_channels=audio_channels,
        file_size_bytes=file_size,
        sort_order=sort_order,
    )

    # Extract thumbnail
    thumb_path = file_manager.thumbnail_path(project_id, clip.id)
    ffmpeg_service.extract_thumbnail(file_path, thumb_path, timestamp=min(0.5, duration / 2))
    clip.thumbnail_path = str(thumb_path)

    # Extract audio for analysis
    if audio_channels > 0:
        audio_out = file_manager.audio_dir(project_id) / f"{clip.id}.wav"
        ffmpeg_service.extract_audio(file_path, audio_out)
        clip.audio_path = str(audio_out)

    return clip
