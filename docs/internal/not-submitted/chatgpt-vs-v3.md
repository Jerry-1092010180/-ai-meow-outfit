# ChatGPT 建议 × 当前实现 对照表

## ✅ 已实现（与 ChatGPT 一致）

| ChatGPT 建议 | v3 实现状态 |
|-------------|-----------|
| 三级置信度 (motion+foreground+geometry) | ✅ 0.2 motion + 0.5 foreground + 0.3 geometry |
| 前景色差阈值从 40 降至 22~28 | ✅ 已降至 22 |
| bodyPct 移除或降低 | ✅ bodyPct 删除，改用 bbox height/width |
| ReadyScore 连续加权评分 | ✅ 0.25f + 0.20c + 0.20s + 0.15d + 0.20a > 0.72 |
| Carving AND→多数投票 (≥5/8) | ✅ soft silhouette + vote ≥5 |
| GrabCut 后处理（morphology close + 最大连通域 + hole filling） | ✅ |
| 体素分辨率保持 256³ | ✅ |
| Gateway 健康检查 | ⚠️ 代码已写 (`server/gateway-worker.js`)，未部署 |
| Debug Overlay | ✅ detail 字串已结构化 |

## ❌ 未实现（ChatGPT 新建议）

### P1 — 采集健壮性

| 建议 | 复杂度 | 说明 |
|------|--------|------|
| 帧差+GrabCut 混合：先 motion 找到初始人体，锁定后跟踪 | 3h | 当前每帧独立检测，无 tracking。可维护一个 `stableBox` 当颜色检测失败时用 motion region 替代 |
| 运动分数单独作为通道，不依赖颜色 | 2h | 帧间差分膨胀→腐蚀→最大连通域，作为独立的 bodyPresent 判断路径 |

### P2 — 验证与监控

| 建议 | 复杂度 | 说明 |
|------|--------|------|
| 日志收集：每帧分数记录到 localStorage | 2h | 用于回放分析，找出哪项指标总不达标 |
| 端到端集成测试场景 | 4h | 模拟不同光照/背景/服装，验证拍照触发率和误触发率 |
| 流程图/覆盖层 Mockup | 1h | 视频上叠加检测分数可视化 |

### P3 — 部署

| 建议 | 复杂度 | 说明 |
|------|--------|------|
| Gateway 部署 + health 端点 | 0.5h | `npx wrangler deploy` |
| AIGC 服务日志收集到文件 | 0.5h | 已经写在 server.log |

---

## 执行计划

### 第 1 步：帧差+Tracking 保底（P0→P1）

在 `captureAnalysis.ts` 中添加帧间差分通道：

```
每帧:
  1. 帧间差分 → 二值化(diff>18) → 膨胀 → 腐蚀
  2. 最大连通域 → bounding box → tempBox
  3. 如果 color-based findBodyBox() 失败，用 tempBox
```

### 第 2 步：日志记录（P2）

在 TryOnPage.tsx 的 motion detection interval 中追加：

```ts
if (analysis.ready) {
  const log = JSON.parse(localStorage.getItem('aimm-capture-log') || '[]');
  log.push({ ts: Date.now(), analysis });
  if (log.length > 500) log.shift();
  localStorage.setItem('aimm-capture-log', JSON.stringify(log));
}
```

### 第 3 步：Gateway 部署（P1）

```bash
echo "http://100.114.7.5:8765" | npx wrangler secret put AIGC_BASE_URL --name avatar-gateway
npx wrangler deploy server/gateway-worker.js --name avatar-gateway
```

---

## 当前线上版本

https://90fff164.ai-meow-outfit.pages.dev
