"""Generate SRT/ASS subtitle files from transcription data."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from models import WordTimestamp


def _format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_srt(
    words: list[WordTimestamp],
    output_path: str | Path,
    max_words_per_line: int = 8,
    max_duration: float = 4.0,
) -> Path:
    """Generate SRT subtitle file from word timestamps."""
    output_path = Path(output_path)

    lines: list[tuple[float, float, str]] = []
    current_words: list[str] = []
    current_start: Optional[float] = None

    for word in words:
        if current_start is None:
            current_start = word.start

        current_words.append(word.word)

        should_break = (
            len(current_words) >= max_words_per_line
            or (word.end - current_start) >= max_duration
        )

        if should_break:
            text = " ".join(current_words)
            lines.append((current_start, word.end, text))
            current_words = []
            current_start = None

    # Flush remaining words
    if current_words and current_start is not None:
        lines.append((current_start, words[-1].end, " ".join(current_words)))

    # Write SRT
    with open(output_path, "w", encoding="utf-8") as f:
        for i, (start, end, text) in enumerate(lines, 1):
            f.write(f"{i}\n")
            f.write(f"{_format_srt_time(start)} --> {_format_srt_time(end)}\n")
            f.write(f"{text}\n\n")

    return output_path
