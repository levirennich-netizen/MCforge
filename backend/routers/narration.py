"""Narration endpoints — upload or generate narration."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

import database as db
from models import JobType, NarrationSync
from pipeline.orchestrator import run_narration_generation
from services.file_manager import narration_dir
from services.job_queue import enqueue_job

router = APIRouter(tags=["narration"])


class GenerateNarrationRequest(BaseModel):
    voice_id: str = "rex"
    custom_instructions: str = ""


@router.post("/projects/{project_id}/narration/upload")
async def upload_narration(
    project_id: str,
    file: UploadFile = File(...),
):
    """Upload a narration audio file."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    out_dir = narration_dir(project_id)
    filename = file.filename or "narration.mp3"
    save_path = out_dir / filename

    with open(save_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)

    return {"status": "uploaded", "path": str(save_path), "filename": filename}


@router.post("/projects/{project_id}/narration/generate")
async def generate_narration(project_id: str, req: GenerateNarrationRequest):
    """Generate AI narration for the current edit plan."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    plan = db.get_edit_plan(project_id)
    if not plan:
        raise HTTPException(400, "No edit plan. Generate a plan first.")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.NARRATE,
        task_fn=run_narration_generation,
        voice_id=req.voice_id,
        custom_instructions=req.custom_instructions,
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/projects/{project_id}/narration")
async def get_narration(project_id: str):
    """Get the current narration data."""
    import json
    from models import NarrationSegment, WordTimestamp

    conn = db.get_db()
    row = conn.execute(
        "SELECT * FROM narrations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (project_id,),
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "No narration found")

    d = dict(row)
    return NarrationSync(
        id=d["id"], project_id=d["project_id"], type=d["type"],
        voice_id=d["voice_id"],
        script=[NarrationSegment(**s) for s in json.loads(d["script_json"] or "[]")],
        audio_path=d["audio_path"],
        word_timestamps=[WordTimestamp(**w) for w in json.loads(d["word_timestamps_json"] or "[]")],
    )


@router.get("/tts/voices")
async def list_voices():
    """List available TTS voices."""
    return [
        {"id": "eve", "name": "Eve", "description": "Energetic, expressive"},
        {"id": "ara", "name": "Ara", "description": "Warm, friendly"},
        {"id": "rex", "name": "Rex", "description": "Confident, bold"},
        {"id": "sal", "name": "Sal", "description": "Smooth, relaxed"},
        {"id": "leo", "name": "Leo", "description": "Authoritative, commanding"},
    ]
