# 会话恢复点 — 2026-07-22

## 项目状态

| 项目 | 值 |
|------|-----|
| 分支 | `next-gen-avatar` |
| HEAD | `aac57e6` |
| 远程 | `origin/next-gen-avatar` |
| 工作区 | ✅ 干净 |
| 构建状态 | ✅ 通过 |
| 默认分支 | 已改为 `next-gen-avatar`（contribution 已计入） |
| Demo 线上 | `https://c04a54c9.ai-meow-outfit.pages.dev/#/game` |

## 最近完成的工作

### 1. 产品方向：每日变装副本（Codex 完成）
- 入口 `/#/game`，根路由跳转到 game
- 5类商品不限时挑选（内搭/外套/下装/鞋/配饰）
- AI A/B 双方案生成（保留版/反转版）
- 好友投票选封面 + 奖励
- 风格化卡通角色（Canvas 面部特征提取 + 渲染）
- 穿搭广场（用户公开发布，默认隐私）
- 多人房间共创（最多4人，4种互动模板）
- 3件品牌服装 GLB（Burberry/Sandro/Theory）

### 2. 架构设计（之前完成）
- AI Provider 接口层（7个plugable provider）
- GLB Viewer 路径修复（BASE_URL 兼容）
- Pipeline 日志系统（28条日志覆盖7文件）
- Debug Audit 完成

### 3. 交付物（已更新）
- `deliverables/OnePager.html` + `.pdf` — 比赛一页纸
- `deliverables/路演Deck.html` + `.pdf` — 12页路演Deck
- `deliverables/比赛玩法说明-v2.md` — 商业玩法
- `deliverables/AIGC应用说明-v2.md` — AI技术说明
- `deliverables/短视频Demo硬性清单-v2.md` — 视频清单
- `deliverables/ui/` — UI截图
- `deliverables/video/` — 演示视频
- `deliverables/专项解决方案.md` — 方案文档
- `deliverables/原创与AI使用承诺书_已填写.docx` — 承诺书
- `CONTEXT.md` — 更新为最新产品描述
- `README.md` — 更新为每日副本产品

### 4. AIGC 后端
- AIGC 服务器运行在 4090D GPU（Tailscale 内网）
- `server/avatar_server.py` — FastAPI + 参数化人体 + silhouette carving
- `server/gateway-worker.js` — Cloudflare Worker（待部署）
- `server/rigged_avatar_provider.py` — 骨骼 Avatar
- `server/nerf_*.py` — NeRF/Gaussian头部重建管线

## 未完成的待办

### P0 — 演示阻塞
- [ ] **Bug 1**: `captureAnalysis.ts` findBodyByColor THRESH=22 太高 → 卡 0/8
- [ ] **Bug 2**: Gateway Worker 未部署 → 手机无法触发 AIGC 重建
- [ ] **Bug 3**: 摄像头在某些手机仍黑屏

### P1 — 产品
- [ ] 每日副本后端接入（目前为 DemoProvider 模拟）
- [ ] 好友投票回执服务端
- [ ] 到店券核销链路

### P2 — 比赛提交
- [ ] 录制正式演示视频
- [ ] 路演 Deck 导出 PDF（已生成，可用 `Cmd+P` 重新打印）
- [ ] OPC 官网提交材料

## 关键文件索引

| 文件 | 说明 |
|------|------|
| `src/pages/DailyQuestPage.tsx` | 主入口（game） |
| `src/services/dailyQuestAigcProvider.ts` | 副本AI管线 |
| `src/services/socialAvatarImageProvider.ts` | 社交角色图生成 |
| `src/services/socialScenePlatformProvider.ts` | 多人房间 |
| `src/services/stylizedHeadProvider.ts` | 风格化头像 |
| `src/components/outfit/AnimeAvatarViewer.tsx` | 动漫角色渲染 |
| `src/pages/TryOnPage.tsx` | 旧3D试穿入口 |
| `src/services/captureAnalysis.ts` | 采集算法（Bug 1） |
| `server/avatar_server.py` | AIGC重建服务 |
| `server/gateway-worker.js` | API Gateway（待部署） |

## 恢复操作

```bash
# 进入项目
cd /Users/jerry/PycharmProjects/ai-meow-outfit

# 切到正确分支
git checkout next-gen-avatar

# 启动开发服务器
npm run dev

# 部署到公网
source .env && npx wrangler pages deploy dist --project-name=ai-meow-outfit

# 启动AIGC服务器（如果关了）
ssh jerry@100.114.7.5 "source ~/anaconda3/etc/profile.d/conda.sh && conda activate DeepLearning && cd ~/avatar-server && nohup python3 avatar_server.py &>/dev/null &"
```
