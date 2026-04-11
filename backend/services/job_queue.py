"""SQLite-backed job queue with async execution."""

from __future__ import annotations

import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Coroutine, Optional

from models import Job, JobStatus, JobType, now_iso
import database as db

# Global progress store for SSE broadcasting
_progress_store: dict[str, dict] = {}
_executor = ThreadPoolExecutor(max_workers=2)


def get_progress(project_id: str) -> list[dict]:
    """Get all progress updates for a project."""
    return [v for v in _progress_store.values() if v.get("project_id") == project_id]


def update_progress(job_id: str, project_id: str, progress: float,
                    message: str, stage: str, status: str = "running") -> None:
    """Update job progress in both DB and in-memory store."""
    _progress_store[job_id] = {
        "job_id": job_id,
        "project_id": project_id,
        "status": status,
        "progress": progress,
        "message": message,
        "stage": stage,
    }
    db.update_job(job_id, progress=progress, progress_message=message, status=status)


async def enqueue_job(
    project_id: str,
    job_type: JobType,
    task_fn: Callable[..., Coroutine],
    **kwargs: Any,
) -> Job:
    """Create a job and start it running in the background.

    The task_fn will receive (project_id, job_id, **kwargs).
    """
    job = Job(project_id=project_id, job_type=job_type)
    db.create_job(job)

    update_progress(job.id, project_id, 0.0, "Starting...", job_type.value, "running")
    db.update_job(job.id, status="running", started_at=now_iso())

    # Run in background — always pass project_id and job_id
    asyncio.create_task(_run_job(job, task_fn, project_id=project_id, **kwargs))
    return job


async def _run_job(job: Job, task_fn: Callable, **kwargs: Any) -> None:
    """Execute a job and handle completion/failure."""
    try:
        result = await task_fn(job_id=job.id, **kwargs)
        update_progress(
            job.id, job.project_id, 1.0, "Completed",
            job.job_type.value, "completed",
        )
        db.update_job(
            job.id,
            status="completed",
            progress=1.0,
            progress_message="Completed",
            completed_at=now_iso(),
        )
    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
        update_progress(
            job.id, job.project_id, 0.0, error_msg,
            job.job_type.value, "failed",
        )
        db.update_job(
            job.id,
            status="failed",
            error_message=error_msg,
            completed_at=now_iso(),
        )
        traceback.print_exc()
