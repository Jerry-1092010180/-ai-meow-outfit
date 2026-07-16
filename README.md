# AI喵搭 — 每日AI穿搭副本

> OPC 2026 Bounty 03 · 银泰商业 · 为4500万会员设计的AI原生喵街互动玩法

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vite.dev)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**每日变装副本 + 好友共创 + AI卡通角色 + 即看即买**

裁判入口：**https://c04a54c9.ai-meow-outfit.pages.dev** → 打开后进入 `/#/game`

---

## 🎮 产品简介

**AI喵搭**是银泰百货喵街APP内置的 AI 原生日更互动玩法。用户每天进入一个"变装副本"，在银泰真实商品池中不限时挑选完整穿搭，AI 生成个人卡通角色海报，邀请好友共创多人互动画面，分享到穿搭广场并解锁到店优惠券。

### 核心流程

```
每日副本
  → 上传身份照片（AI 提取面部特征）
  → 挑选内搭 → 外套 → 下装/连衣裙 → 鞋履 → 配饰（不限时）
  → AI 生成个人卡通角色海报（可编辑发型/表情/动作/背景）
  → 可选择公开到「银泰穿搭广场」
  → 邀请好友生成各自角色
  → 2-4 人同框互动（并肩/击掌/走秀/合照）
  → 分享到朋友圈 → 解锁门店优惠券
```

---

## 🎯 核心功能

| 功能 | 入口 | 说明 |
|------|------|------|
| 🎮 **每日变装副本** | `/#/game` | 每日场景商品池，5类商品不限时搭配 |
| 🤖 **AI卡通角色** | 选装完成后自动生成 | 面部特征提取 + 风格化卡通渲染 |
| 👥 **好友共创** | `/?join=<sceneId>&max=4` | 最多4人同框，4种互动模板 |
| 🖼️ **穿搭广场** | `/#/game`（广场tab） | 用户公开发布的海报流 |
| 🛍️ **即看即买** | 角色海报可查看商品详情 | 品牌/价格/门店楼层/到店券 |
| 👗 **3D虚拟试穿** | `/#/try-on` | 前置摄像头360°采集 + AIGC人体重建 |

---

## 🏗️ 技术架构

```
React 18 + TypeScript + Vite 5      ← 前端框架
Three.js (React Three Fiber)        ← 3D引擎
Three.js GLTFLoader + useGLTF       ← 3D模型加载
Zustand + localStorage              ← 状态持久化
Canvas API + CSS Art                ← 卡通角色渲染
Open-Meteo API                      ← 实时天气
Cloudflare Pages + Worker           ← 部署 & API Gateway
Tailscale + 4090D GPU               ← AIGC 私有算力
MediaPipe Pose (WASM)               ← 人体关键点检测
```

---

## 📂 项目结构

```
src/
├── pages/
│   ├── DailyQuestPage.tsx    ← 比赛主入口（变装副本+好友共创）
│   ├── TryOnPage.tsx         ← 3D虚拟试穿（旧版兼容）
│   ├── HomePage.tsx          ← 天气穿搭首页
│   └── ...                   ← 其余页面
├── services/
│   ├── dailyQuestAigcProvider.ts   ← 副本AI管线
│   ├── socialAvatarImageProvider.ts ← 社交角色图生成
│   ├── socialScenePlatformProvider.ts ← 多人房间
│   ├── stylizedHeadProvider.ts     ← 风格化头像
│   ├── avatarApi.ts                ← AIGC重建API
│   └── ...
├── components/
│   ├── outfit/AnimeAvatarViewer.tsx ← 动漫角色渲染器
│   ├── outfit/GLBModelViewer.tsx    ← 3D GLB查看器
│   └── ...
├── types/
│   ├── dailyQuest.ts         ← 副本数据类型
│   ├── socialAvatar.ts       ← 社交角色类型
│   ├── avatarSystem.ts       ← 头像系统类型
│   └── ...
├── stores/
├── config/
└── utils/
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
npm run preview
```

---

## 📋 OPC 比赛信息

- **赛题**：Bounty 03 — 为4500万会员设计一款AI原生的喵街互动玩法
- **命题方**：银泰商业
- **参赛方向**：创想家
- **项目阶段**：MVP / 原型（可运行H5）

### 交付物

| 交付物 | 位置 |
|--------|------|
| 商业玩法说明 v2 | [`deliverables/比赛玩法说明-v2.md`](deliverables/比赛玩法说明-v2.md) |
| AIGC应用说明 v2 | [`deliverables/AIGC应用说明-v2.md`](deliverables/AIGC应用说明-v2.md) |
| 演示视频 | [`deliverables/video/`](deliverables/video/) |
| UI截图 | [`deliverables/ui/`](deliverables/ui/) |
| 短视频硬性清单 | [`deliverables/短视频Demo硬性清单-v2.md`](deliverables/短视频Demo硬性清单-v2.md) |
| 专项解决方案 | [`deliverables/专项解决方案.md`](deliverables/专项解决方案.md) |
| 路演Deck | [`deliverables/路演Deck.html`](deliverables/路演Deck.html) |

---

## 🔮 路线图

```
当前（MVP）              Q3（真实AI接入）          Q4（产品化）
├─ 每日变装副本           ├─ AIGC API Gateway      ├─ 门店体测仪对接
├─ 好友共创多人同框        ├─ 真实AI图像生成         ├─ 用户Avatar系统
├─ 穿搭广场                ├─ 银泰商品实时同步        ├─ 尺码推荐+购买
├─ 风格化卡通角色           ├─ NeRF/Gaussian头部重建  ├─ AR门店试穿
├─ 3D虚拟试穿兼容           └─ 小范围灰度测试          └─ 全量上线
└─ 本地全流程可运行
```

---

## 👤 团队

单人参赛 · AI 辅助开发（Claude Code）· 全栈独立完成

---

## 📄 许可证

MIT License
