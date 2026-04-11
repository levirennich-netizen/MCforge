"""Project CRUD endpoints."""

from fastapi import APIRouter, HTTPException

import database as db
from models import CreateProjectRequest, Project
from services.file_manager import cleanup_project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=Project)
async def create_project(req: CreateProjectRequest):
    project = Project(name=req.name, style_preset=req.style_preset,
                      target_duration_seconds=req.target_duration_seconds)
    return db.create_project(project)


@router.get("", response_model=list[Project])
async def list_projects():
    return db.list_projects()


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    cleanup_project(project_id)
    db.delete_project(project_id)
    return {"status": "deleted"}
