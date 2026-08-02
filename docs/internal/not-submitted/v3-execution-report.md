# AI喵搭 — v3 执行报告

## 已完成的任务

### 1. captureAnalysis.ts — 渐进式重构（已部署线上）

| 改动 | 状态 | 说明 |
|------|:---:|------|
| 三级置信度检测 | ✅ | 0.2motion + 0.5foreground + 0.3geometry |
| Foreground 阈值 40→22 | ✅ | 降低对颜色差异的敏感度要求 |
| bodyPct 删除 | ✅ | 改用 bbox height/width 几何指标 |
| heightRatio>0.7 直接确认全身 | ✅ | 不依赖颜色面积 |
| 稳定性→多帧 center 标准差 | ✅ | σ<4px，最后15帧 |
| Ready 连续加权评分 | ✅ | readyScore = 0.25f + 0.20c + 0.20s + 0.15d + 0.20a > 0.72 |
| detail 结构化调试串 | ✅ | "rdy:68,mot:13,bod:74,..." |
| 每次采集清空 history | ✅ | clearCenterHistory() on start |

### 2. TryOnPage.tsx — 少量适配

| 改动 | 状态 |
|------|:---:|
| 导入 clearCenterHistory | ✅ |
| 采集开始时清空 center 历史 | ✅ |

### 3. avatar_server.py — 重建管线增强

| 改动 | 状态 |
|------|:---:|
| GrabCut 后处理（morphology close + 最大连通域 + hole filling） | ✅ |
| Carving 从 AND 改为 soft silhouette + 多数投票 (≥5/8) | ✅ |

### 4. 部署

| 改动 | 状态 |
|------|:---:|
| 前端构建零错误 | ✅ |
| Cloudflare Pages 部署 | ✅ 最新: https://90fff164.ai-meow-outfit.pages.dev |
| AIGC 服务器更新并在线 | ✅ 4090D |
| GitHub 推送 (commit 89cbf48) | ✅ |
| Codex 同步 | ✅ |

---

## 未完美达到的难点

### 1. 采集仍然可能卡在 0/8（P0）

**根本原因**：人体检测靠的是「像素颜色与边框颜色不同 = 人」。这在用户衣服颜色接近背景时仍然会失败。

**尝试过的方案**：
- 把颜色阈值从 40 降到 22 → 副作用：噪点增加了
- 引入 motion 辅助（帧间差）→ 但用户拍照时必须静止，motion=0 时 motion 权重没有意义
- 加入多帧 center 稳定性 → 前提是 findBodyBox 先找到人，它本身就是瓶颈

**推荐的下一步**：
- **方法 A（推荐，无需外部依赖）**：帧间差分作为独立的前景检测通道。当颜色检测失败时，用最近 5 帧间的运动区域作为 body box 替代。原理：用户虽然静止，但拍摄过程中总有微小呼吸/晃动，足够差分出一个区域。
- **方法 B（更强，需额外 500KB）**：接入 TensorFlow.js 的 BodyPix 或 MediaPipe selfie segmentation，完全不受颜色和光照影响。wasm 模型文件可放到 `public/vendor/` 下本地加载。

### 2. AIGC silhouette carving 测试顶点仍然只有 66（P1）

**根本原因**：测试脚本 `/tmp/test_reconstruct.py` 用的是合成黑色矩形人体（8 张几乎一样的图），carving 时多角度投影后只有极少 voxel 重叠。

**实际运行时效果未知**：真人照片会包含丰富的轮廓差异，carving 效果应该显著好于合成图。**需要真实的 8 张采集帧上传测试才能确定是否真的有问题。**

**当前代码已做的改进**：
- AND→soft silhouette + majority vote (≥5/8)
- GrabCut 加 morphology close + 最大连通域 + hole filling

**建议**：先跑一次真实手机采集→提交 AIGC 的完整流程，看实际 vertices 数。如果仍然很少，再优化。

### 3. API Gateway Worker 未部署（P1）

**现状**：`server/gateway-worker.js` 代码已写好，但未执行 `npx wrangler deploy`。

**原因**：需要先 `wrangler secret put` 设置 AIGC_BASE_URL，当前流程依赖用户操作，无法自动化。

**建议**：
- 由 AI 助手执行：`echo "http://100.114.7.5:8765" | npx wrangler secret put AIGC_BASE_URL --name avatar-gateway`
- 然后：`npx wrangler deploy server/gateway-worker.js --name avatar-gateway`

### 4. MediaPipe/local 人体关键点检测未接入（P2）

**原因**：wasm 模型文件太大（~10MB），下载和集成需要额外时间。且 body detection 问题没解决前，关键点检测的收益不大。

### 5. 倒计时/拍照后偶尔不进入下一个角度（P3）

**现象**：拍照成功后 borderState= 'captured'，但下一个角度的 setStep/reinit 有时不触发。

**可能原因**：React 异步 state 更新 + setTimeout 闭包引用陈旧值。

---

## 各指标当前预期

| 指标 | 估计 |
|------|------|
| 简单背景（纯白/纯色墙，深色衣服） | 应正常工作，3-5秒进入 ready |
| 复杂背景（花纹、木门、多色） | 可能缓慢或卡住，取决于颜色 vs 衣服对比度 |
| 衣服接近背景色 | 大概率卡住 |
| 光线昏暗 | 可能失败，border-color 检测依赖明显色差 |

---

## 流水线成功率预期

```
[条件正常] → 拍摄8张 → 提交 AIGC
  ├─ silhouette carving（真人照片，方法 A） → GLB
  └─ 回退 parametric（照片不足或carving失败） → GLB

预期成功率：
  - 正常光线、简单背景、深色衣服：~70%
  - 复杂背景/浅色衣服：~40%
  - 任意条件下总有 parametric fallback 兜底：100%
```
