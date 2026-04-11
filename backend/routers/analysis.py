"""Analysis endpoints — trigger and retrieve clip analysis."""

from fastapi import APIRouter, HTTPException

import database as db
from models import AnalysisResult, JobType
from pipeline.orchestrator import run_analysis
from services.job_queue import enqueue_job

router = APIRouter(tags=["analysis"])


@router.post("/projects/{project_id}/analyze")
async def start_analysis(project_id: str):
    """Start the analysis pipeline for all clips in a project."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    clips = db.get_clips(project_id)
    if not clips:
        raise HTTPException(400, "No clips uploaded yet")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.ANALYZE,
        task_fn=run_analysis,
    )
    return {"job_id": job.id, "status": "queued", "message": f"Analysis queued for {len(clips)} clips"}


@router.get("/projects/{project_id}/analysis", response_model=list[AnalysisResult])
async def get_all_analysis(project_id: str):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return db.get_all_analyses(project_id)


@router.get("/projects/{project_id}/analysis/{clip_id}", response_model=AnalysisResult)
async def get_clip_analysis(project_id: str, clip_id: str):
    result = db.get_analysis(clip_id)
    if not result:
        raise HTTPException(404, "Analysis not found")
    return result


@router.get("/projects/{project_id}/highlights")
async def get_highlights(project_id: str):
    """Get all detected highlights across all clips."""
    analyses = db.get_all_analyses(project_id)
    highlights = []
    for a in analyses:
        if a.video:
            for ts in a.video.highlight_timestamps:
                # Find the frame analysis at this timestamp
                desc = ""
                cats = []
                excitement = 0
                for f in a.video.frame_analyses:
                    if abs(f.timestamp - ts) < 1.0:
                        desc = f.description
                        cats = f.categories
                        excitement = f.excitement
                        break
                highlights.append({
                    "clip_id": a.clip_id,
                    "timestamp": ts,
                    "categories": cats,
                    "excitement": excitement,
                    "description": desc,
                })
    highlights.sort(key=lambda h: h["excitement"], reverse=True)
    return highlights
