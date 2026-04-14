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


# ── SFX Templates (FFmpeg lavfi audio synthesis) ─────────────────────────

SFX_TEMPLATES: dict[str, dict] = {
    "explosion": {
        "keywords": ["explosion", "explode", "tnt", "boom", "blast", "creeper"],
        "filter": "anoisesrc=d=1.5:c=brown:a=0.9,afade=t=out:st=0.1:d=1.4,lowpass=f=400,volume=2",
        "label": "Explosion",
    },
    "hit": {
        "keywords": ["hit", "punch", "attack", "sword", "damage", "hurt", "slap", "smack"],
        "filter": "anoisesrc=d=0.15:c=pink:a=0.8,highpass=f=800,afade=t=out:st=0.02:d=0.13,volume=2",
        "label": "Hit",
    },
    "mining": {
        "keywords": ["mine", "mining", "dig", "break", "block", "pick", "stone", "crack"],
        "filter": "anoisesrc=d=0.4:c=white:a=0.5,bandpass=f=2000:w=1000,afade=t=out:st=0.05:d=0.35;anoisesrc=d=0.4:c=white:a=0.5,bandpass=f=3000:w=800,adelay=150|150,afade=t=out:st=0.05:d=0.35",
        "label": "Mining",
        "amix": True,
    },
    "pickup": {
        "keywords": ["pickup", "collect", "item", "xp", "orb", "ding", "get", "grab", "coin"],
        "filter": "sine=f=600:d=0.15,volume=0.5;sine=f=900:d=0.15,adelay=100|100,volume=0.5;sine=f=1200:d=0.2,adelay=200|200,volume=0.4",
        "label": "Item Pickup",
        "amix": True,
    },
    "footstep": {
        "keywords": ["footstep", "walk", "step", "running", "run", "feet"],
        "filter": "anoisesrc=d=0.08:c=brown:a=0.6,highpass=f=200,lowpass=f=2000,afade=t=out:st=0.01:d=0.07;anoisesrc=d=0.08:c=brown:a=0.6,highpass=f=200,lowpass=f=2000,adelay=400|400,afade=t=out:st=0.01:d=0.07;anoisesrc=d=0.08:c=brown:a=0.6,highpass=f=200,lowpass=f=2000,adelay=800|800,afade=t=out:st=0.01:d=0.07;anoisesrc=d=0.08:c=brown:a=0.6,highpass=f=200,lowpass=f=2000,adelay=1200|1200,afade=t=out:st=0.01:d=0.07",
        "label": "Footsteps",
        "amix": True,
    },
    "water": {
        "keywords": ["water", "splash", "swim", "ocean", "rain", "drip", "liquid", "river"],
        "filter": "anoisesrc=d=2:c=pink:a=0.3,lowpass=f=1500,tremolo=f=4:d=0.4,afade=t=in:d=0.3,afade=t=out:st=1.5:d=0.5",
        "label": "Water",
    },
    "fire": {
        "keywords": ["fire", "lava", "burn", "flame", "blaze", "torch"],
        "filter": "anoisesrc=d=2:c=brown:a=0.4,bandpass=f=500:w=400,tremolo=f=6:d=0.5,afade=t=in:d=0.2,afade=t=out:st=1.5:d=0.5,volume=1.5",
        "label": "Fire",
    },
    "arrow": {
        "keywords": ["arrow", "shoot", "bow", "projectile", "whoosh", "swoosh", "throw"],
        "filter": "sine=f=800:d=0.3,asetrate=44100*0.5,aresample=44100,afade=t=in:d=0.01,afade=t=out:st=0.05:d=0.25,volume=0.6;anoisesrc=d=0.3:c=white:a=0.2,highpass=f=3000,afade=t=out:st=0.05:d=0.25",
        "label": "Arrow/Swoosh",
        "amix": True,
    },
    "door": {
        "keywords": ["door", "open", "close", "chest", "creak", "wood"],
        "filter": "sine=f=200:d=0.4,asetrate=44100*1.3,aresample=44100,volume=0.4;anoisesrc=d=0.3:c=brown:a=0.3,bandpass=f=800:w=500,adelay=50|50,afade=t=out:st=0.05:d=0.25",
        "label": "Door/Chest",
        "amix": True,
    },
    "ambient": {
        "keywords": ["ambient", "cave", "wind", "spooky", "atmosphere", "background", "eerie"],
        "filter": "anoisesrc=d=3:c=brown:a=0.15,lowpass=f=600,tremolo=f=0.5:d=0.3,afade=t=in:d=0.5,afade=t=out:st=2:d=1",
        "label": "Ambient",
    },
    "eat": {
        "keywords": ["eat", "food", "munch", "chomp", "bite", "drink", "gulp"],
        "filter": "anoisesrc=d=0.12:c=pink:a=0.5,bandpass=f=1500:w=1000,afade=t=out:st=0.02:d=0.1;anoisesrc=d=0.12:c=pink:a=0.5,bandpass=f=1800:w=1000,adelay=200|200,afade=t=out:st=0.02:d=0.1;anoisesrc=d=0.12:c=pink:a=0.5,bandpass=f=1300:w=1000,adelay=400|400,afade=t=out:st=0.02:d=0.1",
        "label": "Eating",
        "amix": True,
    },
    "level_up": {
        "keywords": ["level", "upgrade", "enchant", "power", "achievement", "fanfare", "success", "win"],
        "filter": "sine=f=400:d=0.2,volume=0.4;sine=f=500:d=0.2,adelay=150|150,volume=0.4;sine=f=600:d=0.2,adelay=300|300,volume=0.4;sine=f=800:d=0.4,adelay=450|450,volume=0.5",
        "label": "Level Up",
        "amix": True,
    },
}


def _match_sfx_template(prompt: str) -> dict:
    """Match a prompt to the best SFX template using keyword matching."""
    prompt_lower = prompt.lower()
    best_match = None
    best_score = 0
    for _name, template in SFX_TEMPLATES.items():
        score = sum(1 for kw in template["keywords"] if kw in prompt_lower)
        if score > best_score:
            best_score = score
            best_match = template
    # Default to a generic noise burst if nothing matches
    if not best_match:
        best_match = {
            "filter": "anoisesrc=d=1:c=pink:a=0.5,bandpass=f=1000:w=800,afade=t=out:st=0.1:d=0.9,volume=1.5",
            "label": "Sound Effect",
            "amix": False,
        }
    return best_match


async def run_generate_sfx(
    project_id: str, job_id: str, prompt: str,
    voice_id: str = "rex", duration_hint: str = "short"
) -> GeneratedAsset:
    """Generate a sound effect using FFmpeg audio synthesis."""
    update_progress(job_id, project_id, 0.2, "Matching sound type...", "generate_sfx")

    template = _match_sfx_template(prompt)

    update_progress(job_id, project_id, 0.4, f"Generating {template['label']}...", "generate_sfx")

    out_dir = generated_sfx_dir(project_id)
    asset_id = new_id("gen_")
    filename = f"{asset_id}.mp3"
    file_path = out_dir / filename

    # Build FFmpeg command for audio synthesis
    if template.get("amix"):
        # Multiple audio sources that need mixing
        parts = template["filter"].split(";")
        inputs = []
        for part in parts:
            inputs.extend(["-f", "lavfi", "-i", part.strip()])
        n = len(parts)
        filter_complex = f"amix=inputs={n}:duration=longest"
        cmd = [
            settings.FFMPEG_PATH, "-y",
            *inputs,
            "-filter_complex", filter_complex,
            "-c:a", "libmp3lame", "-q:a", "4",
            str(file_path),
        ]
    else:
        cmd = [
            settings.FFMPEG_PATH, "-y",
            "-f", "lavfi", "-i", template["filter"],
            "-c:a", "libmp3lame", "-q:a", "4",
            str(file_path),
        ]

    update_progress(job_id, project_id, 0.6, "Rendering audio...", "generate_sfx")

    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg SFX failed: {proc.stderr[:500]}")

    audio_bytes = file_path.read_bytes()

    update_progress(job_id, project_id, 0.9, "Saving...", "generate_sfx")

    asset = GeneratedAsset(
        id=asset_id,
        project_id=project_id,
        asset_type=GenerateAssetType.SFX,
        name=f"SFX: {template['label']} — {prompt[:40]}",
        prompt=prompt,
        file_path=str(file_path),
        file_size_bytes=len(audio_bytes),
        metadata_json=json.dumps({"sfx_type": template["label"], "prompt": prompt, "duration_hint": duration_hint}),
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


# ── Video generation ──────────────────────────────────────────────────────

VIDEO_STYLE_HINTS = {
    "minecraft": "Minecraft game footage, blocky voxel world, vibrant colors, ",
    "cinematic": "Cinematic Minecraft gameplay, dramatic camera angles, ",
    "timelapse": "Minecraft building timelapse, creative mode, ",
}


async def run_generate_video(
    project_id: str, job_id: str, prompt: str,
    model: str = "cinematic", duration: int = 5,
) -> GeneratedAsset:
    """Generate a video from AI images + Ken Burns effects (free)."""
    from services.grok_client import generate_video_pollinations
    from services.file_manager import generated_videos_dir

    enhanced = f"{VIDEO_STYLE_HINTS.get('minecraft', '')}{prompt}"

    update_progress(job_id, project_id, 0.1, "Generating AI images...", "generate_video")
    video_bytes = await generate_video_pollinations(enhanced, model=model, duration=duration)

    if not video_bytes or len(video_bytes) < 1000:
        raise RuntimeError("Video generation returned empty or invalid response")

    update_progress(job_id, project_id, 0.8, "Saving video...", "generate_video")

    out_dir = generated_videos_dir(project_id)
    asset_id = new_id("gen_")
    file_path = out_dir / f"{asset_id}.mp4"
    file_path.write_bytes(video_bytes)

    file_size = len(video_bytes)

    thumb_path = out_dir / f"{asset_id}_thumb.jpg"
    try:
        subprocess.run([
            settings.FFMPEG_PATH, "-y", "-i", str(file_path),
            "-ss", "1", "-vframes", "1", "-vf", "scale=320:-1",
            str(thumb_path),
        ], capture_output=True, timeout=30)
    except (subprocess.TimeoutExpired, OSError):
        pass

    asset = GeneratedAsset(
        id=asset_id,
        project_id=project_id,
        asset_type=GenerateAssetType.VIDEO,
        name=f"Video: {prompt[:50]}",
        prompt=prompt,
        file_path=str(file_path),
        thumbnail_path=str(thumb_path) if thumb_path.exists() else "",
        duration_seconds=float(duration),
        file_size_bytes=file_size,
        metadata_json=json.dumps({"style": model, "duration": duration}),
    )
    db.create_generated_asset(asset)

    update_progress(job_id, project_id, 1.0, "Video generated!", "generate_video")
    return asset


async def run_generate_video_pair(
    project_id: str, job_id: str, prompt: str,
    model: str = "cinematic", duration: int = 5,
) -> list[GeneratedAsset]:
    """Generate 2 video options for the AI builder voting flow."""
    from services.grok_client import generate_video_pollinations
    from services.file_manager import generated_videos_dir

    update_progress(job_id, project_id, 0.05, "Generating AI images for option A...", "generate_video_pair")

    base_prompt = f"{VIDEO_STYLE_HINTS.get('minecraft', '')}{prompt}"

    # Generate sequentially to show progress per option
    update_progress(job_id, project_id, 0.1, "Creating option A...", "generate_video_pair")
    bytes_a = await generate_video_pollinations(f"{base_prompt}, version A", model=model, duration=duration)

    update_progress(job_id, project_id, 0.5, "Creating option B...", "generate_video_pair")
    bytes_b = await generate_video_pollinations(f"{base_prompt}, version B, different angle", model=model, duration=duration)

    update_progress(job_id, project_id, 0.9, "Saving videos...", "generate_video_pair")

    out_dir = generated_videos_dir(project_id)
    assets = []

    for i, (video_bytes, label) in enumerate([(bytes_a, "A"), (bytes_b, "B")]):
        if not video_bytes or len(video_bytes) < 1000:
            continue

        asset_id = new_id("gen_")
        file_path = out_dir / f"{asset_id}.mp4"
        file_path.write_bytes(video_bytes)

        thumb_path = out_dir / f"{asset_id}_thumb.jpg"
        try:
            subprocess.run([
                settings.FFMPEG_PATH, "-y", "-i", str(file_path),
                "-ss", "1", "-vframes", "1", "-vf", "scale=320:-1",
                str(thumb_path),
            ], capture_output=True, timeout=30)
        except (subprocess.TimeoutExpired, OSError):
            pass

        asset = GeneratedAsset(
            id=asset_id,
            project_id=project_id,
            asset_type=GenerateAssetType.VIDEO,
            name=f"Option {label}: {prompt[:50]}",
            prompt=prompt,
            file_path=str(file_path),
            thumbnail_path=str(thumb_path) if thumb_path.exists() else "",
            duration_seconds=float(duration),
            file_size_bytes=len(video_bytes),
            metadata_json=json.dumps({"style": model, "duration": duration, "option": label}),
        )
        db.create_generated_asset(asset)
        assets.append(asset)

    update_progress(job_id, project_id, 1.0, "2 options ready — pick your favorite!", "generate_video_pair")
    return assets
