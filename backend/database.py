import json
import sqlite3
from pathlib import Path
from typing import Optional

from config import settings
from models import (
    AnalysisResult,
    AudioAnalysis,
    ClipMetadata,
    EditPlan,
    Job,
    JobStatus,
    JobType,
    NarrationSync,
    Project,
    VideoAnalysis,
    new_id,
    now_iso,
)

DB_PATH = settings.DATA_DIR / "mcforge.db"


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            style_preset TEXT NOT NULL DEFAULT 'high_energy',
            status TEXT NOT NULL DEFAULT 'created',
            target_duration_seconds REAL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS clips (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            duration_seconds REAL DEFAULT 0,
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            fps REAL DEFAULT 0,
            codec TEXT DEFAULT '',
            audio_channels INTEGER DEFAULT 0,
            file_size_bytes INTEGER DEFAULT 0,
            thumbnail_path TEXT DEFAULT '',
            audio_path TEXT DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            video_json TEXT,
            audio_json TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS edit_plans (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            style_preset TEXT NOT NULL DEFAULT 'high_energy',
            segments_json TEXT NOT NULL DEFAULT '[]',
            background_music TEXT DEFAULT '',
            music_volume REAL DEFAULT 0.3,
            total_duration REAL DEFAULT 0,
            reasoning TEXT DEFAULT '',
            is_user_modified INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(project_id, version)
        );

        CREATE TABLE IF NOT EXISTS narrations (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'generated',
            voice_id TEXT,
            script_json TEXT DEFAULT '[]',
            audio_path TEXT DEFAULT '',
            word_timestamps_json TEXT DEFAULT '[]',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            job_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            progress REAL DEFAULT 0.0,
            progress_message TEXT DEFAULT '',
            result_json TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exports (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            edit_plan_id TEXT DEFAULT '',
            quality TEXT NOT NULL DEFAULT '1080p',
            output_path TEXT DEFAULT '',
            file_size_bytes INTEGER DEFAULT 0,
            duration_seconds REAL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            completed_at TEXT
        );
    """)
    conn.commit()
    conn.close()


# ── Project CRUD ─────────────────────────────────────────────────────────────


def create_project(project: Project) -> Project:
    conn = get_db()
    conn.execute(
        "INSERT INTO projects (id, name, style_preset, status, target_duration_seconds, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (project.id, project.name, project.style_preset.value, project.status.value,
         project.target_duration_seconds, project.created_at, project.updated_at),
    )
    conn.commit()
    conn.close()
    return project


def get_project(project_id: str) -> Optional[Project]:
    conn = get_db()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return Project(**dict(row))


def list_projects() -> list[Project]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    conn.close()
    return [Project(**dict(r)) for r in rows]


def update_project_status(project_id: str, status: str) -> None:
    conn = get_db()
    conn.execute(
        "UPDATE projects SET status = ?, updated_at = ? WHERE id = ?",
        (status, now_iso(), project_id),
    )
    conn.commit()
    conn.close()


def delete_project(project_id: str) -> None:
    conn = get_db()
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()


# ── Clip CRUD ────────────────────────────────────────────────────────────────


def create_clip(clip: ClipMetadata) -> ClipMetadata:
    conn = get_db()
    conn.execute(
        "INSERT INTO clips (id, project_id, filename, file_path, duration_seconds, width, height, fps, "
        "codec, audio_channels, file_size_bytes, thumbnail_path, audio_path, sort_order, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (clip.id, clip.project_id, clip.filename, clip.file_path, clip.duration_seconds,
         clip.width, clip.height, clip.fps, clip.codec, clip.audio_channels,
         clip.file_size_bytes, clip.thumbnail_path, clip.audio_path, clip.sort_order,
         clip.created_at),
    )
    conn.commit()
    conn.close()
    return clip


def get_clips(project_id: str) -> list[ClipMetadata]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM clips WHERE project_id = ? ORDER BY sort_order", (project_id,)
    ).fetchall()
    conn.close()
    return [ClipMetadata(**dict(r)) for r in rows]


def get_clip(clip_id: str) -> Optional[ClipMetadata]:
    conn = get_db()
    row = conn.execute("SELECT * FROM clips WHERE id = ?", (clip_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return ClipMetadata(**dict(row))


def delete_clip(clip_id: str) -> None:
    conn = get_db()
    conn.execute("DELETE FROM clips WHERE id = ?", (clip_id,))
    conn.commit()
    conn.close()


# ── Analysis CRUD ────────────────────────────────────────────────────────────


def save_analysis(clip_id: str, project_id: str, video: Optional[VideoAnalysis],
                  audio: Optional[AudioAnalysis], status: str = "completed",
                  error_message: Optional[str] = None) -> None:
    from models import new_id
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO analyses (id, clip_id, project_id, video_json, audio_json, "
        "status, error_message, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (new_id("ana_"), clip_id, project_id,
         video.model_dump_json() if video else None,
         audio.model_dump_json() if audio else None,
         status, error_message, now_iso(), now_iso() if status == "completed" else None),
    )
    conn.commit()
    conn.close()


def get_analysis(clip_id: str) -> Optional[AnalysisResult]:
    conn = get_db()
    row = conn.execute("SELECT * FROM analyses WHERE clip_id = ?", (clip_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    return AnalysisResult(
        clip_id=d["clip_id"],
        video=VideoAnalysis.model_validate_json(d["video_json"]) if d["video_json"] else None,
        audio=AudioAnalysis.model_validate_json(d["audio_json"]) if d["audio_json"] else None,
        status=d["status"],
        error_message=d["error_message"],
    )


def get_all_analyses(project_id: str) -> list[AnalysisResult]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM analyses WHERE project_id = ?", (project_id,)
    ).fetchall()
    conn.close()
    results = []
    for row in rows:
        d = dict(row)
        results.append(AnalysisResult(
            clip_id=d["clip_id"],
            video=VideoAnalysis.model_validate_json(d["video_json"]) if d["video_json"] else None,
            audio=AudioAnalysis.model_validate_json(d["audio_json"]) if d["audio_json"] else None,
            status=d["status"],
            error_message=d["error_message"],
        ))
    return results


# ── Edit Plan CRUD ───────────────────────────────────────────────────────────


def save_edit_plan(plan: EditPlan) -> EditPlan:
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO edit_plans (id, project_id, version, style_preset, segments_json, "
        "background_music, music_volume, total_duration, reasoning, is_user_modified, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (plan.id, plan.project_id, plan.version, plan.style_preset.value,
         json.dumps([s.model_dump() for s in plan.segments]),
         plan.background_music, plan.music_volume, plan.total_duration,
         plan.reasoning, int(plan.is_user_modified), plan.created_at),
    )
    conn.commit()
    conn.close()
    return plan


def get_edit_plan(project_id: str) -> Optional[EditPlan]:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM edit_plans WHERE project_id = ? ORDER BY version DESC LIMIT 1",
        (project_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    from models import EditSegment
    segments = [EditSegment(**s) for s in json.loads(d["segments_json"])]
    return EditPlan(
        id=d["id"], project_id=d["project_id"], version=d["version"],
        style_preset=d["style_preset"], segments=segments,
        background_music=d["background_music"], music_volume=d["music_volume"],
        total_duration=d["total_duration"], reasoning=d["reasoning"],
        is_user_modified=bool(d["is_user_modified"]), created_at=d["created_at"],
    )


# ── Job CRUD ─────────────────────────────────────────────────────────────────


def create_job(job: Job) -> Job:
    conn = get_db()
    conn.execute(
        "INSERT INTO jobs (id, project_id, job_type, status, progress, progress_message, "
        "result_json, error_message, created_at, started_at, completed_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (job.id, job.project_id, job.job_type.value, job.status.value,
         job.progress, job.progress_message, job.result_json, job.error_message,
         job.created_at, job.started_at, job.completed_at),
    )
    conn.commit()
    conn.close()
    return job


def update_job(job_id: str, **kwargs) -> None:
    conn = get_db()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    conn.execute(f"UPDATE jobs SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_job(job_id: str) -> Optional[Job]:
    conn = get_db()
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return Job(**dict(row))


def get_active_jobs(project_id: str) -> list[Job]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM jobs WHERE project_id = ? AND status IN ('queued', 'running') "
        "ORDER BY created_at", (project_id,)
    ).fetchall()
    conn.close()
    return [Job(**dict(r)) for r in rows]


def get_project_jobs(project_id: str) -> list[Job]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC",
        (project_id,),
    ).fetchall()
    conn.close()
    return [Job(**dict(r)) for r in rows]


# ── Chat CRUD ───────────────────────────────────────────────────────────────


def save_chat_message(project_id: str, role: str, content: str) -> dict:
    msg_id = new_id("msg_")
    created_at = now_iso()
    conn = get_db()
    conn.execute(
        "INSERT INTO chat_messages (id, project_id, role, content, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (msg_id, project_id, role, content, created_at),
    )
    conn.commit()
    conn.close()
    return {"id": msg_id, "project_id": project_id, "role": role,
            "content": content, "created_at": created_at}


def get_chat_messages(project_id: str, limit: int = 50) -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at ASC LIMIT ?",
        (project_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_chat_messages(project_id: str) -> None:
    conn = get_db()
    conn.execute("DELETE FROM chat_messages WHERE project_id = ?", (project_id,))
    conn.commit()
    conn.close()
