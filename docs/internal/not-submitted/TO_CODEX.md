# Codex 执行任务书 — 采集与重建全面升级（修订版 v3）

## 前提

项目路径：`/Users/jerry/Documents/Codex/ai-meow-outfit`
入口上下文：`CONTEXT.md`
最新线上：https://b2efe305.ai-meow-outfit.pages.dev
Git tag：opc-v1.1

**原则**：
- ❌ 不要推翻现有 captureAnalysis.ts 整体架构（红绿灯、倒计时、状态机、视角采集保持不动）
- ✅ 在现有 `findBodyBox()` 和 `ready` 判定逻辑上渐进替换
- ✅ 加入 Debug Overlay 方便调参
- ✅ Carving：vote + soft silhouette

---

## 任务一：修复 findBodyBox + ready 判定（渐进式）

**修改文件**：`src/services/captureAnalysis.ts`

**当前问题**：
人体检测依赖边框颜色减法（`bgColor = border color → diff > 40 = 人`），真实环境极易翻车。bodyBox 返回 null → 卡 0/8。

**修改方案**：

### A. 人体检测改为三级加权

不要依赖单一指标。改为：

```
confidence = 0.20 × Motion + 0.50 × Foreground + 0.30 × Geometry

Motion     = 帧间差 (已有 frameDifference())
Foreground = 现有颜色检测算法（阈值从 40 降至 22~28）
Geometry   = bbox height + bbox width + center offset 综合评分

confidence > 0.55 → bodyPresent = true
```

**注意**：Motion 在用户静止拍照时会降到接近 0，所以权重不能高（0.20）。它只做辅助——当 foreground 失败时起到"有人存在"的提示作用。

### B. Foreground 检测保留现有 border-color 算法但降低阈值

- 阈值从 `40` → `22~28`
- 新增 `bodyPct = 0.6 × bodyArea + 0.4 × bboxHeight`（替代纯面积）
- 新增 `heightRatio = box.height / frameHeight`
- 如果 `heightRatio > 0.7` 直接标记 `isFullBody = true`（不依赖 bodyPct）

### C. 删除 bodyPct 硬阈值，改用 bbox 几何

`bodyPct > 0.02` → 删除。
替代为：

```
const heightRatio = box.height / frameHeight;
const widthRatio = box.width / frameWidth;
if (heightRatio > 0.7 && widthRatio > 0.15) {
  isFullBody = true;
  isStable = true;
}
```

### D. stabilityScore 改为 body center 标准差（过去多帧）

```
要求过去若干帧（约15帧）body center 的 σx / σy < 4px
```

**具体改动**：新增一个 `centerHistory: Array<{x,y}>`，在 motion detection 循环中记录 `box.x+box.width/2` 和 `box.y+box.height/2`。每次 analyzeCaptureFrame 调用时向前追加，并计算近 15 帧的 center 标准差。

### E. ready 判定改为连续加权评分

去除 `passes >= 3` 离散逻辑，改为：

```
readyScore =
  0.25 × fullBodyScore +
  0.20 × centerScore +
  0.20 × stabilityScore +
  0.15 × distanceScore +
  0.20 × angleScore

ready = readyScore > 0.72
```

### F. 验收验证

- `npm run build` 通过
- 手机打开采集页，浅色/深色/复杂背景前均能稳定检测人体
- 正常光照下约 3 秒内进入 ready 状态
- 采集进度从 0/8 推进到 1/8

---

## 任务二：Capture Debug Overlay

**修改文件**：`src/pages/TryOnPage.tsx` + `src/services/captureAnalysis.ts`

**目的**：实时在视频画面上绘制检测数据，帮助快速定位哪一项指标不达标。

**实现方式**：
1. `captureAnalysis.ts` 的返回接口保持不变，但 `detail` 字符串改为结构化 JSON 字符串（"ready:0.68,motion:0.13,body:0.74,center:0.82,angle:0.91,stable:0.80"）
2. 在 `TryOnPage.tsx` 的采集页面（capture step）中，在 video 上覆盖一个 `<div>` 显示这些数据
3. 数据显示在画面左上角或底部，半透明背景，白色文字，字号小（12px）

**具体改动（TryOnPage.tsx）**：
在 capture step 的 `div ref={containerRef}` 上方或下方，添加：

```tsx
{captureAnalysis && (
  <div style={{
    position: 'absolute', bottom: 80, left: 8, right: 8, zIndex: 15,
    background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 10px',
    fontSize: 11, color: '#ccc', fontFamily: 'monospace',
  }}>
    {captureAnalysis.detail}
  </div>
)}
```

如果 `captureAnalysis.detail` 改为结构化的 key:value 格式，直接渲染即可。

**验收**：
- 采集画面上看到实时检测数据行
- 用户转身时数字变化可见

---

## 任务三：Gateway Worker 部署 + 健康检查

**修改文件**：`server/gateway-worker.js`

**改动**：
1. 在 gateway Worker 中添加 `/health` 返回完整状态链路（Cloudflare → Worker → AIGC → GPU → status）
2. 部署 Worker：

```bash
npx wrangler secret put AIGC_BASE_URL
# 输入: http://100.114.7.5:8765

npx wrangler deploy server/gateway-worker.js --name avatar-gateway
```

3. 将前端生产环境变量的 URL 更新为已部署的 Worker URL：
```bash
echo "VITE_AVATAR_API_BASE_URL=https://avatar-gateway.xxx.workers.dev/api/avatar" > .env.production
```

**验收**：
- `curl <worker>/api/avatar/health` 返回 AIGC 全链路状态
- 手机浏览器能通过 Worker 调用 `/reconstruct`

---

## 任务四：修复 Silhouette Carving（vote + soft silhouette）

**修改文件**：`server/avatar_server.py`

**当前问题**：
`voxel[:,:,y] &= rotated_sil` 要求 8 张图全部正确，任意偏差全灭。

**改动**：

### A. 改为多数投票

```
votes = np.zeros_like(voxel, dtype=np.uint8)
votes += silhouette  # 0 or 1 for each voxel, per view
voxel = votes >= 5   # 5/8 majority → keep
```

### B. 改为 soft silhouette

先用 distance transform 或其他方式生成 0~1 的置信度值，边缘=0.6 内部=1.0。然后 `score += probability`，最后 `score > 0.7` 保留。

简化实现：先做 majority vote（hard），再做一步 morphological close（dilate → erode）平滑边缘。

### C. GrabCut 后处理增强

```
import cv2
cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
→ 最大连通域提取
→ hole filling
```

**验收**：
- `python3 /tmp/test_reconstruct.py` 返回 `method: multi-view-silhouette-carving`
- vertices 从 66 提升到 200+

---

## 总排期

| 任务 | 优先级 | 文件 |
|------|--------|------|
| 任务一：修复 findBodyBox + ready | P0 | captureAnalysis.ts |
| 任务二：Debug Overlay | P0 | TryOnPage.tsx, captureAnalysis.ts |
| 任务三：Gateway 部署 + health | P1 | gateway-worker.js |
| 任务四：Carving vote + soft | P1 | avatar_server.py |

---

## 架构摘要（供参考）

```
手机 → Cloudflare Pages (H5 前端)
  └─ TryOnPage → getUserMedia → frames[]
      └─ submitModeling() → compress → POST /api/avatar/reconstruct
          ├─ [开发] → 直连 Tailscale AIGC
          └─ [生产] → Cloudflare Worker → Tailscale AIGC
              └─ avatar_server.py (4090D)
                  ├─ grabCut → carving → GLB
                  └─ 失败 → parametric → GLB
```
