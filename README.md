# AI喵搭 — 个人时尚角色生成器

> OPC 2026 Bounty 03 · 银泰商业 · 为千万级会员设计的AI原生喵街互动玩法

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vite.dev)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**一张照片 · 五件真实商品 · 一个今日场景 · 生成今天的我**

在线体验：**https://next-gen-avatar.ai-meow-outfit.pages.dev/#/game**

---

## 🎮 产品简介

**AI喵搭不是AI试衣镜，而是懂真实商品的个人时尚角色生成器。**

用户上传照片建立个人角色身份，从银泰商品池中选择 5 层完整穿搭，再选择今日场景与画风，生成由本人主演的时尚角色内容。结果可编辑动作、表情、发型和背景，也可以邀请 2—4 位好友带着各自角色与完整 Look 共同入镜。每张内容绑定真实 SKU、价格、库存和门店入口；5—15 秒动态视频属于生产化扩展方向。

### 核心流程

```
上传照片，建立个人角色身份
  → 不限时挑选 5 层穿搭（内搭/外套/下装/鞋/配饰）
  → 选择今日场景与视觉画风
  → AIGC 生成同一个“我”、同一套 Look 的角色内容
  → 编辑发型/表情/动作/背景和镜头
  → 邀请好友：好友不是评委，独立创建角色后 2–4 人同框
  → 可公开到穿搭广场，其他会员可发现同款
  → 看商品详情 / 库存门店 / 到店任务 / 次日章节
```

---

## 🎯 核心功能

| 功能 | 入口 | 说明 |
|------|------|------|
| 🎮 **每日穿搭副本** | `/#/game` | 每日场景商品池，5 类商品不限时搭配 |
| 🤖 **AI 动漫角色** | 选装后自动生成 | 面部特征提取 + 身份保持型卡通渲染 |
| 👥 **好友共同出演** | `/?join=<sceneId>&max=4` | 最多 4 人各自角色同框，4 种互动模板 |
| 🖼️ **穿搭广场** | `/#/game`（广场 tab） | 用户主动公开的海报流，默认隐私 |
| 🛍️ **即看即买** | 海报/短片可查看同款商品 | 品牌/价格/门店楼层/到店任务 |
| 🎬 **动态商品短片** | 技术路线已文档化 | 5–15 秒走秀/转身/打招呼等动作视频 |

---

## 📦 评审交付物

| 材料 | 位置 |
|------|------|
| **OnePager 评审版** | [`deliverables/AI喵搭-OnePager-评审版.pdf`](deliverables/AI喵搭-OnePager-评审版.pdf) |
| **路演 Deck 评审版** | [`deliverables/AI喵搭-路演Deck-评审版.pdf`](deliverables/AI喵搭-路演Deck-评审版.pdf) / [`PPTX`](deliverables/AI喵搭-路演Deck-评审版.pptx) |
| **AIGC 技术可行性** | [`deliverables/AI喵搭-AIGC技术可行性.pdf`](deliverables/AI喵搭-AIGC技术可行性.pdf) |
| **动态试穿视频路径** | [`deliverables/动态试穿视频技术路径.md`](deliverables/动态试穿视频技术路径.md) |
| 比赛玩法说明 | [`deliverables/比赛玩法说明-v2.md`](deliverables/比赛玩法说明-v2.md) |
| AIGC 应用说明 | [`deliverables/AIGC应用说明-v2.md`](deliverables/AIGC应用说明-v2.md) |
| 加分材料 | [`deliverables/bonus/`](deliverables/bonus/) |
| 演示视频（本地） | `deliverables/video-v3/喵搭.mp4` |

完整索引见 [`deliverables/README.md`](deliverables/README.md)。

---

## 🏗️ 技术架构

```
React 18 + TypeScript + Vite 6       ← 前端框架
Three.js (React Three Fiber)         ← 3D 引擎
Zustand                              ← 状态管理
Canvas API                           ← 卡通角色渲染
Cloudflare Pages                     ← 前端部署 & CI/CD
Tailscale + 4090D GPU                ← AIGC 私有算力
Gateways: Identity Lock / Garment Lock / Motion Reference / Validation Gate
```

---

## 🚀 本地运行

```bash
npm install
npm run dev
# 打开 http://localhost:5173/#/game
```

**生产构建**：
```bash
npm run build
npx wrangler pages deploy dist --project-name=ai-meow-outfit
```

---

## 📋 OPC 比赛信息

- **赛题**：Bounty 03 — 为千万级会员设计一款AI原生的喵街互动玩法
- **命题方**：银泰商业
- **参赛方向**：创想家
- **项目阶段**：MVP / 原型（可运行 H5），评审材料已全部交付

---

## 👤 团队

单人参赛 · AI 辅助开发（Claude Code）· 全栈独立完成

---

## 📄 许可证

MIT License
