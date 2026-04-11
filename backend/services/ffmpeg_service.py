"""FFmpeg command builder and executor."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Optional

from config import settings


def probe(file_path: str | Path) -> dict:
    """Run ffprobe and return metadata as dict."""
    cmd = [
        settings.FFPROBE_PATH,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(file_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    return json.loads(result.stdout)


def extract_thumbnail(
    video_path: str | Path,
    output_path: str | Path,
    timestamp: float = 0.5,
) -> Path:
    """Extract a single frame as JPEG thumbnail."""
    cmd = [
        settings.FFMPEG_PATH,
        "-y",
        "-ss", str(timestamp),
        "-i", str(video_path),
        "-vframes", "1",
        "-q:v", "3",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=30)
    out = Path(output_path)
    if result.returncode != 0 or not out.exists():
        raise RuntimeError(f"Thumbnail extraction failed: {result.stderr[:500] if result.stderr else 'unknown error'}")
    return out


def extract_audio(
    video_path: str | Path,
    output_path: str | Path,
    sample_rate: int = 16000,
    mono: bool = True,
) -> Path:
    """Extract audio track to WAV for analysis."""
    cmd = [
        settings.FFMPEG_PATH,
        "-y",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", str(sample_rate),
    ]
    if mono:
        cmd.extend(["-ac", "1"])
    cmd.append(str(output_path))
    result = subprocess.run(cmd, capture_output=True, timeout=120)
    out = Path(output_path)
    if result.returncode != 0 or not out.exists():
        raise RuntimeError(f"Audio extraction failed: {result.stderr[:500] if result.stderr else 'unknown error'}")
    return out


def extract_frame(
    video_path: str | Path,
    output_path: str | Path,
    timestamp: float,
) -> Path:
    """Extract a single frame at a specific timestamp."""
    cmd = [
        settings.FFMPEG_PATH,
        "-y",
        "-ss", str(timestamp),
        "-i", str(video_path),
        "-vframes", "1",
        "-q:v", "2",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=30)
    out = Path(output_path)
    if result.returncode != 0 or not out.exists():
        raise RuntimeError(f"Frame extraction failed at t={timestamp}: {result.stderr[:500] if result.stderr else 'unknown error'}")
    return out


def trim_clip(
    input_path: str | Path,
    output_path: str | Path,
    start_time: float,
    end_time: float,
    speed_factor: float = 1.0,
) -> Path:
    """Trim a video clip with optional speed change."""
    cmd = [
        settings.FFMPEG_PATH,
        "-y",
        "-ss", str(start_time),
        "-to", str(end_time),
        "-i", str(input_path),
    ]
    if speed_factor != 1.0:
        pts = 1.0 / speed_factor
        cmd.extend([
            "-filter_complex",
            f"[0:v]setpts={pts}*PTS[v];[0:a]atempo={speed_factor}[a]",
            "-map", "[v]",
            "-map", "[a]",
        ])
    cmd.extend(["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"])
    cmd.append(str(output_path))
    subprocess.run(cmd, capture_output=True, timeout=300)
    return Path(output_path)


def concat_clips(
    clip_paths: list[str | Path],
    output_path: str | Path,
    transition: str = "cut",
    transition_duration: float = 0.5,
) -> Path:
    """Concatenate multiple clips with optional transitions."""
    if not clip_paths:
        raise ValueError("No clips to concatenate")

    if transition == "cut" or len(clip_paths) == 1:
        # Simple concat using concat demuxer
        list_file = Path(output_path).parent / "concat_list.txt"
        with open(list_file, "w") as f:
            for p in clip_paths:
                f.write(f"file '{Path(p).as_posix()}'\n")

        cmd = [
            settings.FFMPEG_PATH,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(list_file),
            "-c", "copy",
            str(output_path),
        ]
        subprocess.run(cmd, capture_output=True, timeout=600)
        list_file.unlink(missing_ok=True)
    else:
        # Build xfade filter chain for transitions
        cmd = [settings.FFMPEG_PATH, "-y"]
        for p in clip_paths:
            cmd.extend(["-i", str(p)])

        filter_parts = []
        n = len(clip_paths)
        for i in range(n - 1):
            if i == 0:
                vin = f"[{i}:v]"
            else:
                vin = f"[vout{i}]"
            next_vin = f"[{i + 1}:v]"
            out = f"[vout{i + 1}]" if i < n - 2 else "[vfinal]"
            filter_parts.append(
                f"{vin}{next_vin}xfade=transition=fade:duration={transition_duration}:offset=0{out}"
            )

        cmd.extend(["-filter_complex", ";".join(filter_parts)])
        cmd.extend(["-map", "[vfinal]", "-c:v", "libx264", "-preset", "fast", "-crf", "20"])
        cmd.append(str(output_path))
        subprocess.run(cmd, capture_output=True, timeout=600)

    return Path(output_path)


def mix_audio_layers(
    layers: list[tuple[str | Path, float]],  # (path, volume)
    output_path: str | Path,
    duration: Optional[float] = None,
) -> Path:
    """Mix multiple audio layers with individual volumes."""
    cmd = [settings.FFMPEG_PATH, "-y"]
    filter_inputs = []

    for i, (path, volume) in enumerate(layers):
        cmd.extend(["-i", str(path)])
        filter_inputs.append(f"[{i}]volume={volume}[a{i}]")

    mix_inputs = "".join(f"[a{i}]" for i in range(len(layers)))
    filter_str = ";".join(filter_inputs)
    filter_str += f";{mix_inputs}amix=inputs={len(layers)}:duration=longest[out]"

    cmd.extend(["-filter_complex", filter_str, "-map", "[out]"])
    if duration:
        cmd.extend(["-t", str(duration)])
    cmd.extend(["-c:a", "aac", "-b:a", "192k"])
    cmd.append(str(output_path))
    subprocess.run(cmd, capture_output=True, timeout=600)
    return Path(output_path)


def render_final(
    video_path: str | Path,
    audio_path: str | Path,
    output_path: str | Path,
    quality: str = "1080p",
    subtitle_path: Optional[str | Path] = None,
) -> Path:
    """Final render combining video + audio with YouTube-optimized settings."""
    QUALITY_MAP = {
        "preview": {"res": "1280:720", "crf": "28", "preset": "ultrafast", "ab": "128k"},
        "1080p": {"res": "1920:1080", "crf": "18", "preset": "medium", "ab": "192k"},
        "4k": {"res": "3840:2160", "crf": "15", "preset": "slow", "ab": "320k"},
    }
    q = QUALITY_MAP.get(quality, QUALITY_MAP["1080p"])

    cmd = [
        settings.FFMPEG_PATH, "-y",
        "-i", str(video_path),
        "-i", str(audio_path),
        "-map", "0:v:0",
        "-map", "1:a:0",
    ]

    vf_filters = [f"scale={q['res']}:force_original_aspect_ratio=decrease,pad={q['res']}:(ow-iw)/2:(oh-ih)/2"]
    if subtitle_path:
        sub_path_posix = Path(subtitle_path).as_posix()
        vf_filters.append(f"subtitles='{sub_path_posix}'")

    cmd.extend(["-vf", ",".join(vf_filters)])
    cmd.extend([
        "-c:v", "libx264",
        "-profile:v", "high",
        "-level", "4.1",
        "-pix_fmt", "yuv420p",
        "-preset", q["preset"],
        "-crf", q["crf"],
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", q["ab"],
        "-ar", "48000",
        "-r", "60",
    ])
    cmd.append(str(output_path))
    subprocess.run(cmd, capture_output=True, timeout=1800)
    return Path(output_path)
