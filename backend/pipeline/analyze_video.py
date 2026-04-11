"""Stage 2: Video Analysis — scene detection, motion, and AI/local frame classification."""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

from models import FrameAnalysis, SceneSegment, VideoAnalysis
from utils.frame_extractor import extract_keyframes
from utils.motion_analyzer import analyze_motion


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


def classify_frame_local(frame_path: str, motion_score: float = 0.0) -> dict:
    """Classify a Minecraft gameplay frame using OpenCV heuristics (no API needed).

    Detects: combat/action, death screens, inventory, portals, builds, exploration
    based on color distribution, brightness, edges, and motion score.
    """
    img = cv2.imread(frame_path)
    if img is None:
        return {"categories": ["IDLE"], "excitement": 3, "description": "Could not read frame"}

    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # --- Compute features ---
    brightness = float(np.mean(gray))
    saturation = float(np.mean(hsv[:, :, 1]))
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.count_nonzero(edges)) / (h * w)

    # Color channel means (BGR)
    b_mean = float(np.mean(img[:, :, 0]))
    g_mean = float(np.mean(img[:, :, 1]))
    r_mean = float(np.mean(img[:, :, 2]))

    # Color masks in HSV
    # Red tones (death screen, lava, fire)
    red_low1 = cv2.inRange(hsv, (0, 80, 80), (10, 255, 255))
    red_low2 = cv2.inRange(hsv, (170, 80, 80), (180, 255, 255))
    red_pct = (np.count_nonzero(red_low1) + np.count_nonzero(red_low2)) / (h * w)

    # Purple tones (nether portal, enchanting)
    purple_mask = cv2.inRange(hsv, (120, 50, 50), (160, 255, 255))
    purple_pct = float(np.count_nonzero(purple_mask)) / (h * w)

    # Green tones (grass, creepers, overworld)
    green_mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
    green_pct = float(np.count_nonzero(green_mask)) / (h * w)

    # Blue/cyan tones (water, sky, diamond)
    blue_mask = cv2.inRange(hsv, (90, 40, 40), (130, 255, 255))
    blue_pct = float(np.count_nonzero(blue_mask)) / (h * w)

    # Gray tones (stone, inventory background)
    gray_mask = cv2.inRange(hsv, (0, 0, 60), (180, 40, 200))
    gray_pct = float(np.count_nonzero(gray_mask)) / (h * w)

    # Orange/yellow tones (lava, fire, gold, sunset)
    orange_mask = cv2.inRange(hsv, (10, 80, 80), (30, 255, 255))
    orange_pct = float(np.count_nonzero(orange_mask)) / (h * w)

    # Very dark pixels (caves, night)
    dark_pct = float(np.count_nonzero(gray < 30)) / (h * w)

    # Very bright pixels (explosions, sky)
    bright_pct = float(np.count_nonzero(gray > 220)) / (h * w)

    # GUI detection: check center third for uniform rectangular regions
    center = gray[h // 3 : 2 * h // 3, w // 4 : 3 * w // 4]
    center_std = float(np.std(center))

    # --- Classify ---
    categories = []
    excitement = 5
    description = ""

    # Death screen: heavy red overlay, often with text
    if red_pct > 0.35:
        categories.append("DEATH")
        excitement = 8
        description = "Death screen detected (red overlay)"

    # Inventory / crafting screen: structured grid, low edge variation in center, gray-heavy
    elif gray_pct > 0.4 and center_std < 40 and edge_density > 0.05:
        categories.append("INVENTORY")
        excitement = 2
        description = "Inventory or crafting screen"

    # Portal / enchanting: significant purple
    elif purple_pct > 0.08:
        categories.append("TRANSITION")
        excitement = 6
        description = "Portal or enchanting detected (purple hues)"

    # Explosion / fire: bright + orange/red + high motion
    elif (orange_pct > 0.1 or (red_pct > 0.1 and bright_pct > 0.15)) and motion_score > 0.3:
        categories.append("ACTION")
        excitement = 9
        description = "Explosion or fire with high motion"

    # High-action combat: high motion + moderate edge density
    elif motion_score > 0.5:
        categories.append("ACTION")
        excitement = 8
        description = f"High-action moment (motion={motion_score:.2f})"

    # Cave / dark area with moderate motion = exploration
    elif dark_pct > 0.4 and motion_score > 0.15:
        categories.append("EXPLORATION")
        excitement = 6
        description = "Cave exploration (dark environment with movement)"

    # Lush/green outdoors with motion = exploration
    elif green_pct > 0.25 and motion_score > 0.1:
        categories.append("EXPLORATION")
        excitement = 5
        description = "Overworld exploration (green terrain)"

    # Water / ocean = exploration
    elif blue_pct > 0.3:
        categories.append("EXPLORATION")
        excitement = 5
        description = "Water or ocean area"

    # High edge density + moderate motion = building
    elif edge_density > 0.15 and 0.05 < motion_score < 0.35:
        categories.append("BUILD")
        excitement = 4
        description = "Building or detailed structure visible"

    # Moderate motion, nothing special
    elif motion_score > 0.2:
        categories.append("ACTION")
        excitement = 6
        description = f"Moderate action (motion={motion_score:.2f})"

    # Low motion outdoor
    elif brightness > 100 and saturation > 50:
        categories.append("IDLE")
        excitement = 3
        description = "Calm outdoor scene"

    # Default
    else:
        categories.append("IDLE")
        excitement = 3
        description = "Low activity scene"

    # Boost excitement for very bright flashes (possible explosion/achievement)
    if bright_pct > 0.3 and excitement < 7:
        excitement = 7
        if "ACTION" not in categories:
            categories.append("ACTION")
        description += " with bright flash"

    return {
        "categories": categories,
        "excitement": excitement,
        "description": description,
    }


async def _classify_frame_ai(frame_path: str, motion_score: float) -> dict:
    """Use AI vision to classify a Minecraft gameplay frame."""
    from services.grok_client import analyze_image

    prompt = (
        "Analyze this Minecraft gameplay screenshot. Respond with ONLY a JSON object:\n"
        '{"categories": ["ACTION"|"DEATH"|"BUILD"|"EXPLORATION"|"INVENTORY"|"TRANSITION"|"IDLE"], '
        '"excitement": 1-10, '
        '"description": "brief description of what is happening"}\n\n'
        "Categories:\n"
        "- ACTION: combat, PvP, explosions, mob fights, intense moments\n"
        "- DEATH: death screen, respawn, 'You Died'\n"
        "- BUILD: building, placing blocks, constructing\n"
        "- EXPLORATION: traveling, discovering, caves, ocean, nether\n"
        "- INVENTORY: crafting table, inventory screen, chest UI\n"
        "- TRANSITION: portal, loading, dimension change\n"
        "- IDLE: standing still, AFK, menu screen\n\n"
        f"Motion score: {motion_score:.2f} (0=still, 1=very fast)\n"
        "Return ONLY the JSON, no other text."
    )

    result = await analyze_image(frame_path, prompt)

    # If we got a parsed dict with expected keys, use it
    if "categories" in result and "excitement" in result:
        cats = result["categories"]
        if isinstance(cats, str):
            cats = [cats]
        return {
            "categories": cats,
            "excitement": int(result.get("excitement", 5)),
            "description": result.get("description", "AI analyzed frame"),
        }

    # Try parsing from raw text
    raw = result.get("raw", "")
    if raw:
        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                parsed = json.loads(raw[start:end])
                cats = parsed.get("categories", ["IDLE"])
                if isinstance(cats, str):
                    cats = [cats]
                return {
                    "categories": cats,
                    "excitement": int(parsed.get("excitement", 5)),
                    "description": parsed.get("description", "AI analyzed frame"),
                }
        except (json.JSONDecodeError, ValueError):
            pass

    raise ValueError("Could not parse AI vision response")


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

    # Build a quick lookup: timestamp -> nearest motion score
    def get_motion_at(ts: float) -> float:
        if not motion_scores:
            return 0.0
        closest = min(motion_scores, key=lambda m: abs(m.timestamp - ts))
        return closest.score

    # Step 3: Extract keyframes (1 per scene, at midpoint)
    if progress_callback:
        progress_callback("Extracting keyframes...")
    timestamps = [(s.start_time + s.end_time) / 2 for s in scenes]
    frame_paths = extract_keyframes(clip_path, project_id, clip_id, timestamps)

    # Step 4: Frame classification — AI vision if available, else local OpenCV
    if progress_callback:
        progress_callback("Classifying frames with AI...")
    frame_analyses = []

    # Try AI vision for all frames in one batch-style approach
    ai_available = False
    try:
        from config import settings
        if settings.GROQ_API_KEY or settings.GEMINI_API_KEY:
            ai_available = True
    except Exception:
        pass

    for i, (path, ts) in enumerate(zip(frame_paths, timestamps)):
        try:
            motion = get_motion_at(ts)
            result = None

            # Try AI vision first
            if ai_available:
                try:
                    result = await _classify_frame_ai(str(path), motion)
                except Exception as e:
                    print(f"AI vision failed for frame {i} ({e}), using local")

            # Fallback to local OpenCV
            if result is None:
                result = classify_frame_local(str(path), motion_score=motion)

            frame_analyses.append(FrameAnalysis(
                timestamp=ts,
                categories=result.get("categories", ["IDLE"]),
                excitement=result.get("excitement", 5),
                description=result.get("description", ""),
                frame_path=str(path),
            ))
        except Exception as e:
            frame_analyses.append(FrameAnalysis(
                timestamp=ts,
                categories=["IDLE"],
                excitement=3,
                description=f"Classification error: {e}",
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
