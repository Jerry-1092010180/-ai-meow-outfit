from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
BONUS = ROOT / "deliverables" / "bonus"
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

INK = HexColor("#0b0d12")
PAPER = HexColor("#f4f2ec")
LIME = HexColor("#d8ff48")
BLUE = HexColor("#3454ff")
PINK = HexColor("#ff4f7b")
MUTED = HexColor("#626872")

FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
pdfmetrics.registerFont(TTFont("Heiti", FONT_PATH, subfontIndex=0))
FONT = "Heiti"

W, H = landscape(A4)


def text(c, x, y, value, size=12, color=INK, align="left"):
    c.setFont(FONT, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, value)
    elif align == "right":
        c.drawRightString(x, y, value)
    else:
        c.drawString(x, y, value)


def box(c, x, y, w, h, fill, title, lines, title_color=INK):
    c.setFillColor(fill)
    c.setStrokeColor(INK)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 5, stroke=1, fill=1)
    text(c, x + 12, y + h - 24, title, 12.5, title_color)
    for index, line in enumerate(lines):
        text(c, x + 12, y + h - 45 - index * 17, line, 8.4, title_color if title_color == white else MUTED)


def arrow(c, x1, y1, x2, y2, dashed=False):
    c.setStrokeColor(INK)
    c.setFillColor(INK)
    c.setLineWidth(1.5)
    c.setDash(5, 4) if dashed else c.setDash()
    c.line(x1, y1, x2, y2)
    c.setDash()
    c.line(x2, y2, x2 - 7, y2 + 4)
    c.line(x2, y2, x2 - 7, y2 - 4)


def header(c, title, subtitle):
    c.setFillColor(INK)
    c.rect(0, H - 54, W, 54, fill=1, stroke=0)
    text(c, 30, H - 35, title, 22, white)
    text(c, W - 30, H - 33, subtitle, 9.5, white, "right")


def footer(c, page):
    text(c, 30, 18, "AI 喵搭 · OPC 商业挑战赛选交材料", 8, MUTED)
    text(c, W - 30, 18, str(page), 8, MUTED, "right")


def page_cover(c):
    c.setFillColor(INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.saveState()
    c.translate(W - 120, H - 90)
    c.rotate(9)
    c.rect(-130, -145, 310, 310, fill=1, stroke=0)
    c.restoreState()
    c.setFillColor(PINK)
    c.rect(W - 215, -55, 245, 190, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.roundRect(40, H - 96, 178, 28, 4, fill=1, stroke=0)
    text(c, 129, H - 87, "比赛选交材料 · 可验证", 10, INK, "center")
    text(c, 40, H - 160, "AI 喵搭", 38, white)
    text(c, 40, H - 210, "Agent 工作流与系统架构", 30, white)
    text(c, 40, H - 250, "每日角色更新 · AIGC 内容生产 · 2–4 人好友共创 · 商品经营回流", 14, HexColor("#c8cbd2"))

    c.setFillColor(white)
    c.roundRect(40, 62, W - 330, 205, 6, fill=1, stroke=0)
    text(c, 60, 238, "现场验证顺序", 14, BLUE)
    rows = [
        ("01", "每日章节", "7 天连续角色故事，约 60 秒但不限时"),
        ("02", "完整穿搭", "5 层商品图选择，详情按需打开"),
        ("03", "角色内容", "身份、动作、表情、背景持续编辑"),
        ("04", "社交共创", "好友独立建角色，2–4 人同框"),
        ("05", "经营回流", "广场发现、看同款、详情与门店任务"),
    ]
    for i, (num, name, desc) in enumerate(rows):
        y = 205 - i * 32
        text(c, 60, y, num, 10, PINK)
        text(c, 96, y, name, 11, INK)
        text(c, 175, y, desc, 9.5, MUTED)

    qr = BONUS.parent.parent / "tmp" / "pdfs" / "qr-from-final.png"
    if qr.exists():
        c.setFillColor(white)
        c.roundRect(W - 250, 62, 190, 205, 6, fill=1, stroke=0)
        c.drawImage(str(qr), W - 224, 103, 138, 138, preserveAspectRatio=True, mask="auto")
        text(c, W - 155, 84, "扫码体验 H5", 12, INK, "center")
    url = "https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game"
    text(c, 40, 37, url, 9, HexColor("#d8ff48"))
    c.linkURL(url, (40, 28, 380, 48), relative=0)
    c.showPage()


def page_workflow(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "Agent 工作流", "结构化输入 → Provider 编排 → 质量闸门 → 内容与经营闭环")

    text(c, 30, H - 82, "01 结构化输入", 12, BLUE)
    inputs = [
        ("用户身份", "正面照 / 特征 / 授权"),
        ("完整 Look", "内外下鞋配 5 层"),
        ("每日上下文", "日期 / 天气 / 章节"),
        ("内容偏好", "发型 / 动作 / 表情"),
        ("社交房间", "2–4 人 / 互动模板"),
    ]
    for i, (title, line) in enumerate(inputs):
        box(c, 30 + i * 158, H - 162, 142, 62, white, title, [line])

    box(c, 240, H - 258, 360, 66, BLUE, "DailyQuestOrchestrator", ["固定 schema · traceId · providerStage · fallbackReason"], white)
    for i in range(5):
        arrow(c, 101 + i * 158, H - 162, 420, H - 192)

    text(c, 30, H - 294, "02 Provider 执行", 12, BLUE)
    providers = [
        ("Identity", "身份约束", LIME, INK),
        ("Product", "商品一致性", PINK, INK),
        ("Story", "剧情场景", white, INK),
        ("Avatar", "角色与变体", BLUE, white),
        ("Scene", "多人海报", INK, white),
    ]
    for i, (title, line, fill, color) in enumerate(providers):
        box(c, 30 + i * 158, H - 382, 142, 64, fill, title, [line], color)
        arrow(c, 420, H - 258, 101 + i * 158, H - 318)

    box(c, 30, H - 474, W - 60, 64, white, "03 质量闸门", ["身份可辨识 · 商品逐层一致 · 肢体与构图 · 隐私安全 · 失败明确降级 · 记录 traceId"])
    arrow(c, 420, H - 382, 420, H - 410)

    text(c, 30, H - 510, "04 输出与回流", 12, BLUE)
    outputs = [
        ("个人角色", LIME, INK),
        ("动作/表情变体", white, INK),
        ("好友多人海报", BLUE, white),
        ("广场 → 同款 → 门店 → 次日", PINK, INK),
    ]
    widths = [145, 165, 165, 245]
    x = 30
    for (title, fill, color), width in zip(outputs, widths):
        box(c, x, 48, width, 54, fill, title, [], color)
        x += width + 16
    footer(c, 2)
    c.showPage()


def page_architecture(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    header(c, "系统架构与真实性边界", "实线为当前演示路径；虚线为生产接入路径")

    nodes = [
        (30, "喵街 APP / H5", ["每日副本 / 选装", "角色 / 共创 / 广场"], LIME, INK),
        (226, "Cloudflare Pages", ["静态 H5 / HTTPS", "当前可访问入口"], white, INK),
        (422, "API Gateway", ["鉴权 / 限流 / trace", "代码具备，需生产核验"], BLUE, white),
        (618, "私有 AIGC GPU", ["身份 / 角色 / 多人海报", "浏览器不直连"], INK, white),
    ]
    for i, (x, title, lines, fill, color) in enumerate(nodes):
        box(c, x, H - 184, 170, 92, fill, title, lines, color)
        if i < len(nodes) - 1:
            arrow(c, x + 170, H - 138, x + 196, H - 138, dashed=i >= 1)

    text(c, 30, H - 224, "当前比赛演示主路径", 12, BLUE)
    demo = [
        ("Demo Quest Provider", "每日章节与结果状态", white),
        ("Effect Preview", "角色与多人海报", PINK),
        ("Local Social Scene", "邀请 / 加入 / 2–4 人", LIME),
        ("H5 Runtime", "编辑 / 广场 / 商品回流", white),
    ]
    for i, (title, line, fill) in enumerate(demo):
        box(c, 30 + i * 196, H - 326, 170, 76, fill, title, [line])
        if i < 3:
            arrow(c, 200 + i * 196, H - 288, 226 + i * 196, H - 288)

    text(c, 30, H - 366, "生产数据与资产", 12, BLUE)
    data = [
        ("银泰 PIM / 库存", "当前为样例字段"),
        ("Identity Vault", "授权与生命周期"),
        ("R2 / CDN", "结果资产回传"),
        ("Analytics", "打开/生成/邀请/回流"),
        ("Moderation", "生成前后双检"),
    ]
    for i, (title, line) in enumerate(data):
        box(c, 30 + i * 158, H - 452, 142, 62, white, title, [line])

    c.setFillColor(INK)
    c.roundRect(30, 48, W - 60, 72, 5, fill=1, stroke=0)
    text(c, 48, 92, "真实性声明", 12, LIME)
    text(c, 142, 92, "H5 与邀请闭环已运行；角色图片为效果演示；Gateway、私有 GPU 与正式 PIM 属于生产接入路径。", 10.5, white)
    text(c, 48, 69, "任何 Provider 失败必须返回 fallbackReason，不把模板结果包装成个性化生成。", 9, HexColor("#c8cbd2"))
    footer(c, 3)
    c.showPage()


def build(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=landscape(A4))
    c.setTitle("AI 喵搭 - Agent 工作流与系统架构")
    page_cover(c)
    page_workflow(c)
    page_architecture(c)
    c.save()


if __name__ == "__main__":
    build(OUT / "AI喵搭-加分材料-工作流与架构.pdf")
    build(BONUS / "加分材料-工作流与架构.pdf")
    print(OUT / "AI喵搭-加分材料-工作流与架构.pdf")
