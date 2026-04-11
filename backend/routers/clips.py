"""Clip upload and management endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

import database as db
from models import ClipMetadata
from pipeline.ingest import ingest_clip
from services.file_manager import uploads_dir

router = APIRouter(tags=["clips"])


@router.post("/projects/{project_id}/clips", response_model=ClipMetadata)
async def upload_clip(
    project_id: str,
    file: UploadFile = File(...),
    sort_order: int = Form(0),
):
    """Upload a video clip to a project."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Validate file type
    filename = file.filename or "clip.mp4"
    ext = Path(filename).suffix.lower()
    if ext not in {".mp4", ".mov", ".mkv", ".avi", ".webm"}:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    # Save to disk
    save_dir = uploads_dir(project_id)
    # Avoid name collisions
    existing = list(save_dir.glob(f"*{ext}"))
    save_name = f"clip_{len(existing) + 1:03d}{ext}"
    save_path = save_dir / save_name

    with open(save_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            f.write(chunk)

    # Ingest: extract metadata, thumbnail, audio
    clip = await ingest_clip(project_id, save_path, filename, sort_order)
    db.create_clip(clip)

    # Update project status
    db.update_project_status(project_id, "uploading")

    return clip


@router.get("/projects/{project_id}/clips", response_model=list[ClipMetadata])
async def list_clips(project_id: str):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return db.get_clips(project_id)


@router.get("/projects/{project_id}/clips/{clip_id}", response_model=ClipMetadata)
async def get_clip(project_id: str, clip_id: str):
    clip = db.get_clip(clip_id)
    if not clip or clip.project_id != project_id:
        raise HTTPException(404, "Clip not found")
    return clip


@router.get("/projects/{project_id}/clips/{clip_id}/thumbnail")
async def get_thumbnail(project_id: str, clip_id: str):
    clip = db.get_clip(clip_id)
    if not clip or clip.project_id != project_id:
        raise HTTPException(404, "Clip not found")
    if not clip.thumbnail_path or not Path(clip.thumbnail_path).exists():
        raise HTTPException(404, "Thumbnail not found")
    return FileResponse(clip.thumbnail_path, media_type="image/jpeg")


@router.delete("/projects/{project_id}/clips/{clip_id}")
async def delete_clip(project_id: str, clip_id: str):
    clip = db.get_clip(clip_id)
    if not clip or clip.project_id != project_id:
        raise HTTPException(404, "Clip not found")
    # Delete files
    for path_str in [clip.file_path, clip.thumbnail_path, clip.audio_path]:
        if path_str:
            p = Path(path_str)
            p.unlink(missing_ok=True)
    db.delete_clip(clip_id)
    return {"status": "deleted"}
