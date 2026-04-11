"""Stage 5: Narration — sync uploaded narration or generate with Grok TTS."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from models import EditPlan, NarrationSegment, NarrationSync, WordTimestamp
from services.grok_client import chat_completion, generate_tts
from services.file_manager import narration_dir
from utils.audio_utils import transcribe_audio


async def sync_uploaded_narration(
    project_id: str,
    audio_path: str,
    edit_plan: EditPlan,
    whisper_model: str = "base",
    progress_callback=None,
) -> NarrationSync:
    """Transcribe uploaded narration and align to timeline."""
    if progress_callback:
        progress_callback("Transcribing uploaded narration...")

    language, words = transcribe_audio(audio_path, whisper_model)

    return NarrationSync(
        project_id=project_id,
        type="uploaded",
        audio_path=audio_path,
        word_timestamps=words,
    )


async def generate_narration(
    project_id: str,
    edit_plan: EditPlan,
    voice_id: str = "rex",
    custom_instructions: str = "",
    progress_callback=None,
) -> NarrationSync:
    """Generate narration script with Grok, then synthesize with TTS."""

    # Step 1: Generate narration script
    if progress_callback:
        progress_callback("Writing narration script...")

    segments_desc = [
        {
            "segment_id": s.segment_id,
            "label": s.label,
            "duration": round(s.end_time - s.start_time, 1),
            "subtitle": s.subtitle_text or "",
        }
        for s in edit_plan.segments
    ]

    style_desc = {
        "funny": "Goofy, lots of reactions, casual language, 'OH NO!', 'WHAT?!', memes",
        "high_energy": "Hyped up, fast talking, 'LET'S GO!', 'INSANE!', competitive energy",
        "cinematic": "Calm, descriptive, storytelling tone, atmospheric, immersive",
    }

    try:
        result = await chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a Minecraft YouTuber writing narration for a video.\n"
                        f"Style: {edit_plan.style_preset.value} - {style_desc.get(edit_plan.style_preset.value, '')}\n"
                        f"{f'Additional instructions: {custom_instructions}' if custom_instructions else ''}\n\n"
                        f"Write engaging narration for each segment. Keep it:\n"
                        f"- Conversational and matching the style\n"
                        f"- Matching the pacing (segment durations shown)\n"
                        f"- Reference what's happening on screen (labels describe visuals)\n"
                        f"- Include natural reactions and energy\n"
                        f"- Keep each segment's narration proportional to its duration\n\n"
                        f"Respond as JSON array: [{{\"segment_id\": \"...\", \"narration_text\": \"...\"}}]"
                    ),
                },
                {
                    "role": "user",
                    "content": f"Video segments:\n{json.dumps(segments_desc, indent=2)}",
                },
            ],
            temperature=0.8,
            max_tokens=4096,
        )

        # Parse script
        script = []
        content = result.get("content", "")
        try:
            start = content.find("[")
            end = content.rfind("]") + 1
            if start >= 0 and end > start:
                raw = json.loads(content[start:end])
                script = [
                    NarrationSegment(segment_id=s["segment_id"], narration_text=s["narration_text"])
                    for s in raw
                ]
        except (json.JSONDecodeError, KeyError):
            pass
    except Exception as e:
        print(f"Grok API failed for narration script ({e}), using fallback")

    # Fallback script if AI failed
    if not script:
        for seg in edit_plan.segments:
            script.append(NarrationSegment(
                segment_id=seg.segment_id,
                narration_text=f"Check this out! {seg.label}",
            ))

    # Step 2: Generate TTS audio
    if progress_callback:
        progress_callback("Generating voice narration...")

    full_text = " ".join(s.narration_text for s in script)
    try:
        audio_bytes = await generate_tts(full_text, voice_id=voice_id)
    except Exception as e:
        raise RuntimeError(
            f"Voice generation failed — xAI TTS requires API credits. "
            f"You can skip narration and go straight to Export. Error: {e}"
        )

    # Save audio
    out_dir = narration_dir(project_id)
    audio_path = out_dir / "narration.mp3"
    audio_path.write_bytes(audio_bytes)

    # Step 3: Transcribe generated audio for word timestamps
    if progress_callback:
        progress_callback("Syncing narration timing...")
    try:
        _, words = transcribe_audio(str(audio_path))
    except Exception:
        words = []

    return NarrationSync(
        project_id=project_id,
        type="generated",
        voice_id=voice_id,
        script=script,
        audio_path=str(audio_path),
        word_timestamps=words,
    )
