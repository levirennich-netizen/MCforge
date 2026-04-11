"""AI Chat endpoints — project-scoped conversational AI assistant."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

import database as db
from models import ChatRequest
from services.grok_client import chat_completion_stream

router = APIRouter(tags=["chat"])


def _build_system_prompt(project_id: str) -> str:
    """Build a system prompt with full project context."""
    project = db.get_project(project_id)
    if not project:
        return ""

    clips = db.get_clips(project_id)
    analyses = db.get_all_analyses(project_id)
    edit_plan = db.get_edit_plan(project_id)

    # -- Clips summary --
    clips_text = "No clips uploaded yet."
    if clips:
        lines = []
        for c in clips:
            lines.append(
                f"  - {c.filename}: {c.duration_seconds:.1f}s, "
                f"{c.width}x{c.height} @ {c.fps:.0f}fps"
            )
        clips_text = "\n".join(lines)

    # -- Highlights summary --
    highlights_text = "No analysis done yet."
    if analyses:
        highlight_lines = []
        for a in analyses:
            if a.video:
                for fa in a.video.frame_analyses:
                    if fa.excitement >= 7:
                        highlight_lines.append(
                            f"  - [{a.clip_id}] @ {fa.timestamp:.1f}s: "
                            f"{fa.description} (excitement: {fa.excitement}/10, "
                            f"categories: {', '.join(fa.categories)})"
                        )
        if highlight_lines:
            highlights_text = "\n".join(highlight_lines[:15])
        else:
            highlights_text = "Analysis complete but no high-excitement moments found."

    # -- Edit plan summary --
    plan_text = "No edit plan generated yet."
    if edit_plan:
        seg_lines = []
        for s in edit_plan.segments[:10]:
            seg_lines.append(
                f"  - {s.label or s.segment_id}: clip {s.clip_id} "
                f"[{s.start_time:.1f}s-{s.end_time:.1f}s], "
                f"transition: {s.transition_in.value}, speed: {s.speed_factor}x"
            )
        plan_text = (
            f"Style: {edit_plan.style_preset.value}, "
            f"Total duration: {edit_plan.total_duration:.1f}s, "
            f"Segments: {len(edit_plan.segments)}\n"
            + "\n".join(seg_lines)
        )
        if edit_plan.reasoning:
            plan_text += f"\n  AI reasoning: {edit_plan.reasoning}"

    return f"""You are the MCForge AI assistant — an expert Minecraft video editor and creative director.
You are helping the user with their project "{project.name}" (style: {project.style_preset.value}, status: {project.status.value}).

PROJECT CONTEXT:

CLIPS ({len(clips)} total):
{clips_text}

HIGHLIGHTS (exciting moments):
{highlights_text}

EDIT PLAN:
{plan_text}

YOUR ROLE:
- Give specific, actionable editing suggestions referencing actual clip names, timestamps, and highlight moments.
- Suggest transitions, effects, pacing changes, and music choices that fit the "{project.style_preset.value}" style.
- When asked about analysis results, reference specific excitement scores and categories.
- Keep responses concise and practical. Use bullet points for lists of suggestions.
- If the user asks about something not in the context, say so honestly.
- Be enthusiastic about Minecraft content creation!"""


@router.get("/projects/{project_id}/chat/messages")
async def get_messages(project_id: str):
    """Get conversation history for a project."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return db.get_chat_messages(project_id)


@router.post("/projects/{project_id}/chat")
async def send_message(project_id: str, req: ChatRequest):
    """Send a message and stream the AI response via SSE."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Save user message
    db.save_chat_message(project_id, "user", req.message)

    # Build messages array: system + history
    system_prompt = _build_system_prompt(project_id)
    history = db.get_chat_messages(project_id, limit=30)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    async def event_generator():
        full_response = ""
        try:
            async for token in chat_completion_stream(messages):
                full_response += token
                yield {"event": "token", "data": json.dumps({"token": token})}
            # Save the full AI response
            db.save_chat_message(project_id, "assistant", full_response)
            yield {"event": "done", "data": json.dumps({"content": full_response})}
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            yield {"event": "error", "data": json.dumps({"error": error_msg})}

    return EventSourceResponse(event_generator())


@router.delete("/projects/{project_id}/chat")
async def clear_chat(project_id: str):
    """Clear conversation history for a project."""
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete_chat_messages(project_id)
    return {"status": "cleared"}
