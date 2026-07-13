# AI喵搭 — 每日AI穿搭灵感

> OPC 2026 Bounty 03 · 银泰商业 · 为4500万会员设计的AI原生喵街互动玩法

[![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?logo=threedotjs)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vite.dev)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

**AI天气穿搭 + 3D虚拟试穿 + 好友PK同框 + 即看即买**

---

## 🚀 在线体验

> **主链接**：[https://c735741c.ai-meow-outfit.pages.dev](https://c735741c.ai-meow-outfit.pages.dev) **← 评委扫码入口**

| 备用平台 | 链接 |
|----------|------|
| Vercel | [ai-meow-outfit.vercel.app](https://ai-meow-outfit.vercel.app) |
| GitHub Pages | [jerry1092010180.github.io/-ai-meow-outfit](https://jerry1092010180.github.io/-ai-meow-outfit) |

> 建议使用手机模式浏览（Chrome DevTools → iPhone 14 Pro）。

---

## 💡 产品简介

**AI喵搭**为银泰百货喵街APP的4500万会员打造。AI根据用户所在地**实时天气**（温度/湿度/天气状况）、个人**身材偏好**（5种身型 × 5种肤色）和银泰**门店新品库存**，每日生成专属穿搭。用户可**360°旋转**查看3D试穿效果，与好友**同框PK**穿搭，一键分享朋友圈，**即看即买**门店在售单品。

---

## 🎯 核心功能

| 功能 | 说明 |
|------|------|
| 🔮 **每日AI穿搭** | 真实天气API驱动，位置→温湿度→场景化推荐，变量奖励钩子 |
| 👗 **3D虚拟试穿** | 根据用户身材参数实时生成个性化3D数字人，5套穿搭切换 |
| ⚡ **PK挑战** | 发起挑战→6位邀请码→好友加入→双人3D同框→投票对决 |
| 📖 **穿搭日记** | 日历热力图+时间线，连续打卡，积累风格资产 |
| 🛍️ **即看即买** | 穿搭中每件单品标注门店/楼层/库存/价格，一键购买 |
| 📤 **AI海报分享** | Canvas合成时尚海报，分享微信/朋友圈/小红书 |

---

## 🏗️ 技术架构

```
React 18 + TypeScript + Vite 5          ← 前端框架
Three.js (React Three Fiber + Drei)     ← 3D引擎
TailwindCSS 4 + Framer Motion           ← UI & 动画
Zustand + localStorage                  ← 状态持久化
Open-Meteo API                          ← 免费实时天气
Canvas API                              ← 海报合成
Web Share API                           ← 社交分享
```

### AI 管线

```
实时天气 + 用户风格 + 门店库存
        ↓
  LLM 风格策划（Claude/通义千问）
        ↓
  Text-to-Image 穿搭生成（SD/Midjourney）
        ↓
  3D WebGL 实时渲染（Three.js）
        ↓
  每日推送钩子 → 查看 → 分享 → 购买
```

---

## 📂 项目结构

```
src/
├── components/
│   ├── common/          # BottomNav, Button, Modal, Toast, StreakBadge
│   ├── outfit/          # ProceduralAvatar, Model3DViewer, OutfitCard
│   ├── challenge/       # DualAvatar3D (双人3D同框)
│   ├── diary/           # OutfitCalendar, DiaryTimeline
│   └── onboarding/      # StyleQuiz (身型/风格/门店引导)
├── pages/               # 11 个路由页面
├── stores/              # 5 个 Zustand stores
├── services/            # API 服务层 (mock-first, 接口兼容真实API)
├── hooks/               # 6 个自定义 hooks
├── types/               # 6 个 TypeScript 类型模块
└── utils/               # 海报合成, 深度链接, 日期计算, 埋点
```

---

## 🚀 本地运行

```bash
npm install
npm run dev
# 打开 http://localhost:5173
```

**生产构建**：
```bash
npm run build     # 输出到 dist/
npm run preview   # 预览构建产物
```

---

## 📋 OPC 比赛信息

- **赛题**：Bounty 03 — 为4500万会员设计一款AI原生的喵街互动玩法
- **命题方**：银泰商业
- **参赛方向**：创想家
- **项目阶段**：MVP / 原型

### 交付物

| 文件 | 位置 |
|------|------|
| 专项解决方案（10章） | [`deliverables/`](deliverables/) |
| 路演Deck大纲（12页） | [`deliverables/`](deliverables/) |
| 演示视频脚本（3分钟） | [`deliverables/`](deliverables/) |

---

## 🔮 路线图

```
Q2 原型验证（当前）     Q3 真实AI接入           Q4 3D升级
├─ H5可运行原型         ├─ 公网部署              ├─ 照片拍照→AI真实3D建模
├─ 程序化3D建模         ├─ 真实AI图像API         ├─ 真实GLB服装模型库
├─ 天气驱动推荐          ├─ 喵街会员对接           ├─ 骨骼动画+AR门店试穿
├─ PK邀请码系统         ├─ 门店库存实时同步        └─ 灰度测试→全量上线
└─ 本地全流程跑通        └─ 武林店小规模灰度
```

---

## 👤 团队

单人参赛 · AI 辅助开发（Claude Code）· 全栈独立完成

---

## 📄 许可证

MIT License
