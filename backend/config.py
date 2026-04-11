import json

from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path


class Settings(BaseSettings):
    # xAI / Grok (legacy)
    XAI_API_KEY: str = "xai-your-key-here"
    GROK_VISION_MODEL: str = "grok-2-vision-1212"
    GROK_CHAT_MODEL: str = "grok-3-fast-beta"

    # Google Gemini (free tier)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Paths
    DATA_DIR: Path = Path("./data")
    FFMPEG_PATH: str = "ffmpeg"
    FFPROBE_PATH: str = "ffprobe"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [s.strip() for s in v.split(",")]
        return v

    # Processing
    MAX_UPLOAD_SIZE_MB: int = 5000
    MAX_CONCURRENT_JOBS: int = 1

    # Whisper
    WHISPER_MODEL_SIZE: str = "base"
    WHISPER_DEVICE: str = "cpu"

    model_config = {
        "env_file": ("../.env.local", ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
