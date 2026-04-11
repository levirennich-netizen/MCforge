"""Generate pipeline — image, SFX, and animated intro generation tasks."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import database as db
from config import settings
from models import GenerateAssetType, GeneratedAsset, new_id
from services.file_manager import generated_images_dir, generated_sfx_dir, generated_intros_dir
from services.grok_client import chat_completion, generate_image_pollinations, generate_tts
from services.job_queue import update_progress


# ── Style prompt enhancers ───────────────────────────────────────────────

STYLE_HINTS = {
    "minecraft": "Minecraft game art style, blocky voxel aesthetic, vibrant colors, ",
    "thumbnail": "YouTube thumbnail style, eye-catching, bold text-friendly composition, ",
    "overlay": "transparent background PNG overlay, clean edges, stream overlay style, ",
    "pixel_art": "pixel art style, retro 8-bit/16-bit aesthetic, crisp pixels, ",
}


async def run_generate_image(
    project_id: str, job_id: str, prompt: str, style: str = "minecraft"
) -> GeneratedAsset:
    """Generate an image using Pollinations.ai (free)."""
    update_progress(job_id, project_id, 0.1, "Enhancing prompt...", "generate_image")

    # Enhance prompt with style hints
    style_prefix = STYLE_HINTS.get(style, "")
    enhanced_prompt = f"{style_prefix}{prompt}"

    update_progress(job_id, project_id, 0.3, "Generating image...", "generate_image")

    image_bytes = await generate_image_pollinations(enhanced_prompt)
    if not image_bytes:
        raise RuntimeError("No image returned from API")

    update_progress(job_id, project_id, 0.8, "Saving image...", "generate_image")

    # Save the image
    out_dir = generated_images_dir(project_id)
    asset_id = new_id("gen_")
    filename = f"{asset_id}.jpg"
    file_path = out_dir / filename
    file_path.write_bytes(image_bytes)

    # Create asset record
    asset = GeneratedAsset(
        id=asset_id,
        project_id=project_id,
        asset_type=GenerateAssetType.IMAGE,
        name=f"Image: {prompt[:50]}",
        prompt=prompt,
        file_path=str(file_path),
        thumbnail_path=str(file_path),  # Image is its own thumbnail
        file_size_bytes=len(image_bytes),
        metadata_json=json.dumps({"style": style}),
    )
    db.create_generated_asset(asset)

    update_progress(job_id, project_id, 1.0, "Image generated!", "generate_image")
    return asset


async def run_generate_sfx(
    project_id: str, job_id: str, prompt: str,
    voice_id: str = "rex", duration_hint: str = "short"
) -> GeneratedAsset:
    """Generate a sound effect using TTS with the prompt as script."""
    update_progress(job_id, project_id, 0.2, "Preparing script...", "generate_sfx")

    # Use the prompt directly as the TTS script
    script = prompt

    update_progress(job_id, project_id, 0.4, "Generating audio...", "generate_sfx")

    audio_bytes = await generate_tts(script, voice_id=voice_id)

    update_progress(job_id, project_id, 0.8, "Saving audio...", "generate_sfx")

    out_dir = generated_sfx_dir(project_id)
    asset_id = new_id("gen_")
    filename = f"{asset_id}.mp3"
    file_path = out_dir / filename
    file_path.write_bytes(audio_bytes)

    asset = GeneratedAsset(
        id=asset_id,
        project_id=project_id,
        asset_type=GenerateAssetType.SFX,
        name=f"SFX: {prompt[:50]}",
        prompt=prompt,
        file_path=str(file_path),
        file_size_bytes=len(audio_bytes),
        metadata_json=json.dumps({"voice_id": voice_id, "script": script, "duration_hint": duration_hint}),
    )
    db.create_generated_asset(asset)

    update_progress(job_id, project_id, 1.0, "Sound effect generated!", "generate_sfx")
    return asset


# ── Animated Intro color schemes ─────────────────────────────────────────

COLOR_SCHEMES = {
    "emerald": {"bg": "0x0D1117", "title": "0x10B981", "subtitle": "0x6EE7B7", "accent": "0x059669"},
    "gold": {"bg": "0x1A1308", "title": "0xF59E0B", "subtitle": "0xFCD34D", "accent": "0xD97706"},
    "crimson": {"bg": "0x1A0808", "title": "0xEF4444", "subtitle": "0xFCA5A5", "accent": "0xDC2626"},
    "diamond": {"bg": "0x081018", "title": "0x06B6D4", "subtitle": "0x67E8F9", "accent": "0x0891B2"},
}


def _escape_drawtext(text: str) -> str:
    """Escape text for FFmpeg drawtext filter."""
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "\u2019")  # Use right single quote to avoid escaping issues
    text = text.replace(":", "\\:")
    text = text.replace(";", "\\;")
    text = text.replace(",", "\\,")
    text = text.replace("[", "\\[")
    text = text.replace("]", "\\]")
    return text


def _build_title_card_filter(title: str, subtitle: str, colors: dict, duration: float) -> str:
    """Build FFmpeg drawtext filter for title card animation."""
    title_esc = _escape_drawtext(title)
    sub_esc = _escape_drawtext(subtitle)
    tc = colors["title"]
    sc = colors["subtitle"]

    filters = [
        f"color=c={colors['bg']}:s=1920x1080:d={duration}",
        (
            f"drawtext=text='{title_esc}':fontsize=72:fontcolor={tc}:"
            f"x=(w-text_w)/2:y=(h-text_h)/2-40:"
            f"enable='gte(t,0.3)':alpha='if(lt(t,0.8),min(1,(t-0.3)*2),if(gt(t,{duration-0.5}),max(0,({duration}-t)*2),1))'"
        ),
    ]
    if subtitle:
        filters.append(
            f"drawtext=text='{sub_esc}':fontsize=36:fontcolor={sc}:"
            f"x=(w-text_w)/2:y=(h/2)+30:"
            f"enable='gte(t,0.6)':alpha='if(lt(t,1.1),min(1,(t-0.6)*2),if(gt(t,{duration-0.5}),max(0,({duration}-t)*2),1))'"
        )
    return ",".join(filters)


def _build_lower_third_filter(title: str, subtitle: str, colors: dict, duration: float) -> str:
    """Build FFmpeg drawtext filter for lower third animation."""
    title_esc = _escape_drawtext(title)
    sub_esc = _escape_drawtext(subtitle)
    tc = colors["title"]
    sc = colors["subtitle"]
    ac = colors["accent"]

    filters = [
        f"color=c={colors['bg']}:s=1920x1080:d={duration}",
        (
            f"drawbox=x=60:y=780:w=600:h=4:color={ac}:t=fill:"
            f"enable='gte(t,0.2)'"
        ),
        (
            f"drawtext=text='{title_esc}':fontsize=48:fontcolor={tc}:"
            f"x=60:y=800:"
            f"enable='gte(t,0.3)':alpha='min(1,(t-0.3)*3)'"
        ),
    ]
    if subtitle:
        filters.append(
            f"drawtext=text='{sub_esc}':fontsize=28:fontcolor={sc}:"
            f"x=60:y=860:"
            f"enable='gte(t,0.5)':alpha='min(1,(t-0.5)*3)'"
        )
    return ",".join(filters)


def _build_end_screen_filter(title: str, subtitle: str, colors: dict, duration: float) -> str:
    """Build FFmpeg drawtext filter for end screen animation."""
    title_esc = _escape_drawtext(title)
    sub_esc = _escape_drawtext(subtitle)
    tc = colors["title"]
    sc = colors["subtitle"]

    filters = [
        f"color=c={colors['bg']}:s=1920x1080:d={duration}",
        (
            f"drawtext=text='{title_esc}':fontsize=64:fontcolor={tc}:"
            f"x=(w-text_w)/2:y=(h/2)-60:"
            f"enable='gte(t,0.5)':alpha='min(1,(t-0.5)*2)'"
        ),
    ]
    if subtitle:
        filters.append(
            f"drawtext=text='{sub_esc}':fontsize=32:fontcolor={sc}:"
            f"x=(w-text_w)/2:y=(h/2)+20:"
            f"enable='gte(t,0.8)':alpha='min(1,(t-0.8)*2)'"
        )
    # Subscribe prompt
    filters.append(
        f"drawtext=text='SUBSCRIBE':fontsize=28:fontcolor={colors['accent']}:"
        f"x=(w-text_w)/2:y=(h/2)+100:"
        f"enable='gte(t,1.2)':alpha='min(1,(t-1.2)*2)'"
    )
    return ",".join(filters)


async def run_generate_animated_intro(
    project_id: str, job_id: str,
    intro_type: str = "title_card",
    title: str = "My Video",
    subtitle: str = "",
    duration_seconds: float = 5.0,
    color_scheme: str = "emerald",
) -> GeneratedAsset:
    """Generate an animated intro/outro using FFmpeg drawtext."""
    update_progress(job_id, project_id, 0.1, "Building animation...", "generate_intro")

    colors = COLOR_SCHEMES.get(color_scheme, COLOR_SCHEMES["emerald"])
    duration = max(3.0, min(15.0, duration_seconds))

    # Build filter based on type
    filter_builders = {
        "title_card": _build_title_card_filter,
        "lower_third": _build_lower_third_filter,
        "end_screen": _build_end_screen_filter,
    }
    builder = filter_builders.get(intro_type, _build_title_card_filter)
    filter_complex = builder(title, subtitle, colors, duration)

    update_progress(job_id, project_id, 0.3, "Rendering video...", "generate_intro")

    out_dir = generated_intros_dir(project_id)
    asset_id = new_id("gen_")
    filename = f"{asset_id}.mp4"
    file_path = out_dir / filename

    # Build FFmpeg command
    cmd = [
        settings.FFMPEG_PATH,
        "-y",
        "-f", "lavfi",
        "-i", filter_complex,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-t", str(duration),
        str(file_path),
    ]

    update_progress(job_id, project_id, 0.5, "Encoding video...", "generate_intro")

    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {proc.stderr[:500]}")

    file_size = file_path.stat().st_size

    # Generate a thumbnail (grab frame at 1s)
    thumb_path = out_dir / f"{asset_id}_thumb.jpg"
    try:
        thumb_cmd = [
            settings.FFMPEG_PATH,
            "-y", "-i", str(file_path),
            "-ss", "1", "-vframes", "1",
            "-vf", "scale=320:-1",
            str(thumb_path),
        ]
        subprocess.run(thumb_cmd, capture_output=True, timeout=30)
    except (subprocess.TimeoutExpired, OSError):
        pass  # Thumbnail is optional

    update_progress(job_id, project_id, 0.9, "Saving...", "generate_intro")

    asset = GeneratedAsset(
        id=asset_id,
        project_id=project_id,
        asset_type=GenerateAssetType.ANIMATED_INTRO,
        name=f"{intro_type.replace('_', ' ').title()}: {title[:40]}",
        prompt=f"{intro_type} - {title}",
        file_path=str(file_path),
        thumbnail_path=str(thumb_path) if thumb_path.exists() else "",
        duration_seconds=duration,
        file_size_bytes=file_size,
        metadata_json=json.dumps({
            "intro_type": intro_type,
            "title": title,
            "subtitle": subtitle,
            "color_scheme": color_scheme,
        }),
    )
    db.create_generated_asset(asset)

    update_progress(job_id, project_id, 1.0, "Animated intro generated!", "generate_intro")
    return asset
