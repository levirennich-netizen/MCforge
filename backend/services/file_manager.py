"""File path resolution and directory management."""

from pathlib import Path

from config import settings


def project_dir(project_id: str) -> Path:
    d = settings.DATA_DIR / "projects" / project_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def uploads_dir(project_id: str) -> Path:
    d = project_dir(project_id) / "uploads"
    d.mkdir(exist_ok=True)
    return d


def frames_dir(project_id: str, clip_id: str) -> Path:
    d = project_dir(project_id) / "frames" / clip_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def audio_dir(project_id: str) -> Path:
    d = project_dir(project_id) / "audio"
    d.mkdir(exist_ok=True)
    return d


def analysis_dir(project_id: str) -> Path:
    d = project_dir(project_id) / "analysis"
    d.mkdir(exist_ok=True)
    return d


def narration_dir(project_id: str) -> Path:
    d = project_dir(project_id) / "narration"
    d.mkdir(exist_ok=True)
    return d


def export_dir(project_id: str) -> Path:
    d = project_dir(project_id) / "export"
    d.mkdir(exist_ok=True)
    return d


def preview_dir(project_id: str) -> Path:
    d = project_dir(project_id) / "preview"
    d.mkdir(exist_ok=True)
    return d


def thumbnail_path(project_id: str, clip_id: str) -> Path:
    d = project_dir(project_id) / "thumbnails"
    d.mkdir(exist_ok=True)
    return d / f"{clip_id}.jpg"


def sfx_library_dir() -> Path:
    d = settings.DATA_DIR / "sfx_library"
    d.mkdir(parents=True, exist_ok=True)
    return d


def music_library_dir() -> Path:
    d = settings.DATA_DIR / "music_library"
    d.mkdir(parents=True, exist_ok=True)
    return d


def generated_dir(project_id: str) -> Path:
    d = project_dir(project_id) / "generated"
    d.mkdir(exist_ok=True)
    return d


def generated_images_dir(project_id: str) -> Path:
    d = generated_dir(project_id) / "images"
    d.mkdir(exist_ok=True)
    return d


def generated_sfx_dir(project_id: str) -> Path:
    d = generated_dir(project_id) / "sfx"
    d.mkdir(exist_ok=True)
    return d


def generated_intros_dir(project_id: str) -> Path:
    d = generated_dir(project_id) / "intros"
    d.mkdir(exist_ok=True)
    return d


def generated_videos_dir(project_id: str) -> Path:
    d = generated_dir(project_id) / "videos"
    d.mkdir(exist_ok=True)
    return d


def cleanup_project(project_id: str) -> None:
    """Delete all files for a project."""
    import shutil
    d = project_dir(project_id)
    if d.exists():
        shutil.rmtree(d)
