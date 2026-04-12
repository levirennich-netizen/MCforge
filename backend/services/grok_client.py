"""AI client — uses Groq/Gemini (free) with Grok fallback, via OpenAI SDK."""

from __future__ import annotations

import asyncio
import base64
import json
from pathlib import Path
from typing import Any, Optional

import httpx
from openai import AsyncOpenAI

from config import settings

_client: Optional[AsyncOpenAI] = None
_semaphore = asyncio.Semaphore(3)


def get_client() -> AsyncOpenAI:
    """Get the AI client — prefers Groq, then Gemini, then Grok."""
    global _client
    if _client is None:
        if settings.GROQ_API_KEY:
            _client = AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
            )
        elif settings.GEMINI_API_KEY:
            _client = AsyncOpenAI(
                api_key=settings.GEMINI_API_KEY,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            )
        else:
            _client = AsyncOpenAI(
                api_key=settings.XAI_API_KEY,
                base_url="https://api.x.ai/v1",
            )
    return _client


def _chat_model() -> str:
    """Return the model name based on which provider is configured."""
    if settings.GROQ_API_KEY:
        return settings.GROQ_MODEL
    if settings.GEMINI_API_KEY:
        return settings.GEMINI_MODEL
    return settings.GROK_CHAT_MODEL


def _vision_model() -> str:
    if settings.GROQ_API_KEY:
        return "llama-3.2-90b-vision-preview"  # Groq vision model
    if settings.GEMINI_API_KEY:
        return settings.GEMINI_MODEL
    return settings.GROK_VISION_MODEL


async def chat_completion(
    messages: list[dict],
    model: Optional[str] = None,
    tools: Optional[list[dict]] = None,
    tool_choice: str = "auto",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """Send a chat completion request."""
    async with _semaphore:
        client = get_client()
        kwargs: dict[str, Any] = {
            "model": model or _chat_model(),
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice

        response = await client.chat.completions.create(**kwargs)
        msg = response.choices[0].message

        if msg.tool_calls:
            tool_call = msg.tool_calls[0]
            return {
                "type": "function_call",
                "name": tool_call.function.name,
                "arguments": json.loads(tool_call.function.arguments),
            }

        return {
            "type": "text",
            "content": msg.content or "",
        }


async def chat_completion_stream(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
):
    """Stream a chat completion, yielding content delta strings."""
    async with _semaphore:
        client = get_client()
        stream = await client.chat.completions.create(
            model=model or _chat_model(),
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content


async def analyze_image(
    image_path: str,
    prompt: str,
    model: Optional[str] = None,
) -> dict:
    """Send an image to AI vision for analysis."""
    async with _semaphore:
        image_data = Path(image_path).read_bytes()
        b64 = base64.b64encode(image_data).decode("utf-8")

        client = get_client()
        response = await client.chat.completions.create(
            model=model or _vision_model(),
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            temperature=0.3,
            max_tokens=1024,
        )
        content = response.choices[0].message.content or ""

        try:
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except json.JSONDecodeError:
            pass

        return {"raw": content}


async def generate_video_pollinations(
    prompt: str,
    model: str = "seedance",
    duration: int = 5,
) -> bytes:
    """Generate a video via Pollinations.ai. Returns MP4 bytes."""
    import urllib.parse
    from config import settings

    encoded = urllib.parse.quote(prompt)
    params = f"model={model}&duration={duration}&nologo=true&safe=false"
    api_key = getattr(settings, "POLLINATIONS_API_KEY", "")
    if api_key:
        params += f"&key={api_key}"

    url = f"https://gen.pollinations.ai/video/{encoded}?{params}"
    async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def generate_image_pollinations(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
) -> bytes:
    """Generate an image via Pollinations.ai (free, no API key needed)."""
    import urllib.parse
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&nologo=true"
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


# Mapping from app voice IDs to edge-tts voice names
_EDGE_VOICE_MAP = {
    "rex": "en-US-GuyNeural",
    "eve": "en-US-JennyNeural",
    "sal": "en-US-AriaNeural",
}


async def generate_tts(
    text: str,
    voice_id: str = "rex",
    language: str = "en",
) -> bytes:
    """Generate speech audio via edge-tts (free, no API key). Returns MP3 bytes."""
    import io
    import edge_tts

    voice = _EDGE_VOICE_MAP.get(voice_id, "en-US-GuyNeural")
    communicate = edge_tts.Communicate(text, voice)

    buffer = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buffer.write(chunk["data"])

    audio_bytes = buffer.getvalue()
    if not audio_bytes:
        raise RuntimeError(f"edge-tts returned no audio for voice '{voice}'")
    return audio_bytes
