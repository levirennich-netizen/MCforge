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


async def _fetch_image_with_retry(prompt: str, width: int = 1920, height: int = 1080, retries: int = 3) -> bytes:
    """Fetch a single image with retries and longer timeout."""
    import asyncio
    for attempt in range(retries):
        try:
            return await generate_image_pollinations(prompt, width=width, height=height)
        except Exception:
            if attempt < retries - 1:
                await asyncio.sleep(2 * (attempt + 1))
    return b""


async def generate_video_pollinations(
    prompt: str,
    model: str = "cinematic",
    duration: int = 5,
) -> bytes:
    """Generate a video from AI images + FFmpeg Ken Burns effects (free).

    Generates multiple AI images via Pollinations (free, no key needed),
    then combines them into a cinematic video with zoom/pan transitions.
    """
    import asyncio
    import tempfile
    from config import settings

    # Generate more images for longer videos
    num_images = max(3, duration // 2)
    secs_per_image = duration / num_images

    # Create varied prompts for each frame
    variations = [
        prompt,
        f"{prompt}, different angle",
        f"{prompt}, close-up shot",
        f"{prompt}, wide establishing shot",
        f"{prompt}, dramatic lighting",
        f"{prompt}, aerial view",
        f"{prompt}, action moment",
        f"{prompt}, epic scene",
    ]

    # Generate images one at a time to avoid rate limits
    image_bytes_list: list[bytes] = []
    for i in range(num_images):
        img = await _fetch_image_with_retry(variations[i % len(variations)])
        if img and len(img) > 1000:
            image_bytes_list.append(img)
        # Small delay between requests to avoid rate limiting
        if i < num_images - 1:
            await asyncio.sleep(1)

    if len(image_bytes_list) < 2:
        raise RuntimeError(f"Failed to generate enough images for video (got {len(image_bytes_list)}/{num_images})")

    # Write images to temp dir and build video with FFmpeg
    with tempfile.TemporaryDirectory() as tmpdir:
        img_paths = []
        for i, img_bytes in enumerate(image_bytes_list):
            path = Path(tmpdir) / f"img_{i:03d}.jpg"
            path.write_bytes(img_bytes)
            img_paths.append(path)

        output_path = Path(tmpdir) / "output.mp4"
        _build_kenburns_video(img_paths, output_path, secs_per_image, settings.FFMPEG_PATH)
        return output_path.read_bytes()


def _build_kenburns_video(
    img_paths: list[Path], output_path: Path,
    secs_per_image: float, ffmpeg_path: str,
) -> None:
    """Build a Ken Burns video from images using FFmpeg.

    Simple approach: render each image as a clip with zoompan, then concat.
    """
    import subprocess

    tmpdir = output_path.parent
    clip_paths = []

    # Step 1: Render each image as a short video clip with zoom effect
    zoom_styles = [
        # Slow zoom in to center
        "zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
        # Slow zoom in from top-left
        "zoompan=z='min(zoom+0.001,1.2)':x='iw/4-(iw/zoom/4)':y='ih/4-(ih/zoom/4)'",
        # Slow zoom in from right
        "zoompan=z='min(zoom+0.002,1.3)':x='iw*3/4-(iw/zoom*3/4)':y='ih/2-(ih/zoom/2)'",
    ]

    frames = int(secs_per_image * 25)

    for i, img_path in enumerate(img_paths):
        clip_path = tmpdir / f"clip_{i:03d}.mp4"
        zoom = zoom_styles[i % len(zoom_styles)]
        vf = f"{zoom}:d={frames}:s=1280x720:fps=25"

        cmd = [
            ffmpeg_path, "-y",
            "-loop", "1", "-i", str(img_path),
            "-vf", vf,
            "-t", str(secs_per_image),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            str(clip_path),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode == 0 and clip_path.exists():
            clip_paths.append(clip_path)

    if not clip_paths:
        raise RuntimeError("FFmpeg failed to render any clips from images")

    # Step 2: Concat all clips using the concat demuxer
    concat_file = tmpdir / "concat.txt"
    with open(concat_file, "w") as f:
        for cp in clip_paths:
            f.write(f"file '{cp.as_posix()}'\n")

    cmd = [
        ffmpeg_path, "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_file),
        "-c", "copy",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=60)

    # Cleanup temp clips
    for cp in clip_paths:
        cp.unlink(missing_ok=True)
    concat_file.unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg concat failed: {result.stderr.decode()[:500]}")


async def generate_image_pollinations(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
) -> bytes:
    """Generate an image via Pollinations.ai (free, no API key needed)."""
    import urllib.parse
    import random
    encoded = urllib.parse.quote(prompt)
    seed = random.randint(1, 999999)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width={width}&height={height}&nologo=true&seed={seed}"
    async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
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
