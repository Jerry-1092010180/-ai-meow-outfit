#!/usr/bin/env python3
"""Build the competition demo video from the validated mobile H5 screenshots."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
VIDEO_DIR = ROOT / "deliverables" / "video"
UI_DIR = ROOT / "deliverables" / "ui"
BUILD_DIR = VIDEO_DIR / "build"
BOARD_DIR = BUILD_DIR / "boards"
AUDIO_DIR = BUILD_DIR / "audio"
SEGMENT_DIR = BUILD_DIR / "segments"

WIDTH = 1920
HEIGHT = 1080
FPS = 30
VOICE = "Tingting"
VOICE_RATE = 220
FINAL_SPEED = 1.08

FONT_BOLD_PATH = Path("/System/Library/Fonts/STHeiti Medium.ttc")
FONT_LIGHT_PATH = Path("/System/Library/Fonts/STHeiti Light.ttc")

BLACK = "#0B0B0B"
WHITE = "#FFFFFF"
CREAM = "#F6F4EE"
LIME = "#DFFF3F"
PINK = "#EF5B82"
BLUE = "#3158F5"
GRAY = "#646464"
PALE_BLUE = "#DDE5FF"


SCENES = [
    {
        "kind": "intro",
        "eyebrow": "MIAOJIE PLAY · OPC BOUNTY 03",
        "title": "喵街 AI 今日角色",
        "subtitle": "把每日打开、AIGC 内容、好友分享与到店转化，做成一场每天更新的时尚游戏。",
        "narration": "喵街中低频会员缺的，不是又一个签到按钮，而是每天都值得打开的新内容。我们把今天穿什么，变成一场由人工智能推动的每日角色游戏。",
        "accent": LIME,
        "minimum_duration": 9.0,
    },
    {
        "kind": "phone",
        "image": "01-daily-quest-lobby.png",
        "eyebrow": "01 · DAILY HOOK",
        "title": "每天打开，不是每天重复",
        "subtitle": "七日连续剧情，把签到改造成追更。",
        "bullets": [
            "每日更换角色场景、天气和商品顺序",
            "角色卡收藏 + 连续完成进度",
            "首页直接给出明日剧情与更新时间",
        ],
        "badge": "可验证的每日回访机制",
        "narration": "每天早上，用户会收到一个只在当天开放的城市角色副本。场景、天气、门店商品池和明日预告每天变化，七天连续剧情让打开应用成为追更，而不是机械签到。",
        "accent": PINK,
        "minimum_duration": 11.0,
    },
    {
        "kind": "phone",
        "image": "02-three-round-choice.png",
        "eyebrow": "02 · 60-SECOND PLAY",
        "title": "三次直觉选择，降低参与门槛",
        "subtitle": "先定轮廓，再选主角，最后补上记忆点。",
        "bullets": [
            "60 秒内完成三轮三选一",
            "真实品牌、价格、楼层与库存信息",
            "每次选择都会进入后续 AI 决策",
        ],
        "badge": "不是浏览货架，而是在完成角色任务",
        "narration": "进入副本后，用户只需六十秒完成三轮直觉选择：先定轮廓，再选主角单品，最后补上记忆点。所有候选都带品牌、价格、楼层和库存信息。",
        "accent": BLUE,
        "minimum_duration": 10.0,
    },
    {
        "kind": "phone",
        "image": "03-ai-generation.png",
        "eyebrow": "03 · SUBSTANTIVE AIGC",
        "title": "AI 改变玩法结果，而不是装饰页面",
        "subtitle": "多源输入共同决定今天的两套答案。",
        "bullets": [
            "天气 + 今日场景",
            "用户风格画像 + 本轮三次选择",
            "银泰在售库存 + 身份单品识别",
        ],
        "badge": "AI 决策层",
        "narration": "人工智能在这里不是一句推荐文案。它读取天气、今日场景、用户风格画像、本轮三次选择和银泰在售库存，识别用户最有辨识度的身份单品，并生成两条不同策略。",
        "accent": LIME,
        "minimum_duration": 12.0,
    },
    {
        "kind": "phone",
        "image": "04-ai-ab-result.png",
        "eyebrow": "04 · AI A/B DECISION",
        "title": "A 是我的直觉，B 是 AI 的反转",
        "subtitle": "好友评判的不是随机两套，而是“我”和“AI”谁更懂我。",
        "bullets": [
            "LOOK A：完整保留用户亲手选择的三件",
            "LOOK B：保留一件身份单品，AI 替换两件",
            "两套都输出评分、理由、效果海报与可购同款",
        ],
        "badge": "核心 AIGC 冲突",
        "narration": "方案 A 完整保留用户亲手选的三件，人工智能负责场景适配、评分、解释和封面表达。方案 B 保留一件身份单品，再根据天气、风格和库存替换另外两件。两套都来自这一次真实输入，不是随机抽签。",
        "accent": PINK,
        "minimum_duration": 17.0,
    },
    {
        "kind": "phone",
        "image": "05-friend-final-judge.png",
        "eyebrow": "05 · SOCIAL ACTION",
        "title": "分享一个有关系价值的问题",
        "subtitle": "“哪套更像我？”比“帮我点一下”更值得回应。",
        "bullets": [
            "分享链接携带本局真实 A/B 商品 ID",
            "好友独立选择最终封面",
            "好友获得灵感值与裁判徽章，并可立即开局",
        ],
        "badge": "真实社交动作",
        "narration": "用户把两套真实方案分享给好友。好友面对的不是帮忙点一下，而是一个有关系价值的问题：哪套更像你？一次选择即可完成最终封面裁决，并获得自己的灵感奖励。",
        "accent": BLUE,
        "minimum_duration": 12.0,
    },
    {
        "kind": "phone",
        "image": "06-store-reward-unlocked.png",
        "eyebrow": "06 · BUSINESS LOOP",
        "title": "社交回流，直接连接到店与复购",
        "subtitle": "游戏奖励不止是积分，还能落到银泰真实商品和门店任务。",
        "bullets": [
            "好友投票解锁到店试穿券和数字衣橱卡",
            "展示同款品牌、价格和门店楼层",
            "到店试穿与核销结果回流后续推荐",
        ],
        "badge": "线上互动 → 线下转化",
        "narration": "好友投票回流后，发起者解锁到店试穿券和数字衣橱卡。结果页继续展示可购买同款、品牌、价格和门店楼层，把社交互动自然连接到银泰到店和复购。",
        "accent": LIME,
        "minimum_duration": 12.0,
    },
    {
        "kind": "outro",
        "eyebrow": "FROM PLAY TO GROWTH",
        "title": "一条可以现场验证的增长链路",
        "subtitle": "每日打开 → AI 内容 → 好友传播 → 到店复购",
        "narration": "当前原型已经真实跑通每日内容、双方案决策、分享参数、好友投票和到店任务。个人穿搭图仍明确标注为效果示意，生产版将通过接口网关调用私有算力并由内容分发网络返回。我们不承诺未经验证的增长，只交付一条可以现场操作、可以埋点验证的商业闭环。",
        "accent": PINK,
        "minimum_duration": 16.0,
    },
]


def run(command: list[str]) -> None:
    print("+", " ".join(command))
    subprocess.run(command, check=True)


def font(size: int, *, light: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_LIGHT_PATH if light else FONT_BOLD_PATH
    return ImageFont.truetype(str(path), size=size)


def text_width(draw: ImageDraw.ImageDraw, value: str, face: ImageFont.FreeTypeFont) -> float:
    box = draw.textbbox((0, 0), value, font=face)
    return box[2] - box[0]


def wrap_text(draw: ImageDraw.ImageDraw, value: str, face: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in value.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for char in paragraph:
            candidate = current + char
            if current and text_width(draw, candidate, face) > max_width:
                lines.append(current)
                current = char
            else:
                current = candidate
        if current:
            lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    face: ImageFont.FreeTypeFont,
    fill: str,
    max_width: int,
    line_gap: int = 10,
    max_lines: int | None = None,
) -> int:
    x, y = xy
    lines = wrap_text(draw, value, face, max_width)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            lines[-1] = lines[-1].rstrip("，。；：") + "…"
    line_height = face.size + line_gap
    for index, line in enumerate(lines):
        draw.text((x, y + index * line_height), line, font=face, fill=fill)
    return y + len(lines) * line_height


def draw_halftone(draw: ImageDraw.ImageDraw, color: str, *, spacing: int = 26, radius: int = 2) -> None:
    for y in range(16, HEIGHT, spacing):
        offset = spacing // 2 if (y // spacing) % 2 else 0
        for x in range(16 + offset, WIDTH, spacing):
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


def paste_phone(canvas: Image.Image, screenshot_path: Path, accent: str) -> None:
    screenshot = Image.open(screenshot_path).convert("RGB")
    screenshot = ImageOps.fit(screenshot, (415, 900), method=Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rectangle((112, 72, 531, 976), fill=(11, 11, 11, 255))
    shadow_draw.rectangle((100, 60, 519, 964), fill=accent)
    canvas.alpha_composite(shadow)
    canvas.paste(screenshot, (92, 52))
    border_draw = ImageDraw.Draw(canvas)
    border_draw.rectangle((91, 51, 508, 953), outline=BLACK, width=4)


def draw_subtitle(canvas: Image.Image, narration: str, accent: str) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle((0, 938, WIDTH, HEIGHT), fill=(8, 8, 8, 244))
    overlay_draw.rectangle((0, 938, 18, HEIGHT), fill=accent)
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)
    draw_wrapped(draw, (70, 964), narration, font(28, light=True), WHITE, 1780, line_gap=7, max_lines=3)


def draw_footer(draw: ImageDraw.ImageDraw, scene_number: int, accent: str, *, dark: bool = False) -> None:
    fill = WHITE if dark else BLACK
    muted = "#A7A7A7" if dark else GRAY
    draw.text((602, 876), "AI 喵搭 · 可运行 H5 商业原型", font=font(20), fill=fill)
    draw.text((1640, 876), f"{scene_number:02d} / {len(SCENES):02d}", font=font(20), fill=muted)
    draw.rectangle((602, 916, 1810, 922), fill="#D6D2C8" if not dark else "#343434")
    progress_end = 602 + int(1208 * scene_number / len(SCENES))
    draw.rectangle((602, 916, progress_end, 922), fill=accent)


def render_phone_scene(scene: dict, scene_number: int) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(canvas)
    draw_halftone(draw, "#E5E0D6", spacing=30, radius=2)
    draw.rectangle((0, 0, 24, HEIGHT), fill=scene["accent"])
    paste_phone(canvas, UI_DIR / scene["image"], scene["accent"])

    draw.rectangle((602, 66, 1810, 70), fill=BLACK)
    draw.text((602, 92), scene["eyebrow"], font=font(24), fill=BLUE)
    draw_wrapped(draw, (602, 142), scene["title"], font(64), BLACK, 1180, line_gap=10, max_lines=2)
    draw_wrapped(draw, (602, 304), scene["subtitle"], font(30, light=True), GRAY, 1130, line_gap=8, max_lines=2)

    bullet_y = 420
    for index, bullet in enumerate(scene["bullets"], start=1):
        draw.rectangle((602, bullet_y, 1770, bullet_y + 96), fill=WHITE, outline=BLACK, width=2)
        draw.rectangle((602, bullet_y, 616, bullet_y + 96), fill=scene["accent"])
        draw.rectangle((638, bullet_y + 20, 692, bullet_y + 74), fill=BLACK)
        number = str(index)
        number_box = draw.textbbox((0, 0), number, font=font(24))
        number_width = number_box[2] - number_box[0]
        draw.text((665 - number_width / 2, bullet_y + 31), number, font=font(24), fill=WHITE)
        draw_wrapped(draw, (724, bullet_y + 26), bullet, font(29), BLACK, 1000, line_gap=6, max_lines=2)
        bullet_y += 112

    badge_width = max(320, int(text_width(draw, scene["badge"], font(24))) + 72)
    draw.rectangle((602, 784, 602 + badge_width, 838), fill=scene["accent"], outline=BLACK, width=2)
    draw.text((628, 798), scene["badge"], font=font(24), fill=BLACK)
    draw_footer(draw, scene_number, scene["accent"])
    draw_subtitle(canvas, scene["narration"], scene["accent"])
    return canvas


def paste_rotated_phone(canvas: Image.Image, image_path: Path, xy: tuple[int, int], angle: float, scale: float) -> None:
    screenshot = Image.open(image_path).convert("RGB")
    width = int(430 * scale)
    height = int(932 * scale)
    screenshot = screenshot.resize((width, height), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (width + 18, height + 18), WHITE)
    frame.paste(screenshot, (9, 9))
    framed = frame.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    shadow = Image.new("RGBA", framed.size, (0, 0, 0, 0))
    shadow.alpha_composite(framed, (10, 10))
    canvas.alpha_composite(framed, xy)


def render_intro(scene: dict, scene_number: int) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), BLACK)
    draw = ImageDraw.Draw(canvas)
    draw_halftone(draw, "#292929", spacing=30, radius=2)
    draw.rectangle((0, 0, 28, HEIGHT), fill=scene["accent"])
    draw.rectangle((76, 80, 560, 126), fill=scene["accent"])
    draw.text((94, 90), scene["eyebrow"], font=font(22), fill=BLACK)
    draw_wrapped(draw, (84, 198), scene["title"], font(104), WHITE, 1020, line_gap=8, max_lines=2)
    draw_wrapped(draw, (88, 440), scene["subtitle"], font(38, light=True), "#C7C7C7", 940, line_gap=12, max_lines=3)

    tags = ["每日打开", "AI 双方案", "好友封面", "到店转化"]
    tag_x = 88
    for index, tag in enumerate(tags):
        tag_face = font(25)
        tag_width = int(text_width(draw, tag, tag_face)) + 54
        tag_color = [LIME, PINK, PALE_BLUE, WHITE][index]
        draw.rectangle((tag_x, 650, tag_x + tag_width, 708), fill=tag_color, outline=WHITE, width=1)
        draw.text((tag_x + 27, 665), tag, font=tag_face, fill=BLACK)
        tag_x += tag_width + 16

    paste_rotated_phone(canvas, UI_DIR / "01-daily-quest-lobby.png", (1255, 65), -5.0, 0.73)
    paste_rotated_phone(canvas, UI_DIR / "04-ai-ab-result.png", (1450, 90), 3.0, 0.75)
    draw.text((88, 838), "18—40 岁喵街中低频会员", font=font(25), fill=scene["accent"])
    draw_subtitle(canvas, scene["narration"], scene["accent"])
    return canvas


def draw_flow_box(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], index: int, title: str, color: str) -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, fill=WHITE, outline=BLACK, width=3)
    draw.rectangle((x1, y1, x1 + 14, y2), fill=color)
    draw.text((x1 + 34, y1 + 24), f"0{index}", font=font(22), fill=BLUE)
    draw_wrapped(draw, (x1 + 34, y1 + 62), title, font(30), BLACK, x2 - x1 - 62, line_gap=6, max_lines=2)


def render_outro(scene: dict, scene_number: int) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), CREAM)
    draw = ImageDraw.Draw(canvas)
    draw_halftone(draw, "#E1DCD1", spacing=28, radius=2)
    draw.rectangle((0, 0, WIDTH, 24), fill=scene["accent"])
    draw.text((82, 82), scene["eyebrow"], font=font(24), fill=BLUE)
    draw_wrapped(draw, (82, 132), scene["title"], font(74), BLACK, 1760, line_gap=10, max_lines=2)
    draw.text((84, 302), scene["subtitle"], font=font(34, light=True), fill=GRAY)

    flow_titles = ["每日打开", "60 秒决策", "AI 双方案", "好友投票", "到店复购"]
    flow_colors = [LIME, BLUE, PINK, LIME, BLUE]
    box_width = 310
    gap = 42
    start_x = 82
    for index, (title, color) in enumerate(zip(flow_titles, flow_colors), start=1):
        x1 = start_x + (index - 1) * (box_width + gap)
        draw_flow_box(draw, (x1, 410, x1 + box_width, 570), index, title, color)
        if index < len(flow_titles):
            arrow_x = x1 + box_width + 11
            draw.line((arrow_x, 490, arrow_x + 20, 490), fill=BLACK, width=5)
            draw.polygon([(arrow_x + 20, 480), (arrow_x + 36, 490), (arrow_x + 20, 500)], fill=BLACK)

    draw.rectangle((82, 654, 894, 842), fill=BLACK)
    draw.text((116, 686), "当前已真实实现", font=font(24), fill=LIME)
    draw_wrapped(draw, (116, 734), "每日副本 · A/B 决策 · 分享参数 · 好友投票 · 到店任务", font(29), WHITE, 730, line_gap=8, max_lines=3)

    draw.rectangle((930, 654, 1738, 842), fill=WHITE, outline=BLACK, width=3)
    draw.text((964, 686), "生产接入边界", font=font(24), fill=PINK)
    draw_wrapped(draw, (964, 734), "私有 AIGC 算力 · 个性穿搭图 · CDN 回传 · 账户级回执", font(29), BLACK, 720, line_gap=8, max_lines=3)

    draw_footer(draw, scene_number, scene["accent"])
    draw_subtitle(canvas, scene["narration"], scene["accent"])
    return canvas


def render_boards() -> list[Path]:
    BOARD_DIR.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for index, scene in enumerate(SCENES, start=1):
        if scene["kind"] == "intro":
            board = render_intro(scene, index)
        elif scene["kind"] == "outro":
            board = render_outro(scene, index)
        else:
            board = render_phone_scene(scene, index)
        path = BOARD_DIR / f"scene-{index:02d}.png"
        board.convert("RGB").save(path, quality=96)
        paths.append(path)
    shutil.copyfile(paths[0], VIDEO_DIR / "喵街AI今日角色-视频封面.png")
    return paths


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def generate_audio() -> list[Path]:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for index, scene in enumerate(SCENES, start=1):
        path = AUDIO_DIR / f"scene-{index:02d}.aiff"
        run(["say", "-v", VOICE, "-r", str(VOICE_RATE), "-o", str(path), scene["narration"]])
        if path.stat().st_size <= 4096:
            raise RuntimeError(f"Voice generation returned an empty file: {path}")
        paths.append(path)
    return paths


def render_segments(boards: list[Path], audio_paths: list[Path]) -> tuple[list[Path], list[float]]:
    SEGMENT_DIR.mkdir(parents=True, exist_ok=True)
    segment_paths: list[Path] = []
    durations: list[float] = []
    for index, (scene, board, audio_path) in enumerate(zip(SCENES, boards, audio_paths), start=1):
        audio_duration = probe_duration(audio_path)
        duration = max(float(scene["minimum_duration"]), audio_duration + 1.5)
        durations.append(duration)
        segment_path = SEGMENT_DIR / f"scene-{index:02d}.mp4"
        fade_out = max(0.0, duration - 0.3)
        ping_frequency = 620 + index * 35
        filter_complex = (
            "[0:v]scale=1920:1080,"
            "zoompan=z='min(max(zoom,pzoom)+0.000012,1.006)':"
            "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,"
            f"fade=t=in:st=0:d=0.28,fade=t=out:st={fade_out:.3f}:d=0.28,format=yuv420p[v];"
            f"[1:a]adelay=650,volume=1.2,apad=pad_dur={duration:.3f},"
            f"afade=t=in:st=0.55:d=0.2,afade=t=out:st={fade_out:.3f}:d=0.28[voice];"
            f"[2:a]volume=0.08,adelay=180,apad=pad_dur={duration:.3f}[ping];"
            "[voice][ping]amix=inputs=2:duration=longest:dropout_transition=0[a]"
        )
        run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-stats",
                "-y",
                "-loop",
                "1",
                "-framerate",
                str(FPS),
                "-i",
                str(board),
                "-i",
                str(audio_path),
                "-f",
                "lavfi",
                "-i",
                f"sine=frequency={ping_frequency}:sample_rate=48000:duration=0.12",
                "-filter_complex",
                filter_complex,
                "-map",
                "[v]",
                "-map",
                "[a]",
                "-t",
                f"{duration:.3f}",
                "-r",
                str(FPS),
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ar",
                "48000",
                "-ac",
                "2",
                "-movflags",
                "+faststart",
                str(segment_path),
            ]
        )
        segment_paths.append(segment_path)
    return segment_paths, durations


def concat_segments(segment_paths: list[Path], durations: list[float]) -> Path:
    concat_path = BUILD_DIR / "segments.txt"
    concat_path.write_text("".join(f"file '{path.as_posix()}'\n" for path in segment_paths), encoding="utf-8")
    master_path = BUILD_DIR / "voice-master.mp4"
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-stats",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(master_path),
        ]
    )
    final_path = VIDEO_DIR / "喵街AI今日角色-比赛Demo-v1.mp4"
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-stats",
            "-y",
            "-i",
            str(master_path),
            "-filter_complex",
            f"[0:v]setpts=PTS/{FINAL_SPEED},fps={FPS},format=yuv420p[v];"
            f"[0:a]atempo={FINAL_SPEED},loudnorm=I=-16:TP=-1.5:LRA=11[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(final_path),
        ]
    )
    timeline = []
    cursor = 0.0
    for index, (scene, duration) in enumerate(zip(SCENES, durations), start=1):
        final_duration = duration / FINAL_SPEED
        timeline.append(
            {
                "scene": index,
                "title": scene["title"],
                "start": round(cursor, 3),
                "end": round(cursor + final_duration, 3),
                "duration": round(final_duration, 3),
                "source_duration": round(duration, 3),
                "narration": scene["narration"],
            }
        )
        cursor += final_duration
    (VIDEO_DIR / "timeline.json").write_text(
        json.dumps({"duration": round(cursor, 3), "scenes": timeline}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return final_path


def validate_video(path: Path) -> None:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size,bit_rate:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    metadata = json.loads(result.stdout)
    duration = float(metadata["format"]["duration"])
    video_streams = [stream for stream in metadata["streams"] if stream.get("codec_type") == "video"]
    audio_streams = [stream for stream in metadata["streams"] if stream.get("codec_type") == "audio"]
    if not video_streams or not audio_streams:
        raise RuntimeError("Final video must contain both video and audio streams")
    video_stream = video_streams[0]
    if video_stream.get("width") != WIDTH or video_stream.get("height") != HEIGHT:
        raise RuntimeError(f"Unexpected video size: {video_stream.get('width')}x{video_stream.get('height')}")
    if duration > 180:
        raise RuntimeError(f"Video exceeds competition limit: {duration:.2f}s")
    (VIDEO_DIR / "validation.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


def main() -> None:
    for directory in (VIDEO_DIR, BUILD_DIR, BOARD_DIR, AUDIO_DIR, SEGMENT_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    for screenshot in [scene.get("image") for scene in SCENES if scene.get("image")]:
        path = UI_DIR / str(screenshot)
        if not path.exists():
            raise FileNotFoundError(path)
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise RuntimeError("ffmpeg and ffprobe are required")
    boards = render_boards()
    audio_paths = generate_audio()
    segments, durations = render_segments(boards, audio_paths)
    final_path = concat_segments(segments, durations)
    validate_video(final_path)
    print(f"FINAL_VIDEO={final_path}")


if __name__ == "__main__":
    main()
