"""Audio analysis utilities."""

from __future__ import annotations

from pathlib import Path

from models import SilenceSegment


def detect_silence(
    audio_path: str | Path,
    energy_threshold: int = 50,
    min_silence_duration: float = 1.5,
) -> list[SilenceSegment]:
    """Find silent segments in audio using auditok."""
    import auditok

    regions = list(auditok.split(
        str(audio_path),
        min_dur=0.3,
        max_dur=600,
        max_silence=0.3,
        energy_threshold=energy_threshold,
    ))

    # Invert: gaps between speech regions are silence
    silences = []
    prev_end = 0.0
    for region in regions:
        r_start = region.start if region.start is not None else prev_end
        r_end = region.end if hasattr(region, 'end') and region.end is not None else r_start + region.duration
        gap = r_start - prev_end
        if gap >= min_silence_duration:
            silences.append(SilenceSegment(start=prev_end, end=r_start))
        prev_end = r_end

    return silences


def transcribe_audio(audio_path: str | Path, model_size: str = "base"):
    """Transcribe audio using faster-whisper. Returns (language, word_timestamps)."""
    from faster_whisper import WhisperModel
    from models import WordTimestamp

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(audio_path), word_timestamps=True)

    words = []
    for segment in segments:
        if segment.words:
            for w in segment.words:
                words.append(WordTimestamp(
                    word=w.word.strip(),
                    start=w.start,
                    end=w.end,
                    confidence=w.probability,
                ))

    return info.language, words
