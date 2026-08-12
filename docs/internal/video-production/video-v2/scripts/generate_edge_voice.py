#!/usr/bin/env python3
"""Generate one continuous Edge-TTS narration and preserve word timestamps."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


async def generate(
    script_path: Path,
    audio_path: Path,
    timing_path: Path,
    voice: str,
    rate: str,
    pitch: str,
) -> None:
    text = script_path.read_text(encoding="utf-8").strip()
    communicate = edge_tts.Communicate(
        text,
        voice=voice,
        rate=rate,
        pitch=pitch,
        boundary="WordBoundary",
    )

    timing: list[dict[str, object]] = []
    with audio_path.open("wb") as audio:
        async for item in communicate.stream():
            if item["type"] == "audio":
                audio.write(item["data"])
            elif item["type"] == "WordBoundary":
                timing.append(
                    {
                        "offset": round(float(item["offset"]) / 10_000_000, 6),
                        "duration": round(float(item["duration"]) / 10_000_000, 6),
                        "text": str(item["text"]),
                    }
                )

    timing_path.write_text(
        json.dumps(
            {
                "voice": voice,
                "rate": rate,
                "pitch": pitch,
                "script": str(script_path),
                "words": timing,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "audio": str(audio_path),
                "timing": str(timing_path),
                "word_boundaries": len(timing),
                "first": timing[0] if timing else None,
                "last": timing[-1] if timing else None,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("script", type=Path)
    parser.add_argument("audio", type=Path)
    parser.add_argument("timing", type=Path)
    parser.add_argument("--voice", default="zh-CN-YunyangNeural")
    parser.add_argument("--rate", default="+16%")
    parser.add_argument("--pitch", default="-2Hz")
    args = parser.parse_args()

    args.audio.parent.mkdir(parents=True, exist_ok=True)
    args.timing.parent.mkdir(parents=True, exist_ok=True)
    asyncio.run(
        generate(
            args.script,
            args.audio,
            args.timing,
            args.voice,
            args.rate,
            args.pitch,
        )
    )


if __name__ == "__main__":
    main()
