"""Pipeline orchestrator — runs analysis, planning, and export stages."""

from __future__ import annotations

from typing import Optional

import database as db
from config import settings
from models import JobType, StylePreset
from services.job_queue import enqueue_job, update_progress


async def run_analysis(project_id: str, job_id: str) -> None:
    """Run full analysis pipeline for all clips in a project."""
    from pipeline.analyze_video import analyze_clip
    from pipeline.analyze_audio import analyze_clip_audio

    clips = db.get_clips(project_id)
    if not clips:
        raise RuntimeError("No clips to analyze")

    db.update_project_status(project_id, "analyzing")

    total = len(clips)
    try:
        for i, clip in enumerate(clips):
            base_progress = i / total
            step_size = 1.0 / total

            def make_callback(base, size, idx=i):
                def cb(msg):
                    update_progress(job_id, project_id, base + size * 0.5,
                                  f"Clip {idx+1}/{total}: {msg}", "analyze")
                return cb

            callback = make_callback(base_progress, step_size)

            # Video analysis
            video_analysis = await analyze_clip(
                clip.id, clip.file_path, project_id, progress_callback=callback,
            )

            # Audio analysis
            audio_analysis = None
            if clip.audio_path:
                audio_analysis = await analyze_clip_audio(
                    clip.id, clip.audio_path,
                    video_analysis=video_analysis,
                    whisper_model=settings.WHISPER_MODEL_SIZE,
                    progress_callback=callback,
                )

            # Save results
            db.save_analysis(clip.id, project_id, video_analysis, audio_analysis)
            update_progress(
                job_id, project_id, (i + 1) / total,
                f"Analyzed clip {i+1}/{total}", "analyze",
            )
    except Exception:
        # Reset project status so user can retry
        db.update_project_status(project_id, "uploaded")
        raise


async def run_plan_generation(
    project_id: str,
    job_id: str,
    style_preset: str = "high_energy",
    target_duration: Optional[float] = None,
) -> None:
    """Generate AI edit plan from analysis results."""
    from pipeline.planner import generate_edit_plan

    db.update_project_status(project_id, "planning")

    analyses = db.get_all_analyses(project_id)
    if not analyses:
        raise RuntimeError("No analysis results found. Run analysis first.")

    def callback(msg):
        update_progress(job_id, project_id, 0.5, msg, "plan")

    plan = await generate_edit_plan(
        project_id, analyses, StylePreset(style_preset),
        target_duration=target_duration, progress_callback=callback,
    )

    # Determine version
    existing = db.get_edit_plan(project_id)
    plan.version = (existing.version + 1) if existing else 1

    db.save_edit_plan(plan)


async def run_narration_generation(
    project_id: str,
    job_id: str,
    voice_id: str = "rex",
    custom_instructions: str = "",
) -> None:
    """Generate AI narration for the current edit plan."""
    from pipeline.narration import generate_narration

    plan = db.get_edit_plan(project_id)
    if not plan:
        raise RuntimeError("No edit plan found. Generate a plan first.")

    def callback(msg):
        update_progress(job_id, project_id, 0.5, msg, "narrate")

    narration = await generate_narration(
        project_id, plan, voice_id=voice_id,
        custom_instructions=custom_instructions, progress_callback=callback,
    )

    # Save to DB
    conn = db.get_db()
    import json
    conn.execute(
        "INSERT OR REPLACE INTO narrations (id, project_id, type, voice_id, script_json, "
        "audio_path, word_timestamps_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (narration.id, project_id, narration.type, narration.voice_id,
         json.dumps([s.model_dump() for s in narration.script]),
         narration.audio_path,
         json.dumps([w.model_dump() for w in narration.word_timestamps]),
         narration.created_at),
    )
    conn.commit()
    conn.close()


async def run_auto_edit(
    project_id: str,
    job_id: str,
    style_preset: str = "high_energy",
    quality: str = "1080p",
) -> None:
    """One-click: analyze all clips → generate AI edit plan → compose & export video."""
    from pipeline.analyze_video import analyze_clip
    from pipeline.analyze_audio import analyze_clip_audio
    from pipeline.planner import generate_edit_plan
    from pipeline.compose import compose_video
    from pipeline.export import export_final

    clips = db.get_clips(project_id)
    if not clips:
        raise RuntimeError("No clips uploaded. Upload at least one clip first.")

    # ── Step 1: Analyze all clips ──
    db.update_project_status(project_id, "analyzing")
    for i, clip in enumerate(clips):
        update_progress(
            job_id, project_id,
            (i / len(clips)) * 0.33,
            f"Analyzing clip {i+1}/{len(clips)}...", "auto_edit",
        )
        video_analysis = await analyze_clip(
            clip.id, clip.file_path, project_id,
            progress_callback=lambda msg, _i=i: update_progress(
                job_id, project_id, (_i / len(clips)) * 0.33,
                f"Clip {_i+1}: {msg}", "auto_edit"),
        )
        audio_analysis = None
        if clip.audio_path:
            audio_analysis = await analyze_clip_audio(
                clip.id, clip.audio_path, video_analysis=video_analysis,
                whisper_model=settings.WHISPER_MODEL_SIZE,
            )
        db.save_analysis(clip.id, project_id, video_analysis, audio_analysis)

    # ── Step 2: Generate AI edit plan ──
    update_progress(job_id, project_id, 0.33, "AI is creating your edit plan...", "auto_edit")
    db.update_project_status(project_id, "planning")

    analyses = db.get_all_analyses(project_id)
    plan = await generate_edit_plan(
        project_id, analyses, StylePreset(style_preset),
        progress_callback=lambda msg: update_progress(
            job_id, project_id, 0.5, msg, "auto_edit"),
    )
    existing = db.get_edit_plan(project_id)
    plan.version = (existing.version + 1) if existing else 1
    db.save_edit_plan(plan)

    # ── Step 3: Compose & export video ──
    update_progress(job_id, project_id, 0.66, "Assembling your video...", "auto_edit")
    db.update_project_status(project_id, "composing")

    composed_path = await compose_video(
        project_id, plan, quality=quality,
        progress_callback=lambda msg: update_progress(
            job_id, project_id, 0.75, msg, "auto_edit"),
    )

    update_progress(job_id, project_id, 0.9, "Final encoding...", "auto_edit")
    result = await export_final(project_id, composed_path, quality=quality)

    # Save export record
    conn = db.get_db()
    conn.execute(
        "INSERT INTO exports (id, project_id, edit_plan_id, quality, output_path, "
        "file_size_bytes, duration_seconds, status, created_at, completed_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (result.id, project_id, plan.id, quality, result.output_path,
         result.file_size_bytes, result.duration_seconds, "completed",
         result.created_at, result.completed_at),
    )
    conn.commit()
    conn.close()
    db.update_project_status(project_id, "exported")


async def run_compose_and_export(
    project_id: str,
    job_id: str,
    quality: str = "1080p",
    include_narration: bool = True,
    include_subtitles: bool = True,
) -> None:
    """Compose and export final video."""
    from pipeline.compose import compose_video
    from pipeline.export import export_final
    from utils.subtitle_renderer import generate_srt
    from services.file_manager import export_dir

    db.update_project_status(project_id, "composing")

    plan = db.get_edit_plan(project_id)
    if not plan:
        raise RuntimeError("No edit plan found.")

    # Get narration if requested
    narration = None
    if include_narration:
        conn = db.get_db()
        row = conn.execute(
            "SELECT * FROM narrations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
            (project_id,),
        ).fetchone()
        conn.close()
        if row:
            import json
            from models import NarrationSync, NarrationSegment, WordTimestamp
            d = dict(row)
            narration = NarrationSync(
                id=d["id"], project_id=d["project_id"], type=d["type"],
                voice_id=d["voice_id"],
                script=[NarrationSegment(**s) for s in json.loads(d["script_json"] or "[]")],
                audio_path=d["audio_path"],
                word_timestamps=[WordTimestamp(**w) for w in json.loads(d["word_timestamps_json"] or "[]")],
            )

    def callback(msg):
        update_progress(job_id, project_id, 0.5, msg, "export")

    # Compose video
    composed_path = await compose_video(
        project_id, plan, narration=narration, quality=quality,
        progress_callback=callback,
    )

    # Generate subtitles if requested
    subtitle_path = None
    if include_subtitles and narration and narration.word_timestamps:
        subtitle_path = str(export_dir(project_id) / "subtitles.srt")
        generate_srt(narration.word_timestamps, subtitle_path)

    # Final export
    update_progress(job_id, project_id, 0.8, "Final encoding...", "export")
    result = await export_final(
        project_id, composed_path, quality=quality,
        subtitle_path=subtitle_path, progress_callback=callback,
    )

    # Save export record
    conn = db.get_db()
    conn.execute(
        "INSERT INTO exports (id, project_id, edit_plan_id, quality, output_path, "
        "file_size_bytes, duration_seconds, status, created_at, completed_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (result.id, project_id, plan.id, quality, result.output_path,
         result.file_size_bytes, result.duration_seconds, "completed",
         result.created_at, result.completed_at),
    )
    conn.commit()
    conn.close()

    db.update_project_status(project_id, "exported")
