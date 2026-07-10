# AI喵搭 — 每日AI穿搭灵感

> OPC 2026 Bounty 03 · 银泰商业 · 为4500万会员设计的AI原生喵街互动玩法

AI天气穿搭 + 3D虚拟试穿 + 好友PK + 即看即买

---

## 快速启动

```bash
npm install
npm run dev
# 打开 http://localhost:5173
```

## 核心页面

| 路由 | 功能 |
|------|------|
| `/` | 首页 — 天气驱动的每日穿搭推荐 |
| `/onboarding` | 引导页 — 3步建立风格档案（身型/风格/门店） |
| `/try-on` | 3D虚拟试穿 — 360°旋转·缩放·切换穿搭 |
| `/diary` | 穿搭日记 — 日历热力图+时间线 |
| `/challenges` | PK挑战 — 发起挑战·邀请码·投票 |
| `/challenges/:id/3d` | 双人3D同框PK |
| `/challenges/join/:code` | 通过邀请码加入挑战 |
| `/store` | 门店好物 — 浏览·加购·下单 |
| `/share/:outfitId` | AI海报分享 |
| `/profile` | 个人中心 — 风格档案·数据统计 |

## 技术栈

React 18 · TypeScript · Vite 5 · TailwindCSS 4 · Framer Motion · Three.js (React Three Fiber) · Zustand · Open-Meteo Weather API

## 参赛交付物

见 [`deliverables/`](deliverables/) 目录：
- 专项解决方案文档
- 路演Deck大纲（12页）
- 演示视频脚本（3分钟）
