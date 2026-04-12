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
    """Use Grok with function calling to generate a structured edit plan."""

    style = STYLE_CONFIGS[style_preset]

    # Build analysis summary for Grok
    clips_summary = []
    for analysis in analyses:
        clip_info = {"clip_id": analysis.clip_id}

        if analysis.video:
            v = analysis.video
            clip_info["scenes"] = [
                {"start": s.start_time, "end": s.end_time}
                for s in v.scenes
            ]
            clip_info["highlights"] = v.highlight_timestamps
            clip_info["avg_excitement"] = v.avg_excitement
            clip_info["frame_descriptions"] = [
                {
                    "timestamp": f.timestamp,
                    "categories": f.categories,
                    "excitement": f.excitement,
                    "description": f.description,
                }
                for f in v.frame_analyses
            ]

        if analysis.audio:
            a = analysis.audio
            clip_info["silence_segments"] = [
                {"start": s.start, "end": s.end}
                for s in a.silence_segments
            ]
            clip_info["game_events"] = [
                {"timestamp": e.timestamp, "type": e.event_type}
                for e in a.game_events
            ]

        clips_summary.append(clip_info)

    if progress_callback:
        progress_callback("Generating edit plan with AI...")

    system_prompt = f"""You are an expert Minecraft YouTube video editor.
Style preset: {style_preset.value} - {style['description']}

EDITING RULES:
- Minimum segment duration: {style['min_segment_duration']}s
- Maximum segment duration: {style['max_segment_duration']}s
- Preferred transition: {style['transition_style']}
- SFX density: {style['sfx_density']}
- Music style: {style['music_style']}

PRIORITIES:
1. Remove boring parts (IDLE, INVENTORY, long silence)
2. Keep all highlights (excitement >= 7)
3. Order segments for engaging flow (hook first, build tension, climax)
4. Add appropriate effects and SFX for the style
5. Start with the most exciting moment (hook)
6. Keep total duration around {target_duration or 'auto (3-8 minutes)'}s

AVAILABLE SFX: mining, explosion, mob_hit, mob_death, player_damage, item_pickup,
chest_open, portal, achievement, transition_whoosh, bass_drop, funny_fail, oof, bruh,
ding, pop, woosh

Call the create_edit_plan function with your editing decisions.
{f'{chr(10)}USER INSTRUCTIONS: {custom_prompt}' if custom_prompt else ''}"""

    try:
        result = await chat_completion(
            messages=[
                {"role": "system", "content": system_prompt + "\n\nRespond with ONLY valid JSON (no markdown, no code fences). The JSON must have: segments (array), background_music (string), reasoning (string)."},
                {
                    "role": "user",
                    "content": (
                        f"Here are the analyzed clips:\n\n"
                        f"{json.dumps(clips_summary, indent=2)}\n\n"
                        f"Create an optimized edit plan for a {style_preset.value} Minecraft YouTube video. "
                        f"Return ONLY the JSON object."
                    ),
                },
            ],
            temperature=0.7,
            max_tokens=8192,
        )

        # Parse JSON from response
        content = result.get("content", "")
        try:
            # Strip markdown code fences if present
            clean = content.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
                clean = clean.rsplit("```", 1)[0]
            start = clean.find("{")
            end = clean.rfind("}") + 1
            if start >= 0 and end > start:
                args = json.loads(clean[start:end])
            else:
                args = _fallback_plan(analyses, style_preset, target_duration)
        except (json.JSONDecodeError, ValueError):
            args = _fallback_plan(analyses, style_preset, target_duration)
    except Exception as e:
        print(f"AI API failed for plan generation ({e}), using fallback planner")
        if progress_callback:
            progress_callback("AI unavailable, generating plan locally...")
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


def _fallback_plan(
    analyses: list[AnalysisResult],
    style_preset: StylePreset,
    target_duration: Optional[float],
) -> dict:
    """Generate a basic plan from highlights when AI fails."""
    segments = []
    for analysis in analyses:
        if not analysis.video:
            continue
        for scene in analysis.video.scenes:
            # Find excitement for this scene
            excitement = 5
            for fa in analysis.video.frame_analyses:
                if scene.start_time <= fa.timestamp <= scene.end_time:
                    excitement = fa.excitement
                    break
            if excitement >= 5:  # Keep moderately interesting scenes
                segments.append({
                    "clip_id": analysis.clip_id,
                    "start_time": scene.start_time,
                    "end_time": scene.end_time,
                    "label": f"Scene (excitement: {excitement})",
                    "transition_in": "cut",
                    "effects": [],
                    "sfx": [],
                })

    return {
        "segments": segments,
        "background_music": STYLE_CONFIGS[style_preset]["music_style"],
        "music_volume": 0.3,
        "reasoning": "Fallback plan: included all scenes with excitement >= 5",
    }
