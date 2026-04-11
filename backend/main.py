"""MCForge Backend — AI-Powered Minecraft Video Editor API."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database import init_db
from routers import analysis, chat, clips, export, narration, progress, projects, timeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    (settings.DATA_DIR / "projects").mkdir(exist_ok=True)
    (settings.DATA_DIR / "sfx_library").mkdir(exist_ok=True)
    (settings.DATA_DIR / "music_library").mkdir(exist_ok=True)
    print(f"MCForge Backend started. Data dir: {settings.DATA_DIR}")
    yield
    # Shutdown
    print("MCForge Backend shutting down.")


app = FastAPI(
    title="MCForge",
    description="AI-Powered Minecraft Video Editor API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(projects.router)
app.include_router(clips.router)
app.include_router(analysis.router)
app.include_router(timeline.router)
app.include_router(narration.router)
app.include_router(export.router)
app.include_router(progress.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {
        "name": "MCForge",
        "version": "0.1.0",
        "description": "AI-Powered Minecraft Video Editor",
        "endpoints": {
            "projects": "/projects",
            "clips": "/projects/{id}/clips",
            "analysis": "/projects/{id}/analyze",
            "timeline": "/projects/{id}/plan",
            "narration": "/projects/{id}/narration",
            "export": "/projects/{id}/export",
            "progress": "/projects/{id}/progress (SSE)",
            "voices": "/tts/voices",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
