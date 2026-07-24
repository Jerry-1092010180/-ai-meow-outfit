#!/usr/bin/env python3
"""Build word-synchronous Remotion and ASS captions from Edge-TTS metadata."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DELIVERABLES = ROOT.parent / "video-v3"
SCRIPT = ROOT / "public" / "voiceover_edge_smooth.txt"
WORD_TIMING = ROOT / "build" / "v3" / "voiceover-edge-smooth-final-words.json"
TIMELINE = ROOT / "src" / "timeline-v3.json"
ASS = DELIVERABLES / "subtitles.ass"
VOICE_OFFSET = 1.5
MAX_CAPTION_CHARS = 17

HIGHLIGHTS = [
    "和好友一起成为内容",
    "现场验证",
    "经营闭环",
    "银泰穿搭广场",
    "新的商品浏览",
    "二到四人",
    "角色资产",
    "五层商品",
    "完整造型",
    "一分钟",
    "连续七天",
    "现场跑通",
    "AI喵搭",
    "AIGC",
    "AI",
    "好友",
    "分享",
    "共创",
]


def normalized(text: str) -> str:
    return "".join(re.findall(r"[\u3400-\u9fffA-Za-z0-9]+", text)).upper()


def parse_phrases() -> list[dict[str, object]]:
    phrases: list[dict[str, object]] = []
    script = SCRIPT.read_text(encoding="utf-8").strip()
    for scene, paragraph in enumerate(re.split(r"\n\s*\n", script)):
        for match in re.finditer(r"([^，。？！；：\n]+)([，。？！；：]+|$)", paragraph):
            body = match.group(1).strip()
            punctuation = match.group(2)
            if body:
                phrases.append(
                    {
                        "scene": scene,
                        "body": body,
                        "punctuation": punctuation,
                    }
                )
    return phrases


def align_phrases(
    phrases: list[dict[str, object]], words: list[dict[str, object]]
) -> list[dict[str, object]]:
    cursor = 0
    aligned: list[dict[str, object]] = []
    for phrase in phrases:
        target = normalized(str(phrase["body"]))
        collected: list[dict[str, object]] = []
        spoken = ""
        while cursor < len(words) and len(spoken) < len(target):
            word = words[cursor]
            collected.append(word)
            spoken += normalized(str(word["text"]))
            cursor += 1
        if spoken != target:
            raise RuntimeError(
                f"Cannot align phrase {phrase['body']!r}: expected {target!r}, got {spoken!r}"
            )
        aligned.append({**phrase, "words": collected})
    if cursor != len(words):
        raise RuntimeError(f"{len(words) - cursor} unconsumed word boundaries")
    return aligned


def split_phrase(phrase: dict[str, object]) -> list[dict[str, object]]:
    words = list(phrase["words"])
    groups: list[list[dict[str, object]]] = []
    current: list[dict[str, object]] = []
    length = 0
    for word in words:
        word_length = len(str(word["text"]))
        if current and length + word_length > MAX_CAPTION_CHARS:
            groups.append(current)
            current = []
            length = 0
        current.append(word)
        length += word_length
    if current:
        groups.append(current)

    items: list[dict[str, object]] = []
    for index, group in enumerate(groups):
        punctuation = str(phrase["punctuation"]) if index == len(groups) - 1 else ""
        text = "".join(str(word["text"]) for word in group) + punctuation
        items.append(
            {
                "scene": int(phrase["scene"]),
                "text": text,
                "words": group,
            }
        )
    return items


def highlight_for(text: str) -> str:
    return next((keyword for keyword in HIGHLIGHTS if keyword in text), "")


def ass_time(seconds: float) -> str:
    centiseconds = max(0, round(seconds * 100))
    hours, rest = divmod(centiseconds, 360000)
    minutes, rest = divmod(rest, 6000)
    secs, cs = divmod(rest, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"


def ass_karaoke(item: dict[str, object]) -> str:
    event_start = float(item["start"])
    highlight = str(item["highlight"])
    cursor = event_start
    chunks = [r"{\an2\fad(70,100)\blur0.35}"]
    for word in item["words"]:
        word_start = float(word["start"])
        word_end = float(word["end"])
        gap = max(0, round((word_start - cursor) * 100))
        duration = max(1, round((word_end - word_start) * 100))
        if gap:
            chunks.append(rf"{{\k{gap}}}")
        token = str(word["text"])
        highlighted = bool(highlight and highlight in str(item["text"]) and token in highlight)
        color = (
            r"\c&H0048FFD8&\fscx112\fscy112"
            if highlighted
            else r"\c&H00FFFFFF&\fscx100\fscy100"
        )
        chunks.append(rf"{{\kf{duration}{color}}}{token}")
        cursor = word_end
    punctuation = re.sub(r"[\u3400-\u9fffA-Za-z0-9]+", "", str(item["text"]))
    if punctuation:
        chunks.append(punctuation)
    return "".join(chunks)


def main() -> None:
    metadata = json.loads(WORD_TIMING.read_text(encoding="utf-8"))
    raw_words = list(metadata["words"])
    phrases = align_phrases(parse_phrases(), raw_words)
    chunks = [chunk for phrase in phrases for chunk in split_phrase(phrase)]

    aligned: list[dict[str, object]] = []
    for index, chunk in enumerate(chunks):
        timed_words = [
            {
                "text": str(word["text"]),
                "start": round(float(word["offset"]) + VOICE_OFFSET, 3),
                "end": round(
                    float(word["offset"]) + float(word["duration"]) + VOICE_OFFSET, 3
                ),
            }
            for word in chunk["words"]
        ]
        start = float(timed_words[0]["start"])
        speech_end = float(timed_words[-1]["end"])
        next_start = (
            float(chunks[index + 1]["words"][0]["offset"]) + VOICE_OFFSET
            if index + 1 < len(chunks)
            else speech_end + 0.22
        )
        end = min(speech_end + 0.22, next_start - 0.04)
        text = str(chunk["text"])
        aligned.append(
            {
                "id": index + 1,
                "scene": int(chunk["scene"]),
                "start": round(start, 3),
                "end": round(max(end, speech_end), 3),
                "text": text,
                "display": text,
                "highlight": highlight_for(text),
                "words": timed_words,
            }
        )

    TIMELINE.write_text(
        json.dumps(aligned, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    header = """[Script Info]
Title: AI喵搭 比赛路演词级动态字幕
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
    ASS.parent.mkdir(parents=True, exist_ok=True)
    ASS.write_text(header + "\n".join(events) + "\n", encoding="utf-8")

    scene_starts = {
        str(scene): next(item["start"] for item in aligned if item["scene"] == scene)
        for scene in range(10)
    }
    print(
        json.dumps(
            {
                "captions": len(aligned),
                "first": aligned[0],
                "last": aligned[-1],
                "scene_starts": scene_starts,
                "timeline": str(TIMELINE),
                "ass": str(ASS),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
