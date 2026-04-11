"""Stage 3: Audio Analysis — silence detection, transcription, rule-based game event classification."""

from __future__ import annotations

from typing import Optional

from models import AudioAnalysis, GameEvent, Transcription, VideoAnalysis
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
        print(f"Transcription failed (non-fatal): {e}")

    # Step 3: Rule-based game event classification (no API needed)
    game_events = []
    if video_analysis and video_analysis.frame_analyses:
        if progress_callback:
            progress_callback("Detecting game events...")
        game_events = classify_game_events_local(video_analysis)

    return AudioAnalysis(
        clip_id=clip_id,
        silence_segments=silence_segments,
        transcription=transcription,
        game_events=game_events,
    )


def classify_game_events_local(video_analysis: VideoAnalysis) -> list[GameEvent]:
    """Map frame analysis categories + excitement to game events using rules.

    No AI API needed — uses the local frame classifications from analyze_video.
    """
    events: list[GameEvent] = []

    for frame in video_analysis.frame_analyses:
        desc = frame.description.lower()
        cats = [c.upper() for c in frame.categories]

        # Death screen -> player_damage or funny_fail
        if "DEATH" in cats:
            events.append(GameEvent(
                timestamp=frame.timestamp,
                event_type="oof" if frame.excitement >= 7 else "player_damage",
                confidence=0.85,
            ))
            continue

        # Explosion / fire
        if "ACTION" in cats and ("explosion" in desc or "fire" in desc):
            events.append(GameEvent(
                timestamp=frame.timestamp,
                event_type="explosion",
                confidence=0.8,
            ))
            continue

        # High-action combat
        if "ACTION" in cats and frame.excitement >= 8:
            events.append(GameEvent(
                timestamp=frame.timestamp,
                event_type="mob_hit",
                confidence=0.7,
            ))
            continue

        # Portal / transition
        if "TRANSITION" in cats:
            events.append(GameEvent(
                timestamp=frame.timestamp,
                event_type="portal",
                confidence=0.75,
            ))
            continue

        # Loot / chest
        if "LOOT" in cats:
            events.append(GameEvent(
                timestamp=frame.timestamp,
                event_type="chest_open",
                confidence=0.7,
            ))
            continue

        # Moderate action -> transition whoosh
        if "ACTION" in cats and frame.excitement >= 6:
            events.append(GameEvent(
                timestamp=frame.timestamp,
                event_type="transition_whoosh",
                confidence=0.6,
            ))
            continue

        # Bright flash -> bass_drop
        if "bright flash" in desc:
            events.append(GameEvent(
                timestamp=frame.timestamp,
                event_type="bass_drop",
                confidence=0.65,
            ))

    return events
