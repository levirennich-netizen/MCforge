"""Generate endpoints — image, SFX, animated intro, and video generation."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

import database as db
from models import (
    GenerateImageRequest,
    GenerateSfxRequest,
    GenerateAnimatedIntroRequest,
    GenerateVideoRequest,
    JobType,
)
from pipeline.generate import run_generate_image, run_generate_sfx, run_generate_animated_intro, run_generate_video, run_generate_video_pair
from services.job_queue import enqueue_job

router = APIRouter(tags=["generate"])


@router.post("/projects/{project_id}/generate/image")
async def generate_image(project_id: str, req: GenerateImageRequest):
    """Generate an AI image."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.GENERATE_IMAGE,
        task_fn=run_generate_image,
        prompt=req.prompt,
        style=req.style,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/projects/{project_id}/generate/sfx")
async def generate_sfx(project_id: str, req: GenerateSfxRequest):
    """Generate an AI sound effect."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.GENERATE_SFX,
        task_fn=run_generate_sfx,
        prompt=req.prompt,
        voice_id=req.voice_id,
        duration_hint=req.duration_hint,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/projects/{project_id}/generate/intro")
async def generate_intro(project_id: str, req: GenerateAnimatedIntroRequest):
    """Generate an animated intro/outro."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.GENERATE_INTRO,
        task_fn=run_generate_animated_intro,
        intro_type=req.intro_type.value,
        title=req.title,
        subtitle=req.subtitle,
        duration_seconds=req.duration_seconds,
        color_scheme=req.color_scheme,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/projects/{project_id}/generate/video")
async def generate_video(project_id: str, req: GenerateVideoRequest):
    """Generate an AI video from a text prompt."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.GENERATE_VIDEO,
        task_fn=run_generate_video,
        prompt=req.prompt,
        model=req.model,
        duration=req.duration,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/projects/{project_id}/generate/video-pair")
async def generate_video_pair(project_id: str, req: GenerateVideoRequest):
    """Generate 2 AI video options for the voting flow."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.GENERATE_VIDEO_PAIR,
        task_fn=run_generate_video_pair,
        prompt=req.prompt,
        model=req.model,
        duration=req.duration,
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/projects/{project_id}/generate/assets")
async def list_assets(
    project_id: str,
    asset_type: Optional[str] = Query(None),
):
    """List generated assets for a project."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    assets = db.list_generated_assets(project_id, asset_type)
    return [a.model_dump() for a in assets]


@router.get("/projects/{project_id}/generate/assets/{asset_id}/file")
async def get_asset_file(project_id: str, asset_id: str):
    """Serve a generated asset file."""
    asset = db.get_generated_asset(asset_id)
    if not asset or asset.project_id != project_id:
        raise HTTPException(404, "Asset not found")

    file_path = Path(asset.file_path)
    if not file_path.exists():
        raise HTTPException(404, "File not found")

    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".mp3": "audio/mpeg",
        ".mp4": "video/mp4",
    }
    media_type = media_types.get(file_path.suffix.lower(), "application/octet-stream")
    return FileResponse(file_path, media_type=media_type)


@router.get("/projects/{project_id}/generate/assets/{asset_id}/thumbnail")
async def get_asset_thumbnail(project_id: str, asset_id: str):
    """Serve a generated asset thumbnail."""
    asset = db.get_generated_asset(asset_id)
    if not asset or asset.project_id != project_id:
        raise HTTPException(404, "Asset not found")

    thumb_path = Path(asset.thumbnail_path) if asset.thumbnail_path else None
    if not thumb_path or not thumb_path.exists():
        # Fall back to the main file for images
        file_path = Path(asset.file_path)
        if file_path.exists() and file_path.suffix.lower() in (".png", ".jpg"):
            return FileResponse(file_path, media_type="image/png")
        raise HTTPException(404, "Thumbnail not found")

    return FileResponse(thumb_path, media_type="image/jpeg")


@router.delete("/projects/{project_id}/generate/assets/{asset_id}")
async def delete_asset(project_id: str, asset_id: str):
    """Delete a generated asset and its files."""
    asset = db.get_generated_asset(asset_id)
    if not asset or asset.project_id != project_id:
        raise HTTPException(404, "Asset not found")

    # Delete files
    for path_str in [asset.file_path, asset.thumbnail_path]:
        if path_str:
            p = Path(path_str)
            if p.exists():
                p.unlink()

    db.delete_generated_asset(asset_id)
    return {"status": "deleted"}
