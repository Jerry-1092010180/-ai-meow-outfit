# Debug Audit：完整数据流分析与 Top 10 Bug

---

## 一、完整数据流

```
Step 0: Onboarding
──────────────────────────────────────────────────────────────────
  Path:      /#/onboarding
  File:      src/pages/OnboardingPage.tsx
  Input:     用户选择身型、风格偏好、常去门店
  Output:    UserProfile 写入 Zustand (localStorage)
  日志:      无
  失败条件:  用户关闭浏览器前未完成 → 下次打开重新引导
  备注:      ✅ 基本稳定

Step 1: 每日穿搭推荐（首页）
──────────────────────────────────────────────────────────────────
  Path:      / (HomePage.tsx)
  File:      src/pages/HomePage.tsx
             src/services/weatherService.ts
             src/services/outfitService.ts
  Input:     用户地理位置 (GPS / IP → Open-Meteo API)
             用户心情选择
  Output:    GeneratedOutfit (文本描述 + 穿搭卡片展示)
  日志:      weatherService.ts 无结构化日志，只在 console.log 有
  失败条件:  ① GPS 拒绝 → 降级到 IP 定位 → 默认杭州
             ② Open-Meteo 不可达 → mock 天气数据
             ③ getMockOutfits() 网络失败 → FALLBACK_OUTFITS 兜底
  备注:      ⚠️ 实际没有真实 AI 生成穿搭，只有 mock 数据 + 预置模板

Step 2: Capture（采集）
──────────────────────────────────────────────────────────────────
  Path:      /#/try-on → step='capture'
  File:      src/pages/TryOnPage.tsx (行 108-183)
             src/services/captureAnalysis.ts
  Input:     前置摄像头 (facingMode: 'user')
             BodyMeasurements (身高/体重/身型)
  Output:    CaptureFrame[] (8 张 base64 照片)
  日志:      localStorage('aimm-capture-log') 8% 概率采样
  失败条件:  ① getUserMedia 拒绝 → alert 弹窗
             ② cameraReady 不触发 → 黑屏
             ③ readyScore < 0.72 不触发 → 卡在 0/8
             ④ 边框颜色检测失败 (白墙+白衣) → confidence<0.35 → box=null
  关键代码:  TryOnPage.tsx:108-183
            captureAnalysis.ts:107-140 (findBodyByColor)
            captureAnalysis.ts:62-103 (findBodyByMotion fallback)

Step 3: Review（预览）
──────────────────────────────────────────────────────────────────
  Path:      /#/try-on → step='review'
  File:      src/pages/TryOnPage.tsx (行 449-469)
  Input:     CaptureFrame[] (8 张)
  Output:    8 格缩略图展示
  日志:      无
  失败条件:  如果 frames.length < 8，格子显示 "—"
  备注:      ✅ 结构简单，不易失败

Step 4: Upload（上传 AIGC）
──────────────────────────────────────────────────────────────────
  Path:      submitModeling()
  File:      src/pages/TryOnPage.tsx (行 222-243)
             src/services/avatarApi.ts
  Input:     BodyMeasurements + CaptureFrame[] (8 张 base64)
  Output:    ReconstructResult (job_id, vertices, model_url)
  日志:      avatarApi.ts 无日志
  失败条件:  ① fetch 超时 (Tailscale IP 手机不可达)
             ② API Gateway 未部署 → 直连 100.114.7.5:8765
             ③ base64 过大 → HTTP 413
             ④ CORS 预检失败 → 浏览器拦截
  关键代码:  avatarApi.ts:23-42
            avatarApi.ts:45-60 (compressImageDataUrl 压缩到 512px)

Step 5: Python 重建
──────────────────────────────────────────────────────────────────
  Server:    server/avatar_server.py (AIGC 4090D GPU)
  ENV:       conda DeepLearning / CUDA 12.1 / FastAPI / trimesh / opencv
  Input:     POST /reconstruct { measurements, frames }
  Output:    GLB 文件 (job_id.glb)
  日志:      ~/avatar-server/server.log
  失败条件:  ① import cv2 失败 (conda 环境)
             ② grabCut 异常 (图片尺寸/格式)
             ③ voxel carving votes < threshold → cylinder fallback
             ④ 磁盘写满
             ⑤ OOM (VRAM > 19GB)
  关键代码:  avatar_server.py:239-310 (reconstruct)
            avatar_server.py:128-154 (image_to_silhouette + grabCut)
            avatar_server.py:157-209 (silhouettes_to_voxel_mesh)

Step 6: GLB 回传
──────────────────────────────────────────────────────────────────
  Path:      GET /models/{job_id}.glb
  Server:    server/avatar_server.py (行 313-320)
  Client:    src/components/outfit/GLBModelViewer.tsx
  Input:     GLB 二进制文件
  Output:    Three.js 3D 场景
  失败条件:  ① Tailscale IP 不可达
             ② 文件不存在 (404)
             ③ GLTFLoader 解析失败
  关键代码:  GLBModelViewer.tsx:11-27

Step 7: Fallback（预置 GLB）
──────────────────────────────────────────────────────────────────
  Path:      TryOnPage.tsx 行 491-498 (reconstructResult 为空时)
  File:      avatarApi.ts:75-80 (getPresetModelPath)
  Input:     bodyType (hourglass/pear/apple/rectangle/inverted_triangle)
  Output:    public/models/body-{type}.glb
  日志:      无
  失败条件:  GLB 文件不存在 → Three.js 渲染错误
  备注:      ⚠️ 5 种身型 GLB 只有 897 顶点，无纹理，不像是"用户本人"
```

---

## 二、Top 10 Bug

### P0（演示阻塞）

#### Bug 1: 前置摄像头在实际手机浏览器上可能无法启动

- **文件**: `TryOnPage.tsx:112-117`
- **表现**: 用户点击"开始 360° 采集"后，摄像头预览黑屏
- **原因**: 某些手机浏览器（iOS Safari、荣耀浏览器）对 `facingMode: 'user'` + 命令式 `document.createElement('video')` 组合有兼容问题。需要用户交互才能启动 video play()
- **失败条件**: `video.play()` 抛出 DOMException → cameraReady 永远 false → 卡在采集页
- **当前处理**: `try { await video.play() } catch {}` — 静默捕获，无用户反馈
- **日志**: 无
- **修复建议**: play() 失败后显示"点击屏幕启动摄像头"按钮

#### Bug 2: 8 张照片采集大概率卡在 0/8

- **文件**: `captureAnalysis.ts:107-140` (findBodyByColor)
- **表现**: 用户站在镜头前全身入画，但进度不推进，底部 debug 显示 `rdy:--`
- **原因**: `findBodyByColor()` 依赖像素颜色与边框颜色的差异。白墙+白衣、灰墙+黑衣、黄光等真实环境下，阈值 THRESH=22 仍然过高
- **失败条件**: `pointsX.length < 20 || bodyPct < 0.008` → `box: null` → `detectBody()` 返回 `confidence: 0` → `readyScore` 算不出
- **日志**: `localStorage('aimm-capture-log')` 8% 采样
- **当前 Fallback**: `findBodyByMotion()` — 依赖用户移动，用户拍照时需要静止，矛盾
- **修复建议**: 关闭颜色检测，改用帧间差分作为主要人体检测手段；或者在采集开始时使用 motion 初始化人体框，之后 tracking

#### Bug 3: 采集到 8 张后提交 AIGC，手机浏览器无法访问 Tailscale IP

- **文件**: `avatarApi.ts:8` (`AVATAR_API = import.meta.env.VITE_AVATAR_API_BASE_URL || '/api/avatar'`)
- **表现**: Phase 1 (直连 Tailscale) 超时 → Phase 2 (空帧参数化) 也超时 → 显示预置 GLB 模型
- **原因**: `VITE_AVATAR_API_BASE_URL` 未在 `.env.production` 中设置，默认为 `/api/avatar`。但实际上没有 Cloudflare Worker 在路由 `/api/avatar`，请求 404
- **失败条件**: fetch 失败 → `apiAvailable = false` → 永远显示预置 GLB
- **日志**: `avatarApi.ts` 无日志，浏览器的 Network 面板可以看到 404
- **修复建议**: 部署 Cloudflare Worker；或在前端拦截 404 时直接使用预置 GLB（已知用户是离线演示）

#### Bug 4: Three.js 加载预置 GLB 后不显示

- **文件**: `GLBModelViewer.tsx:12` (`useGLTF(path)`)
- **表现**: 结果页显示"📦 预置模型"文字，但不显示 3D 模型
- **原因**: `public/models/body-*.glb` 的路径在 GitHub Pages 上需要 `/-ai-meow-outfit/` 前缀。当前使用 `/models/body-hourglass.glb` 根路径。Cloudflare Pages 可以，但 GitHub Pages 404
- **失败条件**: `useGLTF` 404 → `ErrorCatcher` 捕获 → `setError(true)` → 显示空白
- **日志**: `onCreated={() => console.log('GLB Canvas ready')}` — 只有成功日志，无失败日志
- **修复建议**: `getPresetModelPath()` 中拼入 `import.meta.env.BASE_URL`

### P1（功能不完整）

#### Bug 5: 天气 API 频繁失败且无降级提示

- **文件**: `weatherService.ts:128-145`
- **表现**: 首页天气区域不显示，用户不知道原因
- **原因**: 3 层网络请求链 (GPS → Open-Meteo → Nominatim)，手机蜂窝网络下任一环节都可能超时
- **当前处理**: 全部 catch 后返回"杭州 25°C 晴天"mock 数据
- **日志**: 无
- **修复建议**: 添加 `console.error` 并在 dev 环境显示调试信息

#### Bug 6: fetch 请求发送数 MB 的 base64 图片可能导致超时

- **文件**: `avatarApi.ts:28-31`
- **表现**: 提交后长时间显示"AIGC 生成中"，然后静默 fallback 到预置 GLB
- **原因**: 8 张 base64 图片压缩后仍有约 1-2MB 总大小。通过 `JSON.stringify` 传输 → 服务端解析消耗
- **失败条件**: fetch timeout (默认 0) → 静默 catch → `apiAvailable = false`
- **日志**: 无
- **修复建议**: 添加 `AbortSignal.timeout(30000)`；前端显示重建状态

#### Bug 7: 采集完成后到下一个角度之间无用户反馈

- **文件**: `TryOnPage.tsx:198-206`
- **表现**: 拍照后 1.5 秒空白等待，用户不知道下一步该怎么做
- **原因**: `setTimeout(1500)` 后通过语音告知"请继续顺时针旋转45度"，但语音需要用户先授权 SpeechSynthesis
- **失败条件**: 用户未允许语音 → `speak()` 静默失败 → 用户等待 1.5 秒后不知道已就绪
- **修复建议**: 在屏幕上显示视觉提示"向右转继续～"

#### Bug 8: GLB 模型渲染超出 viewport 或位置偏移

- **文件**: `GLBModelViewer.tsx:69` (`target={[0, 0, 0]}`)
- **表现**: 3D 模型显示在画面外或只显示下半身
- **原因**: SMPL β 生成的 mesh 中心不在 (0,0,0)。预置 GLB 和程序化 ProceduralAvatar 的位置不同
- **失败条件**: OrbitControls 的 target 固定 (0,0,0) 而模型在 (0,1,0)
- **修复建议**: 加载 GLB 后计算 bounding box 中心，动态设置 target

#### Bug 9: 双人 3D 同框 PK 加载多人 GLB 时的性能问题

- **文件**: `DualAvatar3D.tsx` (两个 ProceduralAvatar 实例)
- **表现**: Safari 上 3D 场景卡顿或白屏
- **原因**: 两个 Three.js Canvas 同时运行，每个使用 OrbitControls + shadows + autoRotate。手机 GPU 可能过载
- **修复建议**: 低端设备上减少 shadow 分辨率或禁用 autoRotate

#### Bug 10: AIGC 服务端 exit 后不自启动

- **文件**: `server/avatar_server.py`
- **表现**: 提交重建后长时间等待，最终超时
- **原因**: AIGC 服务器是通过 `nohup python3 avatar_server.py &` 手动启动的，崩溃后不会自动恢复
- **修复建议**: 在同一 SSH session 中检查进程是否存在；写一个简单的 systemd 检测脚本

---

## 三、日志位置总结

| 数据点 | 位置 | 格式 |
|--------|------|------|
| 采集分析分数 | `localStorage('aimm-capture-log')` | JSON (8% 采样) |
| 天气 API 请求 | `console.log` (开发环境) | 文本 |
| AIGC 服务器 | `~/avatar-server/server.log` | FastAPI 标准格式 |
| 前端构建 | 终端 stdout | Vite |

**当前日志覆盖的缺口**：
- ✅ 采集分析：localStorage（采样）
- ❌ API 请求耗时：未记录
- ❌ GLTF 加载失败：未记录
- ❌ 天气降级：未记录
- ❌ AIGC 崩溃原因：只在 server.log，前端不可见

---

## 四、演示 Demo 关键路径

```
Onboarding (1 次)
  → 首页 (看到天气)
    → /#/try-on
      → 填数据 → 开始采集 → 8 张拍完 → 预览
        → 提交 → (显示预置 GLB)
          ← 这条路径必须跑通 ←
```

**当前状态下，演示 Demo 有 3 个阻塞点**：
1. 摄像头预览黑屏（P0 Bug1）
2. 采集卡在 0/8（P0 Bug2）
3. 提交后 GLB 404（P0 Bug4）

**建议修复优先级**：Bug4 (GLB 路径) 用时最少 → Bug2 (采集阈值) 最影响体验 → Bug1 (摄像头) 最复杂
