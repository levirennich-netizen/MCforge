"""Timeline / Edit Plan endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import database as db
from models import EditPlan, EditSegment, JobType
from pipeline.orchestrator import run_plan_generation
from services.job_queue import enqueue_job

router = APIRouter(tags=["timeline"])


class GeneratePlanRequest(BaseModel):
    style_preset: str = "high_energy"
    target_duration_seconds: Optional[float] = None


class UpdatePlanRequest(BaseModel):
    segments: list[dict]  # Partial EditSegment dicts


@router.post("/projects/{project_id}/plan")
async def generate_plan(project_id: str, req: GeneratePlanRequest):
    """Generate an AI edit plan from analysis results."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    analyses = db.get_all_analyses(project_id)
    if not analyses:
        raise HTTPException(400, "No analysis results. Run analysis first.")

    job = await enqueue_job(
        project_id=project_id,
        job_type=JobType.PLAN,
        task_fn=run_plan_generation,
        style_preset=req.style_preset,
        target_duration=req.target_duration_seconds,
    )
    return {"job_id": job.id, "status": "queued"}


@router.get("/projects/{project_id}/plan")
async def get_plan(project_id: str):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    plan = db.get_edit_plan(project_id)
    if not plan:
        raise HTTPException(404, "No edit plan generated yet")
    return plan


@router.put("/projects/{project_id}/plan")
async def update_plan(project_id: str, req: UpdatePlanRequest):
    """Update the edit plan with manual edits."""
    plan = db.get_edit_plan(project_id)
    if not plan:
        raise HTTPException(404, "No edit plan to update")

    # Create new version with user modifications
    new_segments = []
    for seg_data in req.segments:
        new_segments.append(EditSegment(**seg_data))

    plan.segments = new_segments
    plan.is_user_modified = True
    plan.version += 1

    # Recalculate total duration
    total = 0.0
    for seg in new_segments:
        dur = (seg.end_time - seg.start_time) / seg.speed_factor
        seg.timeline_position = total
        total += dur
    plan.total_duration = total

    db.save_edit_plan(plan)
    return plan
