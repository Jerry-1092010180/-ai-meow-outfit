#!/usr/bin/env python3
"""Build frame-accurate caption data and an ASS subtitle track from the final voice."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DELIVERABLES = ROOT.parent / "video-v3"
SCRIPT = ROOT / "public" / "voiceover_full.txt"
VOICE = DELIVERABLES / "processed_voice.wav"
TIMELINE = ROOT / "src" / "timeline-v3.json"
ASS = DELIVERABLES / "subtitles.ass"
VOICE_OFFSET = 1.5

HIGHLIGHTS = [
    "和好友一起成为内容",
    "可以现场跑通",
    "完整增长链路",
    "连续七天",
    "一分钟",
    "完整 Look",
    "五层商品",
    "角色资产",
    "新的商品浏览",
    "二到四人",
    "互不覆盖",
    "银泰穿搭广场",
    "经营闭环",
    "现场验证",
    "AI 喵搭",
    "AIGC",
    "AI",
    "好友",
    "分享",
    "共创",
]


def parse_phrases() -> list[dict[str, object]]:
    text = SCRIPT.read_text(encoding="utf-8")
    text = re.sub(r"\[\[.*?\]\]", "", text)
    phrases: list[dict[str, object]] = []
    for scene, paragraph in enumerate(re.split(r"\n\s*\n", text.strip())):
        for match in re.finditer(r"([^，。？！；：\n]+)([，。？！；：]+|$)", paragraph):
            body = match.group(1).strip()
            punctuation = match.group(2)
            if not body:
                continue
            phrases.append(
                {
                    "scene": scene,
                    "text": f"{body}{punctuation}".strip(),
                    "spoken": body,
                }
            )
    return phrases


def detect_silences() -> list[tuple[float, float, float]]:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(VOICE),
            "-af",
            "silencedetect=n=-44dB:d=0.12",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    starts = [float(value) for value in re.findall(r"silence_start: ([\d.]+)", proc.stderr)]
    ends = [
        (float(end), float(duration))
        for end, duration in re.findall(
            r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", proc.stderr
        )
    ]
    if len(starts) != len(ends):
        raise RuntimeError(f"Unpaired silences: {len(starts)} starts, {len(ends)} ends")
    return [
        (start, end, duration)
        for start, (end, duration) in zip(starts, ends)
        if duration >= 0.2
    ]


def highlight_for(text: str) -> str:
    return next((word for word in HIGHLIGHTS if word in text), "")


def ass_time(seconds: float) -> str:
    centiseconds = max(0, round(seconds * 100))
    hours, rest = divmod(centiseconds, 360000)
    minutes, rest = divmod(rest, 6000)
    secs, cs = divmod(rest, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"


def wrap_text(text: str, width: int = 16) -> str:
    if len(text) <= width:
        return text
    split = min(
        range(max(5, width - 4), min(len(text) - 4, width + 4) + 1),
        key=lambda index: abs(index - len(text) / 2),
    )
    return f"{text[:split]}\\N{text[split:]}"


def ass_karaoke(item: dict[str, object]) -> str:
    text = str(item["text"])
    duration_cs = max(len(text), round((float(item["end"]) - float(item["start"])) * 100))
    base, extra = divmod(duration_cs, max(1, len(text)))
    highlight = str(item["highlight"])
    highlight_start = text.find(highlight) if highlight else -1
    highlight_end = highlight_start + len(highlight)
    chars: list[str] = []
    for index, char in enumerate(text):
        if index == 16 and len(text) > 20:
            chars.append(r"\N")
        color = r"\c&H0048FFD8&\fscx110\fscy110" if highlight_start <= index < highlight_end else r"\c&H00FFFFFF&\fscx100\fscy100"
        chars.append(f"{{\\K{base + (1 if index < extra else 0)}{color}}}{char}")
    return r"{\an2\fad(70,90)\blur0.35}" + "".join(chars)


def main() -> None:
    phrases = parse_phrases()
    silences = detect_silences()
    if len(phrases) != len(silences):
        raise RuntimeError(
            f"Caption alignment mismatch: {len(phrases)} phrases, {len(silences)} speech stops"
        )

    aligned: list[dict[str, object]] = []
    previous_end = 0.0
    for index, (phrase, (silence_start, silence_end, _duration)) in enumerate(
        zip(phrases, silences)
    ):
        text = str(phrase["text"])
        aligned.append(
            {
                "id": index + 1,
                "scene": phrase["scene"],
                "start": round(previous_end + VOICE_OFFSET, 3),
                "end": round(silence_start + VOICE_OFFSET, 3),
                "text": text,
                "display": wrap_text(text).replace(r"\N", "\n"),
                "highlight": highlight_for(text),
            }
        )
        previous_end = silence_end

    TIMELINE.write_text(
        json.dumps(aligned, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    header = """[Script Info]
Title: AI喵搭 比赛路演专业字幕
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Dynamic,PingFang SC,58,&H00FFFFFF,&H007E828C,&HCC090B10,&H76090B10,-1,0,0,0,100,100,1,0,3,4,0,2,110,110,92,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = [
        "Dialogue: 0,{start},{end},Dynamic,,0,0,0,,{text}".format(
            start=ass_time(float(item["start"])),
            end=ass_time(float(item["end"])),
            text=ass_karaoke(item),
        )
        for item in aligned
    ]
    ASS.write_text(header + "\n".join(events) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "captions": len(aligned),
                "first": aligned[0],
                "last": aligned[-1],
                "timeline": str(TIMELINE),
                "ass": str(ASS),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
