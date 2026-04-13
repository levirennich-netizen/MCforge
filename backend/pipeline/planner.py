"""Stage 4: AI Edit Planning — Grok generates structured edit plans via function calling."""

from __future__ import annotations

import json
from typing import Optional

from models import (
    AnalysisResult,
    EditPlan,
    EditSegment,
    Effect,
    SoundEffect,
    StylePreset,
)
from services.grok_client import chat_completion

STYLE_CONFIGS = {
    StylePreset.FUNNY: {
        "min_segment_duration": 1.5,
        "max_segment_duration": 8.0,
        "transition_style": "jump_cut",
        "zoom_probability": 0.4,
        "sfx_density": "high",
        "music_style": "upbeat",
        "description": "Fast-paced, lots of jump cuts, zoom-ins on reactions, meme sound effects",
    },
    StylePreset.HIGH_ENERGY: {
        "min_segment_duration": 1.0,
        "max_segment_duration": 6.0,
        "transition_style": "rapid_fade",
        "zoom_probability": 0.3,
        "sfx_density": "medium",
        "music_style": "electronic/EDM",
        "description": "Rapid cuts, bass drops, high energy transitions, minimal dead time",
    },
    StylePreset.CINEMATIC: {
        "min_segment_duration": 3.0,
        "max_segment_duration": 15.0,
        "transition_style": "crossfade",
        "zoom_probability": 0.1,
        "sfx_density": "low",
        "music_style": "ambient/orchestral",
        "description": "Smooth transitions, longer shots, ambient music, clean professional feel",
    },
}

EDIT_PLAN_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_edit_plan",
            "description": "Create a video edit plan from analyzed Minecraft footage",
            "parameters": {
                "type": "object",
                "properties": {
                    "segments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "clip_id": {"type": "string"},
                                "start_time": {"type": "number"},
                                "end_time": {"type": "number"},
                                "label": {"type": "string", "description": "Short label for this segment"},
                                "transition_in": {
                                    "type": "string",
                                    "enum": ["cut", "crossfade", "fade_black", "zoom_in", "swipe"],
                                },
                                "transition_duration": {"type": "number", "description": "Duration in seconds"},
                                "effects": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "type": {"type": "string", "enum": ["zoom", "shake", "slow_mo", "speed_up"]},
                                            "start_offset": {"type": "number"},
                                            "duration": {"type": "number"},
                                            "intensity": {"type": "number"},
                                        },
                                        "required": ["type", "start_offset", "duration"],
                                    },
                                },
                                "sfx": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "sound": {"type": "string"},
                                            "offset": {"type": "number"},
                                            "volume": {"type": "number"},
                                        },
                                        "required": ["sound", "offset"],
                                    },
                                },
                                "subtitle_text": {"type": "string"},
                                "speed_factor": {"type": "number", "description": "1.0 = normal speed"},
                            },
                            "required": ["clip_id", "start_time", "end_time", "label", "transition_in"],
                        },
                    },
                    "background_music": {
                        "type": "string",
                        "description": "Music style recommendation",
                    },
                    "music_volume": {
                        "type": "number",
                        "description": "0.0 to 1.0",
                    },
                    "total_duration_target": {
                        "type": "number",
                        "description": "Target output duration in seconds",
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Explain your editing decisions",
                    },
                },
                "required": ["segments", "background_music", "reasoning"],
            },
        },
    }
]


async def generate_edit_plan(
    project_id: str,
    analyses: list[AnalysisResult],
    style_preset: StylePreset,
    target_duration: Optional[float] = None,
    custom_prompt: str = "",
    progress_callback=None,
) -> EditPlan:
    """Generate a structured edit plan — uses AI if available, local analysis otherwise."""

    style = STYLE_CONFIGS[style_preset]

    if progress_callback:
        progress_callback("Generating edit plan...")

    # Use AI if a valid API key is configured, otherwise go straight to local planner
    from config import settings
    has_ai = bool(settings.GROQ_API_KEY) or bool(settings.GEMINI_API_KEY) or (
        settings.XAI_API_KEY and settings.XAI_API_KEY != "xai-your-key-here"
    )

    args = None
    if has_ai:
        try:
            args = await _ai_plan(analyses, style_preset, style, target_duration, custom_prompt)
        except Exception as e:
            print(f"AI planner failed ({e}), using local planner")

    if args is None:
        if progress_callback:
            progress_callback("Building edit plan from analysis...")
        args = _fallback_plan(analyses, style_preset, target_duration)

    # Convert to EditPlan model
    segments = []
    timeline_pos = 0.0
    for s in args.get("segments", []):
        effects = [
            Effect(type=e["type"], start_offset=e.get("start_offset", 0),
                   duration=e.get("duration", 1), intensity=e.get("intensity", 1.0))
            for e in s.get("effects", [])
        ]
        sfx = [
            SoundEffect(sound=sf["sound"], offset=sf.get("offset", 0),
                        volume=sf.get("volume", 0.7))
            for sf in s.get("sfx", [])
        ]
        seg_duration = (s["end_time"] - s["start_time"]) / s.get("speed_factor", 1.0)
        segment = EditSegment(
            clip_id=s["clip_id"],
            start_time=s["start_time"],
            end_time=s["end_time"],
            timeline_position=timeline_pos,
            label=s.get("label", ""),
            transition_in=s.get("transition_in", "cut"),
            transition_duration=s.get("transition_duration", 0.0),
            effects=effects,
            sfx=sfx,
            subtitle_text=s.get("subtitle_text"),
            speed_factor=s.get("speed_factor", 1.0),
        )
        segments.append(segment)
        timeline_pos += seg_duration

    return EditPlan(
        project_id=project_id,
        style_preset=style_preset,
        segments=segments,
        background_music=args.get("background_music", style["music_style"]),
        music_volume=args.get("music_volume", 0.3),
        total_duration=timeline_pos,
        reasoning=args.get("reasoning", "AI-generated edit plan"),
    )


async def _ai_plan(
    analyses: list[AnalysisResult],
    style_preset: StylePreset,
    style: dict,
    target_duration: Optional[float],
    custom_prompt: str,
) -> dict:
    """Generate plan using AI API."""
    clips_summary = []
    for analysis in analyses:
        clip_info = {"clip_id": analysis.clip_id}
        if analysis.video:
            v = analysis.video
            clip_info["scenes"] = [{"start": s.start_time, "end": s.end_time} for s in v.scenes]
            clip_info["highlights"] = v.highlight_timestamps
            clip_info["avg_excitement"] = v.avg_excitement
            clip_info["frame_descriptions"] = [
                {"timestamp": f.timestamp, "categories": f.categories, "excitement": f.excitement}
                for f in v.frame_analyses
            ]
        clips_summary.append(clip_info)

    system_prompt = (
        f"You are an expert Minecraft YouTube video editor.\n"
        f"Style: {style_preset.value} - {style['description']}\n"
        f"Segment duration: {style['min_segment_duration']}-{style['max_segment_duration']}s\n"
        f"Target duration: {target_duration or '3-8 minutes'}\n"
        f"{f'USER INSTRUCTIONS: {custom_prompt}' if custom_prompt else ''}\n\n"
        f"Respond with ONLY valid JSON: {{\"segments\": [...], \"background_music\": \"...\", \"reasoning\": \"...\"}}\n"
        f"Each segment: {{\"clip_id\", \"start_time\", \"end_time\", \"label\", \"transition_in\": \"cut\", \"speed_factor\": 1.0}}"
    )

    result = await chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Clips:\n{json.dumps(clips_summary, indent=2)}"},
        ],
        temperature=0.7,
        max_tokens=8192,
    )

    content = result.get("content", "")
    clean = content.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
        clean = clean.rsplit("```", 1)[0]
    start = clean.find("{")
    end = clean.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(clean[start:end])
    raise ValueError("AI returned no valid JSON")


def _fallback_plan(
    analyses: list[AnalysisResult],
    style_preset: StylePreset,
    target_duration: Optional[float],
) -> dict:
    """Generate a plan locally from scene analysis — no AI needed."""
    style = STYLE_CONFIGS[style_preset]
    min_dur = style["min_segment_duration"]
    max_dur = style["max_segment_duration"]

    # Collect all scenes with their excitement scores
    scored_scenes = []
    for analysis in analyses:
        if not analysis.video:
            continue

        if analysis.video.scenes:
            for scene in analysis.video.scenes:
                # Find best excitement score for this scene
                best_excitement = 3
                for fa in analysis.video.frame_analyses:
                    if scene.start_time <= fa.timestamp <= scene.end_time:
                        best_excitement = max(best_excitement, fa.excitement)
                duration = scene.end_time - scene.start_time
                if duration >= min_dur:
                    scored_scenes.append({
                        "clip_id": analysis.clip_id,
                        "start_time": scene.start_time,
                        "end_time": min(scene.end_time, scene.start_time + max_dur),
                        "excitement": best_excitement,
                    })
        else:
            # No scenes detected — use the whole clip
            scored_scenes.append({
                "clip_id": analysis.clip_id,
                "start_time": 0.0,
                "end_time": max_dur,  # Cap at max segment duration
                "excitement": analysis.video.avg_excitement if analysis.video else 5,
            })

    # If still nothing, create a segment from each analysis clip
    if not scored_scenes:
        for analysis in analyses:
            scored_scenes.append({
                "clip_id": analysis.clip_id,
                "start_time": 0.0,
                "end_time": 10.0,
                "excitement": 5,
            })

    # Sort by excitement (highest first = hook), then keep within target duration
    scored_scenes.sort(key=lambda s: s["excitement"], reverse=True)

    target = target_duration or 120.0  # Default 2 minutes
    segments = []
    total_dur = 0.0
    for scene in scored_scenes:
        seg_dur = scene["end_time"] - scene["start_time"]
        if total_dur + seg_dur > target and segments:
            break
        segments.append({
            "clip_id": scene["clip_id"],
            "start_time": scene["start_time"],
            "end_time": scene["end_time"],
            "label": f"Scene (excitement: {scene['excitement']})",
            "transition_in": "cut",
            "effects": [],
            "sfx": [],
            "speed_factor": 1.0,
        })
        total_dur += seg_dur

    return {
        "segments": segments,
        "background_music": style["music_style"],
        "music_volume": 0.3,
        "reasoning": f"Local planner: {len(segments)} scenes sorted by excitement, target {target}s",
    }
