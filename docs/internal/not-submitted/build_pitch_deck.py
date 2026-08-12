#!/usr/bin/env python3
"""Build the competition pitch deck as a polished, source-cited PDF."""

from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
TMP_DIR = ROOT / "tmp" / "pitch-deck"
OUT_PATH = OUT_DIR / "AI喵搭-路演Deck-优化版.pdf"
QR_URL = "https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game"

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 42

INK = HexColor("#111111")
PAPER = HexColor("#F6F4EE")
WHITE = HexColor("#FFFFFF")
MUTED = HexColor("#6E6B70")
SOFT = HexColor("#E9E6DE")
LIME = HexColor("#DFFF3F")
PINK = HexColor("#FF5B88")
BLUE = HexColor("#2455FF")
NAVY = HexColor("#10131D")
CYAN = HexColor("#9DE8FF")
GREEN = HexColor("#43D17D")
RED = HexColor("#EF4B5F")

FONT_REG = "ArialUnicode"
FONT_BOLD = "HeitiMedium"
FONT_LIGHT = "HeitiLight"


def register_fonts() -> None:
    pdfmetrics.registerFont(
        TTFont(FONT_REG, "/System/Library/Fonts/Supplemental/Arial Unicode.ttf")
    )
    pdfmetrics.registerFont(
        TTFont(FONT_BOLD, "/System/Library/Fonts/STHeiti Medium.ttc")
    )
    pdfmetrics.registerFont(
        TTFont(FONT_LIGHT, "/System/Library/Fonts/STHeiti Light.ttc")
    )


def fit_text(text: str, font: str, size: float, width: float, min_size: float = 7) -> float:
    while size > min_size and pdfmetrics.stringWidth(text, font, size) > width:
        size -= 0.4
    return size


def wrap_lines(text: str, font: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for char in paragraph:
            trial = current + char
            if current and pdfmetrics.stringWidth(trial, font, size) > width:
                lines.append(current.rstrip())
                current = char.lstrip() if char == " " else char
            else:
                current = trial
        if current:
            lines.append(current.rstrip())
    return lines


def text_block(
    c: canvas.Canvas,
    text: str,
    x: float,
    y_top: float,
    width: float,
    size: float = 13,
    leading: float | None = None,
    font: str = FONT_REG,
    color=INK,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.45
    lines = wrap_lines(text, font, size, width)
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    y = y_top
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, stroke=INK, radius=6, lw=1):
    c.setLineWidth(lw)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def label(c: canvas.Canvas, text: str, x: float, y: float, fill=INK, color=WHITE, w: float | None = None):
    size = 8.5
    pad_x = 8
    width = w or (pdfmetrics.stringWidth(text, FONT_BOLD, size) + pad_x * 2)
    c.setFillColor(fill)
    c.rect(x, y, width, 20, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont(FONT_BOLD, size)
    c.drawCentredString(x + width / 2, y + 6.2, text)
    return width


def page_header(c: canvas.Canvas, index: int, kicker: str, title: str, subtitle: str | None = None, dark=False):
    fg = WHITE if dark else INK
    muted = HexColor("#AEB1BC") if dark else MUTED
    c.setFillColor(fg)
    c.setFont(FONT_BOLD, 9)
    c.drawString(MARGIN, PAGE_H - 42, kicker.upper())
    c.setFont(FONT_BOLD, 25)
    c.drawString(MARGIN, PAGE_H - 79, title)
    if subtitle:
        c.setFillColor(muted)
        c.setFont(FONT_REG, 10.5)
        c.drawString(MARGIN, PAGE_H - 99, subtitle)
    c.setFillColor(muted)
    c.setFont(FONT_REG, 7)
    c.drawRightString(PAGE_W - MARGIN, 24, f"AI喵搭 · OPC Bounty 03    {index:02d}/12")


def footnote(c: canvas.Canvas, text: str, dark=False):
    color = HexColor("#9A9DA8") if dark else HexColor("#77737A")
    text_block(c, text, MARGIN, 43, PAGE_W - MARGIN * 2 - 120, size=6.2, leading=8, color=color, max_lines=2)


def image_cover(path: Path, width: int, height: int, *, saturation: float = 1.0, brightness: float = 1.0) -> Path:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    key = f"{path.resolve()}-{width}-{height}-{saturation}-{brightness}".encode()
    out = TMP_DIR / f"img-{hashlib.sha1(key).hexdigest()[:12]}.jpg"
    if out.exists():
        return out
    with Image.open(path) as source:
        im = source.convert("RGB")
        im = ImageOps.fit(im, (width, height), method=Image.Resampling.LANCZOS)
        if saturation != 1:
            im = ImageEnhance.Color(im).enhance(saturation)
        if brightness != 1:
            im = ImageEnhance.Brightness(im).enhance(brightness)
        im.save(out, quality=92, optimize=True)
    return out


def draw_cover_image(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float, **kwargs):
    image_path = image_cover(path, max(16, int(w * 2.3)), max(16, int(h * 2.3)), **kwargs)
    c.drawImage(str(image_path), x, y, width=w, height=h, mask="auto")


def draw_qr(c: canvas.Canvas, x: float, y: float, size: float):
    # Medium error correction keeps the long Pages URL readable with generous module size.
    qr = QrCodeWidget(QR_URL, barLevel="M", barBorder=4)
    x1, y1, x2, y2 = qr.getBounds()
    drawing = Drawing(size, size, transform=[size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0])
    drawing.add(qr)
    renderPDF.draw(drawing, c, x, y)


def draw_phone(c: canvas.Canvas, x: float, y: float, w: float, h: float, screen: str):
    c.setFillColor(INK)
    c.roundRect(x, y, w, h, 18, fill=1, stroke=0)
    inset = 6
    c.setFillColor(PAPER if screen != "result" else NAVY)
    c.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, 13, fill=1, stroke=0)
    # iPhone hardware cues: a black Dynamic Island on top and a home indicator below.
    c.setFillColor(INK)
    c.roundRect(x + w * 0.35, y + h - 19, w * 0.3, 9, 4.5, fill=1, stroke=0)
    sx, sy, sw, sh = x + 12, y + 15, w - 24, h - 35

    if screen == "select":
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 8)
        c.drawString(sx, sy + sh - 10, "今日风格副本")
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 5.8)
        c.drawString(sx, sy + sh - 22, "实拍商品 · 5层完整穿搭")
        photos = ["item-001.jpg", "item-004.jpg", "item-002.jpg", "item-009.jpg"]
        card_w = (sw - 5) / 2
        card_h = 66
        for i, name in enumerate(photos):
            cx = sx + (i % 2) * (card_w + 5)
            cy = sy + sh - 100 - (i // 2) * 76
            draw_cover_image(c, ROOT / "public/product-shots" / name, cx, cy, card_w, card_h)
            c.setStrokeColor(INK)
            c.rect(cx, cy, card_w, card_h, fill=0, stroke=1)
        c.setFillColor(LIME)
        c.rect(sx, sy + 13, sw, 24, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 7)
        c.drawCentredString(sx + sw / 2, sy + 22, "生成我的今日角色")
    elif screen == "result":
        c.setFillColor(LIME)
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(sx, sy + sh - 10, "AIGC LOOK POSTER")
        avatar = ROOT / "public/avatar-demo/stylized-avatar-v1-small.png"
        draw_cover_image(c, avatar, sx, sy + 48, sw, sh - 72, saturation=1.08)
        c.setFillColor(PINK)
        c.rect(sx, sy + 14, sw, 24, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 7)
        c.drawCentredString(sx + sw / 2, sy + 23, "换动作 · 换发型 · 邀好友")
    else:
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 8)
        c.drawString(sx, sy + sh - 10, "银泰穿搭广场")
        avatar = ROOT / "public/avatar-demo/stylized-avatar-v1-small.png"
        card_w = (sw - 7) / 2
        for i, bg in enumerate([BLUE, PINK, GREEN, CYAN]):
            cx = sx + (i % 2) * (card_w + 7)
            cy = sy + sh - 102 - (i // 2) * 92
            c.setFillColor(bg)
            c.rect(cx, cy, card_w, 82, fill=1, stroke=0)
            draw_cover_image(c, avatar, cx + 4, cy + 4, card_w - 8, 74, saturation=0.8 + i * 0.1)
        c.setFillColor(INK)
        c.setFont(FONT_REG, 6)
        c.drawString(sx, sy + 16, "公开需用户主动同意 · 原图默认不公开")

    c.setFillColor(WHITE if screen == "result" else INK)
    c.roundRect(x + w * 0.38, y + 9, w * 0.24, 4, 2, fill=1, stroke=0)


def stat_card(c: canvas.Canvas, x: float, y: float, w: float, h: float, value: str, label_text: str, source: str, accent):
    rect(c, x, y, w, h, WHITE, SOFT, radius=5, lw=0.8)
    c.setFillColor(accent)
    c.setFont(FONT_BOLD, 28)
    c.drawString(x + 16, y + h - 40, value)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 10.5)
    c.drawString(x + 16, y + h - 63, label_text)
    text_block(c, source, x + 16, y + 23, w - 32, size=6.2, leading=8, color=MUTED, max_lines=2)


def slide_01(c: canvas.Canvas):
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.rect(0, 0, 10, PAGE_H, fill=1, stroke=0)
    label(c, "MIAOJIE PLAY · OPC BOUNTY 03", 44, PAGE_H - 58, fill=LIME, color=INK)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 43)
    c.drawString(44, PAGE_H - 142, "AI喵搭")
    c.setFont(FONT_BOLD, 22)
    c.drawString(44, PAGE_H - 181, "把“每天穿什么”")
    c.drawString(44, PAGE_H - 215, "变成每天都想打开的社交游戏")
    text_block(
        c,
        "真实商品选搭 × AIGC个人角色 × 好友共创同框 × 公开穿搭广场 × 到店/下单",
        46,
        PAGE_H - 254,
        410,
        size=11.5,
        leading=18,
        color=HexColor("#C9CBD4"),
    )
    for i, (txt, col) in enumerate([("每日打开", LIME), ("AI实质生成", PINK), ("社交共创", BLUE), ("商品转化", WHITE)]):
        label(c, txt, 46 + i * 92, PAGE_H - 319, fill=col, color=INK if col in (LIME, WHITE) else WHITE, w=82)

    c.setFillColor(BLUE)
    c.rect(505, 54, 282, 462, fill=1, stroke=0)
    draw_cover_image(c, ROOT / "public/avatar-demo/stylized-avatar-v1-small.png", 528, 78, 236, 414, saturation=1.08)
    c.setStrokeColor(WHITE)
    c.setLineWidth(1)
    c.rect(528, 78, 236, 414, fill=0, stroke=1)
    c.setFillColor(LIME)
    c.rect(575, 93, 146, 26, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 8.5)
    c.drawCentredString(648, 102, "今日角色 · 通勤玩家")
    c.setFillColor(HexColor("#AEB1BC"))
    c.setFont(FONT_REG, 7)
    c.drawString(46, 27, "银泰百货商业挑战赛 · H5 可运行原型 · 2026.07")
    c.showPage()


def slide_02(c: canvas.Canvas):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 2, "WHY NOW", "银泰不缺会员与商品，缺的是每天值得打开的理由")
    stat_card(c, 42, 315, 230, 130, "4000万+", "银泰数字化会员", "银泰官网：2019—2023 年数字化会员突破 4000 万", PINK)
    stat_card(c, 286, 315, 230, 130, "60+", "全国运营商场", "银泰官网：目前在全国运营超 60 家商场", BLUE)
    stat_card(c, 530, 315, 270, 130, "6.02亿", "中国生成式 AI 用户", "CNNIC 第57次报告：截至 2025 年12月", GREEN)

    rect(c, 42, 104, 758, 175, NAVY, NAVY, radius=5)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 20)
    c.drawString(64, 244, "命题不是再做一次促销，而是把商品变成可持续创作的内容素材")
    points = [
        ("商品", "从“货架图”升级为角色造型组件"),
        ("AI", "从概念标签升级为每天变化的内容生产引擎"),
        ("社交", "从帮忙投票升级为每位好友都拥有自己的角色与穿搭"),
        ("门店", "从最终收银点升级为任务领取、试穿与奖励核销场景"),
    ]
    for i, (head, body) in enumerate(points):
        x = 64 + (i % 2) * 365
        y = 196 - (i // 2) * 58
        c.setFillColor([LIME, PINK, BLUE, CYAN][i])
        c.rect(x, y, 48, 24, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 9)
        c.drawCentredString(x + 24, y + 7.5, head)
        c.setFillColor(WHITE)
        c.setFont(FONT_REG, 9.5)
        c.drawString(x + 60, y + 7, body)
    footnote(c, "数据来源：银泰百货官网《关于银泰》；CNNIC《第57次中国互联网络发展状况统计报告》（2026-02-05）。")
    c.showPage()


def slide_03(c: canvas.Canvas):
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 3, "CORE LOOP", "一个能形成复访的闭环，而不是一次性生成器", "内容每天变、好友关系会推进、商品随时可购买", dark=True)
    steps = [
        ("01", "每日上新", "天气 / 场景 / 新品池"),
        ("02", "凭直觉选搭", "内搭 / 外套 / 下装 / 鞋 / 配饰"),
        ("03", "AI生成角色", "身份特征 + 商品穿搭 + 动作背景"),
        ("04", "好友共创", "邀请好友各自创作，2—4人同框"),
        ("05", "广场与转化", "公开作品、看详情、到店/下单"),
    ]
    cols = [LIME, PINK, BLUE, CYAN, WHITE]
    start_x, y, w, gap = 42, 214, 139, 12
    for i, (num, title, desc) in enumerate(steps):
        x = start_x + i * (w + gap)
        rect(c, x, y, w, 205, HexColor("#1D2130"), HexColor("#3B4053"), radius=5)
        c.setFillColor(cols[i])
        c.setFont(FONT_BOLD, 25)
        c.drawString(x + 13, y + 158, num)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 13)
        c.drawString(x + 13, y + 118, title)
        text_block(c, desc, x + 13, y + 94, w - 26, size=8.2, leading=13, color=HexColor("#B8BBC5"), max_lines=4)
        if i < len(steps) - 1:
            c.setStrokeColor(cols[i])
            c.setLineWidth(2)
            c.line(x + w + 2, y + 102, x + w + gap - 2, y + 102)
    c.setFillColor(PINK)
    c.rect(42, 129, 758, 45, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 13)
    c.drawCentredString(PAGE_W / 2, 146, "每日钩子 = 新主题 + 连续收集 + 好友进度 + 下一期预告；没有倒计时催促")
    c.setFillColor(HexColor("#AEB1BC"))
    c.setFont(FONT_REG, 8)
    c.drawString(42, 91, "机制原则：用户可慢慢挑选；“约60秒完成”只表达低门槛，不作为强制限时。")
    c.showPage()


def slide_04(c: canvas.Canvas):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 4, "PRODUCT DEMO", "从实拍商品到个人动漫穿搭海报", "先看大图凭直觉选择；只有“查看详情”才进入商品详情页")
    draw_phone(c, 54, 79, 185, 392, "select")
    draw_phone(c, 327, 79, 185, 392, "result")
    draw_phone(c, 600, 79, 185, 392, "plaza")
    for x, n, title, desc, col in [
        (54, "1", "选商品", "大图优先 / 点击下沉选中 / 详情独立入口", LIME),
        (327, "2", "生成角色", "动作不固定 / 可换发型表情背景", PINK),
        (600, "3", "分享与发现", "好友同框 / 公开穿搭广场 / 商品回链", BLUE),
    ]:
        c.setFillColor(col)
        c.circle(x + 14, 57, 12, fill=1, stroke=0)
        c.setFillColor(INK if col == LIME else WHITE)
        c.setFont(FONT_BOLD, 10)
        c.drawCentredString(x + 14, 53.5, n)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 10)
        c.drawString(x + 33, 57, title)
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 6.4)
        c.drawString(x + 33, 45, desc)
    c.showPage()


def slide_05(c: canvas.Canvas):
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 5, "DAILY OPEN", "每天为什么还会回来？不是签到，而是“今天的我”不同")
    c.setStrokeColor(INK)
    c.setLineWidth(2)
    c.line(92, 330, 750, 330)
    days = [
        ("D1", "解锁身份", "生成第一张角色卡", LIME),
        ("D2", "天气副本", "阵雨通勤穿搭", CYAN),
        ("D3", "新品掉落", "新商品进入素材池", PINK),
        ("D4", "好友加入", "双人海报解锁", BLUE),
        ("D5", "广场发现", "收藏公开作品", GREEN),
        ("D6", "到店任务", "扫码试穿 / 核销", HexColor("#FFB84D")),
        ("D7", "周刊封面", "汇总一周角色故事", LIME),
    ]
    for i, (day, title, desc, col) in enumerate(days):
        x = 92 + i * 109.5
        c.setFillColor(col)
        c.circle(x, 330, 15, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(x, 327, day)
        c.setFont(FONT_BOLD, 9.5)
        c.drawCentredString(x, 292, title)
        text_block(c, desc, x - 43, 273, 86, size=7.2, leading=10, color=MUTED, max_lines=2)
    rect(c, 42, 115, 758, 100, NAVY, NAVY, radius=5)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 15)
    c.drawString(62, 179, "真正的复访资产")
    assets = [
        ("连续角色册", "沉淀每天的造型与故事"),
        ("关系进度", "好友加入后共同解锁多人模板"),
        ("商品收藏", "从海报一键回看所用 SKU"),
        ("次日预告", "提前展示主题，但不剧透全部商品"),
    ]
    for i, (head, body) in enumerate(assets):
        x = 62 + i * 182
        c.setFillColor([LIME, PINK, BLUE, CYAN][i])
        c.rect(x, 145, 8, 28, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 9.2)
        c.drawString(x + 15, 164, head)
        c.setFillColor(HexColor("#AEB1BC"))
        c.setFont(FONT_REG, 6.8)
        c.drawString(x + 15, 149, body)
    c.showPage()


def slide_06(c: canvas.Canvas):
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 6, "AIGC IN ACTION", "AI不是滤镜按钮，而是内容生产与玩法推进的发动机", dark=True)
    stages = [
        ("身份输入", "正面照 / 多角度照\n脸型、五官、发型、肤色", LIME),
        ("商品理解", "商品实拍 / 类目 / 色材\nSKU与门店库存上下文", PINK),
        ("角色生成", "身份保持的漫画化角色\n穿搭合成与风格一致性", BLUE),
        ("社交场景", "2—4人角色组合\n动作、背景、海报排版", CYAN),
        ("反馈学习", "收藏 / 分享 / 点击 / 到店\n反哺次日主题与推荐", GREEN),
    ]
    y = 264
    for i, (head, body, col) in enumerate(stages):
        x = 42 + i * 152
        rect(c, x, y, 136, 168, HexColor("#1D2130"), HexColor("#3B4053"), radius=5)
        c.setFillColor(col)
        c.rect(x, y + 146, 136, 22, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 9.5)
        c.drawCentredString(x + 68, y + 153, head)
        text_block(c, body, x + 13, y + 116, 110, size=8.2, leading=15, color=WHITE, max_lines=5)
        if i < 4:
            c.setStrokeColor(col)
            c.setLineWidth(2)
            c.line(x + 136, y + 84, x + 151, y + 84)
    rect(c, 42, 108, 360, 112, HexColor("#182A21"), GREEN, radius=5)
    c.setFillColor(GREEN)
    c.setFont(FONT_BOLD, 11)
    c.drawString(60, 190, "MVP 已可完整演示")
    text_block(c, "可运行交互流程、商品选搭、个人角色生成体验、发型/动作/背景编辑、邀请链接、多人场景与公开广场。", 60, 167, 324, size=8.3, leading=13, color=WHITE, max_lines=4)
    rect(c, 418, 108, 382, 112, HexColor("#2C2026"), PINK, radius=5)
    c.setFillColor(PINK)
    c.setFont(FONT_BOLD, 11)
    c.drawString(436, 190, "试点阶段能力升级")
    text_block(c, "接入喵街 PIM/SKU/库存、身份保持的图像生成 Provider、多人一致性生成、审核水印与用户授权，形成可灰度运行的生产链路。", 436, 167, 346, size=8.3, leading=13, color=WHITE, max_lines=4)
    footnote(c, "行业数据：CNNIC 第57次报告披露截至 2025 年12月我国生成式 AI 用户规模达 6.02 亿。", dark=True)
    c.showPage()


def slide_07(c: canvas.Canvas):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 7, "SOCIAL CREATION", "好友不是裁判：每个人都生成自己的角色，再一起入镜")
    # Invitation rail
    c.setFillColor(INK)
    c.setLineWidth(2)
    c.line(93, 382, 744, 382)
    nodes = [
        (93, "我", LIME),
        (310, "好友1", PINK),
        (527, "好友2", BLUE),
        (744, "好友3", CYAN),
    ]
    photos = ["item-002.jpg", "item-003.jpg", "item-011.jpg", "item-013.jpg"]
    for i, (x, name, col) in enumerate(nodes):
        c.setFillColor(col)
        c.circle(x, 382, 29, fill=1, stroke=0)
        draw_cover_image(c, ROOT / "public/product-shots" / photos[i], x - 22, 360, 44, 44, saturation=0.8)
        c.setStrokeColor(INK)
        c.circle(x, 382, 22, fill=0, stroke=1)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 9)
        c.drawCentredString(x, 338, name)
    labels = [
        ("创建场景", "生成邀请链接"),
        ("独立创作", "好友上传自己的照片与穿搭"),
        ("自动合成", "2—4人统一风格、动作与背景"),
    ]
    for i, (head, body) in enumerate(labels):
        x = 155 + i * 217
        c.setFillColor(WHITE)
        c.setStrokeColor(INK)
        c.roundRect(x, 304, 176, 55, 5, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 8.8)
        c.drawString(x + 12, 338, head)
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 6.8)
        c.drawString(x + 12, 320, body)

    rect(c, 42, 101, 480, 155, NAVY, NAVY, radius=5)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 16)
    c.drawString(62, 220, "多人海报不是终点，而是可持续的关系内容")
    interactions = ["并肩逛街", "碰拳击掌", "一起走秀", "合照自拍"]
    for i, name in enumerate(interactions):
        x = 62 + i * 108
        c.setFillColor([LIME, PINK, BLUE, CYAN][i])
        c.rect(x, 160, 94, 34, fill=1, stroke=0)
        c.setFillColor(INK if i in (0, 3) else WHITE)
        c.setFont(FONT_BOLD, 8.2)
        c.drawCentredString(x + 47, 172, name)
    c.setFillColor(HexColor("#AEB1BC"))
    c.setFont(FONT_REG, 7.5)
    c.drawString(62, 129, "下一步可扩展：评论、收藏、同款回链、线下合照任务；不采用相互裁决。")
    rect(c, 540, 101, 260, 155, WHITE, INK, radius=5)
    c.setFillColor(BLUE)
    c.setFont(FONT_BOLD, 11)
    c.drawString(560, 220, "公开穿搭广场")
    text_block(c, "用户主动公开后，作品进入银泰内容社区。其他会员可浏览、收藏、查看同款商品，并邀请作者加入共创场景。", 560, 192, 220, size=8.5, leading=14, color=INK, max_lines=5)
    c.setFillColor(MUTED)
    c.setFont(FONT_REG, 6.8)
    c.drawString(560, 118, "隐私默认：原始照片不公开；公开行为可撤回。")
    c.showPage()


def slide_08(c: canvas.Canvas):
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 8, "O2O CONVERSION", "每一张海报，都是一组可追踪、可购买、可到店的商品入口")
    products = [
        ("item-001.jpg", "内搭", "商品实拍"),
        ("item-004.jpg", "外套", "商品实拍"),
        ("item-002.jpg", "下装", "商品实拍"),
        ("item-009.jpg", "鞋履", "商品实拍"),
        ("item-006.jpg", "配饰", "商品实拍"),
    ]
    for i, (name, cat, badge) in enumerate(products):
        x = 42 + i * 151.5
        draw_cover_image(c, ROOT / "public/product-shots" / name, x, 275, 136, 170)
        c.setStrokeColor(INK)
        c.rect(x, 275, 136, 170, fill=0, stroke=1)
        c.setFillColor(LIME if i % 2 == 0 else PINK)
        c.rect(x + 8, 412, 43, 18, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 6.6)
        c.drawCentredString(x + 29.5, 418, cat)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 8.5)
        c.drawString(x, 256, "查看详情 →")
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 6.3)
        c.drawRightString(x + 136, 256, badge)

    rect(c, 42, 103, 758, 104, NAVY, NAVY, radius=5)
    flow = [
        ("海报", "记录所用商品 ID"),
        ("详情", "价格 / 尺码 / 库存"),
        ("门店", "楼层 / 导购 / 试穿"),
        ("交易", "加入购物车 / 领券"),
        ("复购", "收藏与次日推荐"),
    ]
    for i, (head, body) in enumerate(flow):
        x = 63 + i * 146
        c.setFillColor([LIME, PINK, BLUE, CYAN, GREEN][i])
        c.circle(x + 10, 163, 10, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 9.5)
        c.drawString(x + 29, 166, head)
        c.setFillColor(HexColor("#AEB1BC"))
        c.setFont(FONT_REG, 6.5)
        c.drawString(x + 29, 146, body)
        if i < 4:
            c.setStrokeColor(HexColor("#64697A"))
            c.line(x + 112, 163, x + 136, 163)
    footnote(c, "银泰官网披露：喵街实现线上线下同款、同价、同营销；过去一年有 170 多万个喵街订单使用上门取件服务。")
    c.showPage()


def slide_09(c: canvas.Canvas):
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 9, "PILOT METRICS", "8 周试点：把商业价值变成可归因、可验证的指标", "建议实验设计与阶段验收目标", dark=True)
    c.setFillColor(PINK)
    c.rect(42, 429, 758, 34, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 11)
    c.drawCentredString(PAGE_W / 2, 441, "建议样本：2城 / 4店 / 8周 / 会员随机分流（体验组 vs 对照组）")
    metrics = [
        ("打开", "7日人均打开天数", "体验组相对提升 ≥10%"),
        ("创作", "选搭→生成完成率", "目标 ≥65%"),
        ("社交", "生成→分享发起率", "目标 ≥15%"),
        ("关系", "邀请→好友加入率", "目标 ≥8%"),
        ("商品", "海报→详情点击率", "目标 ≥20%"),
        ("交易", "领券/到店/购买增量", "以对照组净增量计"),
    ]
    for i, (head, metric, threshold) in enumerate(metrics):
        col = i % 3
        row = i // 3
        x = 42 + col * 253
        y = 235 - row * 130
        rect(c, x, y, 235, 112, HexColor("#1D2130"), HexColor("#3B4053"), radius=5)
        c.setFillColor([LIME, PINK, BLUE, CYAN, GREEN, HexColor("#FFB84D")][i])
        c.setFont(FONT_BOLD, 10)
        c.drawString(x + 15, y + 82, head)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 10.5)
        c.drawString(x + 15, y + 55, metric)
        c.setFillColor(HexColor("#AEB1BC"))
        c.setFont(FONT_REG, 8)
        c.drawString(x + 15, y + 27, threshold)
    c.setFillColor(HexColor("#AEB1BC"))
    c.setFont(FONT_REG, 7)
    c.drawString(42, 62, "归因原则：所有分享链接携带 sceneId / memberId / productIds；购买效果只看实验组相对对照组的增量。")
    c.showPage()


def slide_10(c: canvas.Canvas):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 10, "WHY YINTAI", "为什么这套玩法只有银泰更容易做成")
    facts = [
        ("人", "4000万+数字化会员", "可做分层触达、连续任务与关系链沉淀", LIME),
        ("货", "商品与品牌数字化", "商品实拍、类目、价格、库存可进入 AI 上下文", PINK),
        ("场", "60+商场与全渠道", "角色内容可回到门店试穿、导购服务与交易", BLUE),
        ("AI", "官方披露 AI 参与销售", "2025 年 AI 参与并提升的销售额占比 17%", GREEN),
    ]
    for i, (tag, value, desc, col) in enumerate(facts):
        x = 42 + (i % 2) * 383
        y = 306 - (i // 2) * 157
        rect(c, x, y, 365, 135, WHITE, SOFT, radius=5)
        c.setFillColor(col)
        c.rect(x + 16, y + 87, 42, 31, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 12)
        c.drawCentredString(x + 37, y + 97, tag)
        c.setFont(FONT_BOLD, 14)
        c.drawString(x + 72, y + 99, value)
        text_block(c, desc, x + 17, y + 66, 330, size=8.5, leading=13, color=MUTED, max_lines=3)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 13)
    c.drawString(42, 94, "AI喵搭不是另起炉灶，而是把银泰现有“人货场”能力组织成每日可创作、可传播、可交易的内容循环。")
    footnote(c, "来源：银泰百货官网《关于银泰》《喵街》（访问日期 2026-07-18）。其中“17%”为银泰官网 2025 年披露口径。")
    c.showPage()


def slide_11(c: canvas.Canvas):
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(c, 11, "EXECUTION", "8周完成从比赛原型到可度量门店试点")
    phases = [
        ("W1—2", "数据接通", "喵街 PIM/SKU/库存\nOAuth / WebView / 埋点", LIME),
        ("W3—4", "AIGC灰度", "身份保持角色生成\n商品一致性与内容审核", PINK),
        ("W5—6", "社交放量", "邀请链接 / 2—4人场景\n公开广场与隐私撤回", BLUE),
        ("W7—8", "门店试点", "4店核销 / 对照实验\n复盘留存与增量交易", GREEN),
    ]
    for i, (week, title, body, col) in enumerate(phases):
        x = 42 + i * 190
        rect(c, x, 270, 174, 184, PAPER, SOFT, radius=5)
        c.setFillColor(col)
        c.rect(x, 420, 174, 34, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 10)
        c.drawCentredString(x + 87, 432, week)
        c.setFont(FONT_BOLD, 14)
        c.drawString(x + 16, 384, title)
        text_block(c, body, x + 16, 351, 142, size=8.3, leading=16, color=MUTED, max_lines=5)
        if i < 3:
            c.setStrokeColor(col)
            c.setLineWidth(2)
            c.line(x + 174, 362, x + 190, 362)

    rect(c, 42, 106, 758, 116, NAVY, NAVY, radius=5)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 14)
    c.drawString(61, 188, "落地需要的最小支持")
    asks = [
        "商品：图片、SKU、类目、价格、库存、门店",
        "会员：授权登录、任务/奖励、消息触达",
        "运行：AIGC Gateway、审核、水印、隐私授权",
        "试点：4家门店、导购联动、核销与交易归因",
    ]
    for i, text in enumerate(asks):
        x = 61 + (i % 2) * 360
        y = 157 - (i // 2) * 33
        c.setFillColor([LIME, PINK, BLUE, CYAN][i])
        c.rect(x, y, 7, 20, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(FONT_REG, 8.5)
        c.drawString(x + 15, y + 6, text)
    c.showPage()


def slide_12(c: canvas.Canvas):
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.rect(0, 0, 10, PAGE_H, fill=1, stroke=0)
    label(c, "LIVE H5 DEMO", 44, PAGE_H - 60, fill=LIME, color=INK)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 31)
    c.drawString(44, PAGE_H - 119, "现场扫码，完成你的今日角色")
    c.setFillColor(HexColor("#C9CBD4"))
    c.setFont(FONT_REG, 11)
    c.drawString(44, PAGE_H - 151, "选一套真实商品穿搭，生成动漫角色，再邀请好友一起入镜。")

    rect(c, 44, 142, 402, 244, HexColor("#1D2130"), HexColor("#3B4053"), radius=5)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 15)
    c.drawString(65, 348, "希望获得的试点资源")
    asks = [
        "喵街商品 PIM / SKU / 库存与门店接口",
        "会员 OAuth、WebView、任务奖励与消息触达能力",
        "2城4店8周灰度试点与导购协同",
        "AIGC 内容审核、隐私授权与效果评估支持",
    ]
    for i, item in enumerate(asks):
        y = 305 - i * 42
        c.setFillColor([LIME, PINK, BLUE, CYAN][i])
        c.rect(66, y, 25, 25, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 9)
        c.drawCentredString(78.5, y + 8, str(i + 1))
        c.setFillColor(WHITE)
        c.setFont(FONT_REG, 9.3)
        c.drawString(104, y + 8, item)

    c.setFillColor(WHITE)
    c.roundRect(512, 142, 265, 300, 8, fill=1, stroke=0)
    draw_qr(c, 550, 205, 190)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 12)
    c.drawCentredString(644.5, 414, "AI喵搭 · 可运行 H5")
    c.setFillColor(MUTED)
    c.setFont(FONT_REG, 6.2)
    short_display = "next-gen-avatar.ai-meow-outfit.pages.dev/#/game"
    c.drawCentredString(644.5, 178, short_display)
    c.setFillColor(LIME)
    c.rect(512, 116, 265, 24, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 8.2)
    c.drawCentredString(644.5, 124.5, "扫码即达线上 H5 · 2026-07-18 可访问验证")

    c.setFillColor(HexColor("#9A9DA8"))
    c.setFont(FONT_REG, 6.5)
    c.drawString(44, 74, "MVP 已覆盖完整玩法与交互；试点阶段将接入喵街商品数据与身份保持 AIGC 能力。")
    c.drawString(44, 56, "数据来源：www.intime.com.cn/about · www.intime.com.cn/cat · CNNIC 第55/57次统计报告")
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 12)
    c.drawString(44, 27, "AI喵搭，让每一次打开都有新内容，让每一件商品都有社交生命。")
    c.showPage()


def build() -> Path:
    register_fonts()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT_PATH), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    c.setTitle("AI喵搭 · 路演Deck（优化版）")
    c.setAuthor("AI喵搭项目组")
    c.setSubject("银泰百货商业挑战赛：每日AI穿搭角色与好友共创")
    for slide in [
        slide_01,
        slide_02,
        slide_03,
        slide_04,
        slide_05,
        slide_06,
        slide_07,
        slide_08,
        slide_09,
        slide_10,
        slide_11,
        slide_12,
    ]:
        slide(c)
    c.save()
    return OUT_PATH


if __name__ == "__main__":
    print(build())
