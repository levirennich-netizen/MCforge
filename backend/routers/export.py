"""Export endpoints — trigger render and download."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import database as db
from models import ExportRequest, JobType
from pipeline.orchestrator import run_compose_and_export
from services.job_queue import enqueue_job

router = APIRouter(tags=["export"])


@router.post("/projects/{project_id}/export")
async def start_export(project_id: str, req: ExportRequest):
    """Start rendering the final video."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    plan = db.get_edit_plan(project_id)
    if not plan:
        raise HTTPException(400, "No edit plan. Generate a plan first.")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.EXPORT,
        task_fn=run_compose_and_export,
        quality=req.quality,
        include_narration=req.include_narration,
        include_subtitles=req.include_subtitles,
    )
    return {"job_id": job.id, "status": "queued", "quality": req.quality}


@router.get("/projects/{project_id}/exports")
async def list_exports(project_id: str):
    """List all exports for a project."""
    conn = db.get_db()
    rows = conn.execute(
        "SELECT * FROM exports WHERE project_id = ? ORDER BY created_at DESC",
        (project_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/projects/{project_id}/export/{export_id}/download")
async def download_export(project_id: str, export_id: str):
    """Download a rendered video file."""
    conn = db.get_db()
    row = conn.execute(
        "SELECT * FROM exports WHERE id = ? AND project_id = ?",
        (export_id, project_id),
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "Export not found")

    d = dict(row)
    output_path = d.get("output_path", "")
    if not output_path or not Path(output_path).exists():
        raise HTTPException(404, "Export file not found on disk")

    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=Path(output_path).name,
    )


@router.post("/projects/{project_id}/preview")
async def generate_preview(project_id: str):
    """Generate a low-res preview render."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    plan = db.get_edit_plan(project_id)
    if not plan:
        raise HTTPException(400, "No edit plan.")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.COMPOSE,
        task_fn=run_compose_and_export,
        quality="preview",
        include_narration=False,
        include_subtitles=False,
    )
    return {"job_id": job.id, "status": "queued", "quality": "preview"}
