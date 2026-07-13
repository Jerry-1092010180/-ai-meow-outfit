# AI喵搭 — Codex 接手提示词

## 项目定位

OPC 2026 商业比赛项目。为银泰百货喵街 APP 4500 万会员设计 AI 原生互动玩法。
参赛方向：创想家。交付物：可运行 H5 原型 + 方案文档 + 路演 Deck。

## 当前代码位置

主分支：`main`（OPC 比赛期 MVP，**不要修改**）
实验分支：`next-gen-avatar`（**所有开发在这里进行**）
入口上下文：`CONTEXT.md`（项目结构 + AIGC 连接方式）
架构设计：`ARCHITECTURE.md`、`next-gen-architecture.md`
文档：`docs/`（avatar-pipeline-design.md、database-design.md、avatar-platform-design.md 等）
AIGC 服务器：`jerry@100.114.7.5` / 密码 `0` / 4090D GPU / conda DeepLearning

## 当前状态

### 已实现的 MVP 功能（main 分支）
- 首页天气穿搭推荐（Open-Meteo API）
- Onboarding 3 步引导（身型/风格/门店）
- 前置摄像头 8 张照片采集（使用中）
- 虚拟试穿（预置 5 种身型 GLB + 程序化 3D 人体）
- PK 挑战 + 双人 3D 同框
- 穿搭日记 + 门店好物
- AI 海报分享
- AIGC 参数化人体重建（4090D GPU）

### NEXT-GEN-AVATAR 分支已完成的
1. AI Provider 接口层（7 个 pluggable provider）
2. GLB Viewer 路径修复（BASE_URL 兼容）
3. 完整 Pipeline 日志系统（28 条日志/7 文件）
4. Debug Audit（数据流 + Top 10 Bug）
5. AIGC Python 服务器日志（[Avatar] 标签）

## 当前阻塞 Demo 的 Top 3 Bug

见 `debug-audit.md`。最紧急的是：

### Bug 1（P0）：Body Detection 第一节点失败
- **文件**：`src/services/captureAnalysis.ts`
- **函数**：`findBodyByColor()` 第 119 行
- **原因**：`THRESH=22` 太高 → 前景像素 < 20 个 → `box=null` → 所有 score=0 → 卡在 0/8
- **失败链**：findBodyByColor() box=null → detectBody() 返回 null → analyzeCaptureFrame 走 191 行 → ready=false → detail='rdy:--' → 永远不触发拍照
- **真实场景**：白墙+白衣、灰墙+黑衣、黄光环境都会失败
- **运动回退矛盾**：findBodyByMotion() 需要 motion>0，但用户拍照时必须静止

### Bug 2（P0）：Gateway 未部署
- **文件**：`server/gateway-worker.js`（代码已写好）
- **原因**：未执行 `wrangler deploy`，手机无法访问 Tailscale 内网 AIGC
- **当前 fallback**：`getPresetModelPath()` 显示预置 GLB——demo 可用但用户看不到重建效果

### Bug 3（P1）：采集体验不完整
- 摄像头黑屏、倒计时无视觉反馈、角度切换无引导

## 架构核心原则（必须遵守）

> AI 模型是可替换插件。真正稳定的是：Avatar 数据结构、数据库、商城接口、Three.js Viewer、用户资产。

### Provider 接口（`pipeline/interfaces/avatar-provider.ts`）
所有 AI 模型通过接口调用，每 6-12 个月可换一代模型，不改管线：
- `SegmentationProvider` — REMBG / MediaPipe / SAM
- `PoseEstimatorProvider` — ViTPose / OpenPose / MediaPipe
- `BodyEstimatorProvider` ⭐ — SMPLify-X / SPIN / CLIFF（核心资产）
- `FaceEstimatorProvider` — DECA / MICA / EMICA
- `TextureGeneratorProvider` — PyTorch3D / DreamGaussian
- `MeshDetailProvider` — PIFu / ECON / GaussianAvatar
- `HairGeneratorProvider` — NeuralHaircut / preset

### 数据流（已验证 + 未验证）
```
Camera          ⚠️ 部分验证（前置 getUserMedia 已启动）
  ↓
Capture 8张     ❌ 阻塞（findBodyByColor THRESH=22 失败）
  ↓
Upload          ⚠️ 直连 Tailscale IP→手机不可达
  ↓
Gateway         ❌ 未部署
  ↓
Python/4090D    ✅ 已验证（test_reconstruct.py 200 OK 2.5s）
  ↓
Generate GLB    ✅ 已验证
  ↓
Three.js Viewer ⚠️ 预置 GLB 路径已修复，需手机确认
```

## 下一步优先级

### P0（必须本周完成）
1. **修复 Body Detection**：`captureAnalysis.ts` 中 `findBodyByColor()` 的 THRESH 从 22 降低到 10，或直接用帧间差分检测人体（不需要颜色对比）
2. **部署 Gateway**：`wrangler deploy server/gateway-worker.js --name avatar-gateway` + `wrangler secret put AIGC_BASE_URL`
3. **完整手机测试**：Camera → Capture 8 张 → Upload → Gateway → Python → GLB → Viewer

### P1（Demo 可用后优化）
4. 采集过程视觉反馈（倒计时、角度提示、走马灯）
5. 重建过程的进度动画
6. GLB Viewer 错误处理和 fallback

### P2（比赛提交前）
7. 预置 GLB 纹理增强
8. Debug Overlay 可开关
9. 路演 Deck + 方案文档更新

## 关键文件索引

| 文件 | 行数 | 功能 |
|------|------|------|
| `src/pages/TryOnPage.tsx` | 522 | 采集主页面（摄像头 + 8 张拍摄 + 上传 + 结果） |
| `src/services/captureAnalysis.ts` | 263 | 帧分析算法（findBodyByColor→THRESH=22 是第一失败点） |
| `src/services/avatarApi.ts` | 91 | API 调用层（Upload URL + compressImageDataUrl） |
| `src/services/bodyModelService.ts` | 81 | Manifest 生成 + quality score |
| `src/services/outfitService.ts` | ~170 | 穿搭生成（FALLBACK_OUTFITS 兜底） |
| `src/services/weatherService.ts` | ~50 | 天气 API（GPS → Open-Meteo → IP 降级） |
| `src/components/outfit/GLBModelViewer.tsx` | 95 | Three.js GLB 加载器 |
| `server/avatar_server.py` | 325 | AIGC 服务器（FastAPI + grabCut + carving） |
| `server/gateway-worker.js` | 83 | Cloudflare Worker（未部署） |
| `pipeline/interfaces/avatar-provider.ts` | 436 | AI Provider 接口层（7 个插件化接口） |
| `CONTEXT.md` | 67 | 项目上下文 + AIGC 连接方式 |
| `debug-audit.md` | 244 | Debug Audit 完整报告 |

## 部署命令

```bash
# Cloudflare Pages（前段）
source .env && npx wrangler pages deploy dist --project-name=ai-meow-outfit

# Gateway Worker
npx wrangler deploy server/gateway-worker.js --name avatar-gateway
npx wrangler secret put AIGC_BASE_URL  # 输入: http://100.114.7.5:8765

# AIGC 服务器重启
ssh jerry@100.114.7.5 "source ~/anaconda3/etc/profile.d/conda.sh && conda activate DeepLearning && cd ~/avatar-server && nohup python3 avatar_server.py &>/dev/null &"

# GitHub
git add -A && git commit -m "fix: ..." && git push origin next-gen-avatar
```

## 日志系统

所有 Pipeline 阶段使用统一日志格式：
```
[Avatar] EventName Details
[Avatar] EventName FAILED reason
【Gateway】 EventName Details
```

日志覆盖：TryOnPage(9处)、avatarApi(5处)、GLBModelViewer(1处)、outfitService(2处)、weatherService(2处)、avatar_server.py(5处)、gateway-worker.js(4处)

## Demo 验收标准

```
Camera 预览 ✅
Capture 8 张 ✅ (每张显示角度标签)
Upload 200 ✅ (console 日志可见)
Gateway 200 ✅ (console 日志可见)
Python 2-5s ✅ (server.log 有 [Avatar] Reconstruct Complete)
GLB >1KB ✅ (avatar-output/ 下有文件)
Three.js 显示 ✅ (预置 GLB 旋转)
```

## 设计原则（请始终遵守）

1. **不要修改 `main` 分支** — 所有工作在 `next-gen-avatar`
2. **AI 模型可插拔** — Provider 接口模式，不要硬编码模型调用
3. **每次只修一个 Bug** — 提交后等待 Review，不要连续开发
4. **每步有日志** — 新增代码必须输出 `[Avatar]` 标签日志
5. **Fallback 必须可见** — 任何降级必须 console.warn 说明原因
6. **商业目标是 Demo** — 不是完美算法，是让裁判体验完整流程
