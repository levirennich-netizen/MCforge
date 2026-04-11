"""Stage 3: Audio Analysis — silence detection, transcription, game event classification."""

from __future__ import annotations

import json
from typing import Optional

from models import AudioAnalysis, GameEvent, Transcription, VideoAnalysis
from services.grok_client import chat_completion
from utils.audio_utils import detect_silence, transcribe_audio


async def analyze_clip_audio(
    clip_id: str,
    audio_path: str,
    video_analysis: Optional[VideoAnalysis] = None,
    whisper_model: str = "base",
    progress_callback=None,
) -> AudioAnalysis:
    """Full audio analysis for a single clip."""

    # Step 1: Silence detection
    if progress_callback:
        progress_callback("Detecting silence...")
    silence_segments = detect_silence(audio_path)

    # Step 2: Transcription
    transcription = None
    if progress_callback:
        progress_callback("Transcribing speech...")
    try:
        language, words = transcribe_audio(audio_path, whisper_model)
        transcription = Transcription(language=language, words=words)
    except Exception as e:
        print(f"Transcription failed: {e}")

    # Step 3: Game event classification via Grok
    game_events = []
    if video_analysis and video_analysis.frame_analyses:
        if progress_callback:
            progress_callback("Classifying game events for SFX...")
        try:
            game_events = await classify_game_events(video_analysis)
        except Exception as e:
            print(f"Game event classification failed: {e}")

    return AudioAnalysis(
        clip_id=clip_id,
        silence_segments=silence_segments,
        transcription=transcription,
        game_events=game_events,
    )


async def classify_game_events(video_analysis: VideoAnalysis) -> list[GameEvent]:
    """Use Grok to map frame analysis results to Minecraft game events for SFX."""
    frames_summary = [
        {
            "timestamp": f.timestamp,
            "categories": f.categories,
            "excitement": f.excitement,
            "description": f.description,
        }
        for f in video_analysis.frame_analyses
    ]

    result = await chat_completion(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a Minecraft video editor assistant. Given analysis of video frames, "
                    "identify moments where sound effects should be added. "
                    "Only identify events you're confident about."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Here are analysis results from a Minecraft gameplay clip:\n\n"
                    f"{json.dumps(frames_summary, indent=2)}\n\n"
                    f"Identify moments where sound effects should be added. For each moment, specify:\n"
                    f"- timestamp (from the frame timestamps above)\n"
                    f"- event_type: one of [mining, explosion, mob_hit, mob_death, player_damage, "
                    f"item_pickup, chest_open, portal, achievement, transition_whoosh, bass_drop, "
                    f"funny_fail, oof, bruh]\n"
                    f"- confidence: 0.0-1.0\n\n"
                    f"Respond ONLY as a JSON array of objects."
                ),
            },
        ],
        temperature=0.3,
        max_tokens=2048,
    )

    events = []
    content = result.get("content", "")
    try:
        # Try to parse JSON from response
        start = content.find("[")
        end = content.rfind("]") + 1
        if start >= 0 and end > start:
            raw_events = json.loads(content[start:end])
            for e in raw_events:
                events.append(GameEvent(
                    timestamp=float(e.get("timestamp", 0)),
                    event_type=e.get("event_type", "transition_whoosh"),
                    confidence=float(e.get("confidence", 0.5)),
                ))
    except (json.JSONDecodeError, KeyError, TypeError):
        pass

    return events
