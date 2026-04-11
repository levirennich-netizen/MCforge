"""SSE progress streaming endpoint."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from services.job_queue import get_progress

router = APIRouter(tags=["progress"])


@router.get("/projects/{project_id}/progress")
async def stream_progress(project_id: str):
    """Stream job progress via Server-Sent Events."""
    async def event_generator():
        seen_completed = set()
        max_idle = 300  # 5 minutes timeout
        idle_count = 0

        while idle_count < max_idle:
            updates = get_progress(project_id)

            if not updates:
                idle_count += 1
                await asyncio.sleep(1)
                continue

            idle_count = 0
            for update in updates:
                job_id = update["job_id"]
                status = update["status"]

                if job_id in seen_completed:
                    continue

                event_type = "progress"
                if status in ("completed", "failed"):
                    event_type = status
                    seen_completed.add(job_id)

                yield {
                    "event": event_type,
                    "data": json.dumps(update),
                }

            # Check if all known jobs are done
            all_done = all(
                u["status"] in ("completed", "failed", "cancelled")
                for u in updates
            )
            if all_done and updates:
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())
