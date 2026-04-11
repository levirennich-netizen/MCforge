"""Stage 2: Video Analysis — scene detection, motion, and AI frame classification."""

from __future__ import annotations

from pathlib import Path

from models import FrameAnalysis, SceneSegment, VideoAnalysis
from services.grok_client import analyze_image
from utils.frame_extractor import extract_keyframes
from utils.motion_analyzer import analyze_motion

FRAME_ANALYSIS_PROMPT = """You are analyzing a Minecraft gameplay screenshot for video editing.
Classify this frame into one or more categories:
- ACTION: PvP combat, mob fighting, explosions, TNT
- EXPLORATION: New biome, cave discovery, ocean monument, stronghold
- BUILD: Construction, redstone, farming
- LOOT: Chest opening, rare drops, enchanting, diamonds
- FUNNY: Unusual situations, glitches, unexpected events
- DEATH: Player death screen
- INVENTORY: Inventory/crafting screen (usually boring)
- TRANSITION: Loading screen, dimension portal
- IDLE: Standing still, AFK, staring at wall

Rate excitement from 1-10. Describe what's happening in 1 sentence.

Respond ONLY in JSON: {"categories": ["ACTION"], "excitement": 8, "description": "Player fighting a creeper in a cave"}"""


def detect_scenes(clip_path: str, threshold: float = 27.0) -> list[SceneSegment]:
    """Use PySceneDetect to find scene boundaries."""
    from scenedetect import detect, ContentDetector

    scenes = detect(clip_path, ContentDetector(threshold=threshold))
    return [
        SceneSegment(
            start_time=scene[0].get_seconds(),
            end_time=scene[1].get_seconds(),
            start_frame=scene[0].frame_num,
            end_frame=scene[1].frame_num,
        )
        for scene in scenes
    ]


async def analyze_clip(
    clip_id: str,
    clip_path: str,
    project_id: str,
    progress_callback=None,
) -> VideoAnalysis:
    """Full video analysis for a single clip."""

    # Step 1: Scene detection
    if progress_callback:
        progress_callback("Detecting scenes...")
    scenes = detect_scenes(clip_path)

    # If no scenes detected, treat the whole clip as one scene
    if not scenes:
        from services.ffmpeg_service import probe
        probe_data = probe(clip_path)
        duration = float(probe_data.get("format", {}).get("duration", 0))
        scenes = [SceneSegment(start_time=0.0, end_time=duration)]

    # Step 2: Motion analysis
    if progress_callback:
        progress_callback("Analyzing motion...")
    motion_scores = analyze_motion(clip_path)

    # Step 3: Extract keyframes (1 per scene, at midpoint)
    if progress_callback:
        progress_callback("Extracting keyframes...")
    timestamps = [(s.start_time + s.end_time) / 2 for s in scenes]
    frame_paths = extract_keyframes(clip_path, project_id, clip_id, timestamps)

    # Step 4: AI frame analysis via Grok Vision
    if progress_callback:
        progress_callback("AI analyzing frames...")
    frame_analyses = []
    for i, (path, ts) in enumerate(zip(frame_paths, timestamps)):
        try:
            result = analyze_image(str(path), FRAME_ANALYSIS_PROMPT)
            # Handle if result is a coroutine
            import asyncio
            if asyncio.iscoroutine(result):
                result = await result

            frame_analyses.append(FrameAnalysis(
                timestamp=ts,
                categories=result.get("categories", ["IDLE"]),
                excitement=result.get("excitement", 5),
                description=result.get("description", ""),
                frame_path=str(path),
            ))
        except Exception as e:
            # If AI fails for a frame, add a default analysis
            frame_analyses.append(FrameAnalysis(
                timestamp=ts,
                categories=["IDLE"],
                excitement=5,
                description=f"Analysis failed: {e}",
                frame_path=str(path),
            ))

    # Compute highlights
    avg_excitement = (
        sum(f.excitement for f in frame_analyses) / len(frame_analyses)
        if frame_analyses else 5.0
    )
    highlight_timestamps = [
        f.timestamp for f in frame_analyses if f.excitement >= 7
    ]

    return VideoAnalysis(
        clip_id=clip_id,
        scenes=scenes,
        motion_scores=motion_scores,
        frame_analyses=frame_analyses,
        avg_excitement=avg_excitement,
        highlight_timestamps=highlight_timestamps,
    )
