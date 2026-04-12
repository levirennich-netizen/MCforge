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
    """Generate a video from AI images + FFmpeg Ken Burns effects (free).

    Generates multiple AI images via Pollinations (free, no key needed),
    then combines them into a cinematic video with zoom/pan transitions.
    """
    import asyncio
    import subprocess
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

    # Generate images concurrently (free, no API key)
    tasks = [
        generate_image_pollinations(variations[i % len(variations)], width=1920, height=1080)
        for i in range(num_images)
    ]
    image_results = await asyncio.gather(*tasks, return_exceptions=True)
    image_bytes_list = [r for r in image_results if isinstance(r, bytes) and len(r) > 1000]

    if len(image_bytes_list) < 2:
        raise RuntimeError("Failed to generate enough images for video")

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
    """Build a Ken Burns video from images using FFmpeg."""
    import subprocess

    # Ken Burns effects: alternate between zoom-in and zoom-out with panning
    effects = [
        "zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={d}:s=1920x1080:fps=30",
        "zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/3-(ih/zoom/3)':d={d}:s=1920x1080:fps=30",
        "zoompan=z='min(zoom+0.001,1.2)':x='iw/4-(iw/zoom/4)':y='ih/2-(ih/zoom/2)':d={d}:s=1920x1080:fps=30",
        "zoompan=z='min(zoom+0.002,1.4)':x='iw*3/4-(iw/zoom*3/4)':y='ih/2-(ih/zoom/2)':d={d}:s=1920x1080:fps=30",
    ]

    frames_per_image = int(secs_per_image * 30)
    crossfade_frames = min(15, frames_per_image // 3)  # 0.5s crossfade
    crossfade_secs = crossfade_frames / 30

    # Build filter graph
    inputs = []
    filter_parts = []

    for i, img_path in enumerate(img_paths):
        inputs.extend(["-loop", "1", "-t", str(secs_per_image + 1), "-i", str(img_path)])
        effect = effects[i % len(effects)].format(d=frames_per_image + 30)
        filter_parts.append(f"[{i}:v]{effect},setpts=PTS-STARTPTS[v{i}]")

    # Chain crossfades between all segments
    if len(img_paths) == 1:
        filter_parts.append(f"[v0]null[outv]")
    else:
        # First crossfade
        filter_parts.append(
            f"[v0][v1]xfade=transition=fade:duration={crossfade_secs}:offset={secs_per_image - crossfade_secs}[xf0]"
        )
        # Chain remaining crossfades
        for i in range(2, len(img_paths)):
            prev = f"xf{i-2}"
            curr_offset = secs_per_image * i - crossfade_secs * i
            filter_parts.append(
                f"[{prev}][v{i}]xfade=transition=fade:duration={crossfade_secs}:offset={curr_offset}[xf{i-1}]"
            )
        last_label = f"xf{len(img_paths)-2}"
        filter_parts.append(f"[{last_label}]null[outv]")

    filter_complex = ";\n".join(filter_parts)

    cmd = [
        ffmpeg_path, "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-r", "30",
        "-t", str(secs_per_image * len(img_paths)),
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg Ken Burns failed: {result.stderr.decode()[:500]}")


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
