from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots"
FILES = [
    ("01-daily-lobby.png", "每日章节"),
    ("02-product-selection.png", "完整穿搭选择"),
    ("03-product-detail.png", "按需查看详情"),
    ("05-avatar-result.png", "动漫角色结果"),
    ("06-pose-expression.png", "动作与表情"),
    ("07-friend-cocreate.png", "多人共创房间"),
    ("08-friend-joined.png", "第 2 位角色加入"),
    ("09-outfit-plaza.png", "银泰穿搭广场"),
    ("10-friend-invite-entry.png", "好友独立选装入口"),
]

FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
title_font = ImageFont.truetype(FONT, 46, index=0)
label_font = ImageFont.truetype(FONT, 25, index=0)
small_font = ImageFont.truetype(FONT, 18, index=0)

canvas = Image.new("RGB", (1920, 2460), "#f4f2ec")
draw = ImageDraw.Draw(canvas)
draw.rectangle((0, 0, 1920, 150), fill="#0b0d12")
draw.text((64, 42), "AI 喵搭 · 可运行 H5 关键流程", font=title_font, fill="white")
draw.text((1856, 61), "2026.07", font=small_font, fill="#d8ff48", anchor="ra")

cell_w, cell_h = 570, 680
start_x, start_y = 64, 190
gap_x, gap_y = 40, 58

for index, (name, label) in enumerate(FILES):
    row, col = divmod(index, 3)
    x = start_x + col * (cell_w + gap_x)
    y = start_y + row * (cell_h + gap_y)
    draw.rectangle((x + 8, y + 8, x + cell_w + 8, y + cell_h + 8), fill="#3454ff")
    draw.rectangle((x, y, x + cell_w, y + cell_h), fill="white", outline="#111318", width=3)
    shot = Image.open(SHOTS / name).convert("RGB")
    shot.thumbnail((390, 570), Image.Resampling.LANCZOS)
    px = x + (cell_w - shot.width) // 2
    py = y + 46
    canvas.paste(shot, (px, py))
    draw.rectangle((x + 20, y + 16, x + 76, y + 50), fill="#d8ff48", outline="#111318", width=2)
    draw.text((x + 48, y + 33), f"{index + 1:02d}", font=small_font, fill="#111318", anchor="mm")
    draw.text((x + 24, y + cell_h - 44), label, font=label_font, fill="#111318")

draw.text((64, 2418), "现场验证：next-gen-avatar.ai-meow-outfit.pages.dev/#/game", font=small_font, fill="#626872")
canvas.save(SHOTS / "contact-sheet.png", quality=94)
