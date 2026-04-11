"""Centralized xAI Grok API client wrapping the OpenAI SDK."""

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
_semaphore = asyncio.Semaphore(3)  # Limit concurrent API calls


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.XAI_API_KEY,
            base_url="https://api.x.ai/v1",
        )
    return _client


async def chat_completion(
    messages: list[dict],
    model: Optional[str] = None,
    tools: Optional[list[dict]] = None,
    tool_choice: str = "auto",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    """Send a chat completion request to Grok."""
    async with _semaphore:
        client = get_client()
        kwargs: dict[str, Any] = {
            "model": model or settings.GROK_CHAT_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice

        response = await client.chat.completions.create(**kwargs)
        msg = response.choices[0].message

        # If function calling was used, extract the function args
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
            model=model or settings.GROK_CHAT_MODEL,
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
    """Send an image to Grok Vision for analysis."""
    async with _semaphore:
        # Read and encode image
        image_data = Path(image_path).read_bytes()
        b64 = base64.b64encode(image_data).decode("utf-8")

        client = get_client()
        response = await client.chat.completions.create(
            model=model or settings.GROK_VISION_MODEL,
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

        # Try to parse JSON from the response
        try:
            # Find JSON in the response
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except json.JSONDecodeError:
            pass

        return {"raw": content}


async def generate_tts(
    text: str,
    voice_id: str = "rex",
    language: str = "en",
) -> bytes:
    """Generate speech audio via Grok TTS API. Returns raw audio bytes."""
    async with _semaphore:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.x.ai/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {settings.XAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "grok-2-tts",
                    "input": text,
                    "voice": voice_id,
                },
            )
            response.raise_for_status()
            return response.content
