"""Stage 2: Video Analysis — scene detection, motion, and frame classification.

All heavy imports (cv2, numpy, scenedetect) are lazy-loaded to avoid eating
memory at startup on free-tier servers (512 MB Render).
"""

from __future__ import annotations

import json
from pathlib import Path

from models import FrameAnalysis, SceneSegment, VideoAnalysis


def _get_clip_duration(clip_path: str) -> float:
    """Get clip duration using ffprobe (lightweight), falling back to OpenCV."""
    try:
        from services.ffmpeg_service import probe
        probe_data = probe(clip_path)
        return float(probe_data.get("format", {}).get("duration", 0))
    except Exception:
        pass
    try:
        import cv2
        cap = cv2.VideoCapture(clip_path)
        if cap.isOpened():
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            cap.release()
            return frames / fps if fps > 0 else 0
    except Exception:
        pass
    return 0.0


def detect_scenes_lightweight(clip_path: str, segment_length: float = 10.0) -> list[SceneSegment]:
    """Split video into time-based segments using only ffprobe (no OpenCV).
    This is the memory-safe default for free-tier servers."""
    duration = _get_clip_duration(clip_path)
    if duration <= 0:
        duration = 30.0  # Assume 30s if we can't probe

    scenes = []
    t = 0.0
    while t < duration:
        end = min(t + segment_length, duration)
        scenes.append(SceneSegment(start_time=t, end_time=end))
        t = end
    return scenes


def detect_scenes(clip_path: str, threshold: float = 27.0) -> list[SceneSegment]:
    """Use PySceneDetect to find scene boundaries. Falls back to lightweight splitting."""
    try:
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
    except Exception as e:
        print(f"SceneDetect failed ({e}), falling back to time-based splitting")
        return detect_scenes_lightweight(clip_path)


def classify_frame_local(frame_path: str, motion_score: float = 0.0) -> dict:
    """Classify a Minecraft gameplay frame using OpenCV heuristics (no API needed).

    Detects: combat/action, death screens, inventory, portals, builds, exploration
    based on color distribution, brightness, edges, and motion score.
    """
    import cv2
    import numpy as np

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

    # Color masks in HSV
    red_low1 = cv2.inRange(hsv, (0, 80, 80), (10, 255, 255))
    red_low2 = cv2.inRange(hsv, (170, 80, 80), (180, 255, 255))
    red_pct = (np.count_nonzero(red_low1) + np.count_nonzero(red_low2)) / (h * w)

    purple_mask = cv2.inRange(hsv, (120, 50, 50), (160, 255, 255))
    purple_pct = float(np.count_nonzero(purple_mask)) / (h * w)

    green_mask = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
    green_pct = float(np.count_nonzero(green_mask)) / (h * w)

    blue_mask = cv2.inRange(hsv, (90, 40, 40), (130, 255, 255))
    blue_pct = float(np.count_nonzero(blue_mask)) / (h * w)

    gray_mask = cv2.inRange(hsv, (0, 0, 60), (180, 40, 200))
    gray_pct = float(np.count_nonzero(gray_mask)) / (h * w)

    orange_mask = cv2.inRange(hsv, (10, 80, 80), (30, 255, 255))
    orange_pct = float(np.count_nonzero(orange_mask)) / (h * w)

    dark_pct = float(np.count_nonzero(gray < 30)) / (h * w)
    bright_pct = float(np.count_nonzero(gray > 220)) / (h * w)

    center = gray[h // 3 : 2 * h // 3, w // 4 : 3 * w // 4]
    center_std = float(np.std(center))

    # Free large arrays immediately
    del img, hsv, edges, red_low1, red_low2, purple_mask, green_mask
    del blue_mask, gray_mask, orange_mask, center

    # --- Classify ---
    categories = []
    excitement = 5
    description = ""

    if red_pct > 0.35:
        categories.append("DEATH")
        excitement = 8
        description = "Death screen detected (red overlay)"
    elif gray_pct > 0.4 and center_std < 40 and edge_density > 0.05:
        categories.append("INVENTORY")
        excitement = 2
        description = "Inventory or crafting screen"
    elif purple_pct > 0.08:
        categories.append("TRANSITION")
        excitement = 6
        description = "Portal or enchanting detected (purple hues)"
    elif (orange_pct > 0.1 or (red_pct > 0.1 and bright_pct > 0.15)) and motion_score > 0.3:
        categories.append("ACTION")
        excitement = 9
        description = "Explosion or fire with high motion"
    elif motion_score > 0.5:
        categories.append("ACTION")
        excitement = 8
        description = f"High-action moment (motion={motion_score:.2f})"
    elif dark_pct > 0.4 and motion_score > 0.15:
        categories.append("EXPLORATION")
        excitement = 6
        description = "Cave exploration (dark environment with movement)"
    elif green_pct > 0.25 and motion_score > 0.1:
        categories.append("EXPLORATION")
        excitement = 5
        description = "Overworld exploration (green terrain)"
    elif blue_pct > 0.3:
        categories.append("EXPLORATION")
        excitement = 5
        description = "Water or ocean area"
    elif edge_density > 0.15 and 0.05 < motion_score < 0.35:
        categories.append("BUILD")
        excitement = 4
        description = "Building or detailed structure visible"
    elif motion_score > 0.2:
        categories.append("ACTION")
        excitement = 6
        description = f"Moderate action (motion={motion_score:.2f})"
    elif brightness > 100 and saturation > 50:
        categories.append("IDLE")
        excitement = 3
        description = "Calm outdoor scene"
    else:
        categories.append("IDLE")
        excitement = 3
        description = "Low activity scene"

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

    if "categories" in result and "excitement" in result:
        cats = result["categories"]
        if isinstance(cats, str):
            cats = [cats]
        return {
            "categories": cats,
            "excitement": int(result.get("excitement", 5)),
            "description": result.get("description", "AI analyzed frame"),
        }

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
    lightweight: bool = False,
) -> VideoAnalysis:
    """Full video analysis for a single clip.

    If lightweight=True, skips OpenCV-heavy operations (motion analysis,
    frame extraction/classification) to stay within free-tier memory limits.
    Uses only ffprobe for duration + time-based scene splitting.
    """

    from pathlib import Path as _Path
    if not _Path(clip_path).exists():
        raise FileNotFoundError(f"Clip file not found: {clip_path}")

    # Step 1: Scene detection
    if progress_callback:
        progress_callback("Detecting scenes...")

    if lightweight:
        scenes = detect_scenes_lightweight(clip_path)
    else:
        scenes = detect_scenes(clip_path)

    if not scenes:
        duration = _get_clip_duration(clip_path)
        if duration > 0:
            scenes = [SceneSegment(start_time=0.0, end_time=duration)]
        else:
            scenes = [SceneSegment(start_time=0.0, end_time=30.0)]

    # Lightweight mode: skip expensive OpenCV operations
    if lightweight:
        frame_analyses = []
        for i, scene in enumerate(scenes):
            ts = (scene.start_time + scene.end_time) / 2
            frame_analyses.append(FrameAnalysis(
                timestamp=ts, categories=["IDLE"], excitement=5,
                description=f"Scene {i+1}", frame_path="",
            ))
        return VideoAnalysis(
            clip_id=clip_id,
            scenes=scenes,
            motion_scores=[],
            frame_analyses=frame_analyses,
            avg_excitement=5.0,
            highlight_timestamps=[],
        )

    # Step 2: Motion analysis — optional, skip on failure
    motion_scores = []
    if progress_callback:
        progress_callback("Analyzing motion...")
    try:
        from utils.motion_analyzer import analyze_motion
        motion_scores = analyze_motion(clip_path)
    except Exception as e:
        print(f"Motion analysis failed (non-fatal): {e}")

    def get_motion_at(ts: float) -> float:
        if not motion_scores:
            return 0.0
        closest = min(motion_scores, key=lambda m: abs(m.timestamp - ts))
        return closest.score

    # Step 3: Extract keyframes — optional, skip on failure
    if progress_callback:
        progress_callback("Extracting keyframes...")
    timestamps = [(s.start_time + s.end_time) / 2 for s in scenes]
    try:
        from utils.frame_extractor import extract_keyframes
        frame_paths = extract_keyframes(clip_path, project_id, clip_id, timestamps)
    except Exception as e:
        print(f"Frame extraction failed (non-fatal): {e}")
        frame_paths = []

    # Step 4: Frame classification
    if progress_callback:
        progress_callback("Classifying frames...")
    frame_analyses = []

    if frame_paths:
        for path, ts in zip(frame_paths, timestamps):
            try:
                motion = get_motion_at(ts)
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
                    timestamp=ts, categories=["IDLE"], excitement=3,
                    description=f"Classification error: {e}", frame_path=str(path),
                ))

    if not frame_analyses:
        for i, scene in enumerate(scenes):
            ts = (scene.start_time + scene.end_time) / 2
            frame_analyses.append(FrameAnalysis(
                timestamp=ts, categories=["IDLE"], excitement=5,
                description=f"Scene {i+1}", frame_path="",
            ))

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
