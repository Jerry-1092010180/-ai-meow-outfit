# Codex 上下文：摄像真人取模 + AIGC 算力

## 摄像头采集 (TryOnPage.tsx)

**关键文件**: `src/pages/TryOnPage.tsx`

**流程**:
1. 填身体数据 → 点按钮 → `startCaptureFlow()` → `setStep('capture')`
2. `useEffect` 检测到 `step==='capture'` → 调 `getUserMedia({video:{facingMode:'user'}})` 
3. 用 `document.createElement('video')` 命令式创建（**不能**用 React JSX `<video>`，重渲染会断开流）
4. video append 到 `<div ref={containerRef}>` (line ~260)
5. `setInterval 400ms` 做帧差分 (`frameDifference()`) 检测转身: diff>0.08=转身中, diff<0.04=停下来了→拍照
6. 拍照: canvas.drawImage → toDataURL → 存到 `frames[]`
7. 8 角度拍完 → 预览 → 提交 AIGC

**已知可用**: 前置摄像头预览正常 ✅ | 帧差分转身检测 ❓待实测验证

**类型**: `CaptureFrame {angle, imageDataUrl, capturedAt, qualityScore}` in `src/types/bodyModel.ts`

## AIGC 算力调用

**AIGC服务器**: `jerry@100.114.7.5` (Tailscale, 密码 `0`, 4090D GPU)
**API 端口**: `http://100.114.7.5:8765`

**端点**:
- `GET /health` → `{"status":"ok","gpu":"4090 D"}`
- `POST /reconstruct` → 接收 `{measurements, frames: CaptureFrame[]}` → 返回 `{job_id, model_url, vertices, faces, method:"parametric-superellipsoid"}`
- `GET /models/{job_id}.glb` → 下载生成的 3D 模型

**服务器代码**: `server/avatar_server.py` — FastAPI + trimesh 参数化人体生成（superellipsoid 截面，14层轮廓）

**前端 API 层**: `src/services/avatarApi.ts`
- `submitReconstruction(measurements, frames)` → 调 `/reconstruct`
- `getPresetModelPath(bodyType)` → 返回预置 GLB 路径 `/models/body-{type}.glb`

**预置 GLB**: `public/models/body-{hourglass,pear,apple,rectangle,inverted_triangle}.glb` (32KB each, 897 verts)

**环境**: conda env `DeepLearning` at `/home/jerry/anaconda3/envs/DeepLearning` (CUDA 12.1, torch, trimesh, open3d, fastapi, opencv)

**启动服务器**:
```bash
ssh jerry@100.114.7.5 "source ~/anaconda3/etc/profile.d/conda.sh && conda activate DeepLearning && cd ~/avatar-server && nohup python3 avatar_server.py &>/dev/null &"
```

## 关键组件

- `src/components/outfit/GLBModelViewer.tsx` — Three.js GLTFLoader 加载 .glb
- `src/components/outfit/ProceduralAvatar.tsx` — 程序化人体（纯几何体拼合）
- `src/services/bodyModelService.ts` — manifest 生成、质量评分
- `src/hooks/useWeather.ts` — 真实天气 API

## 部署

```bash
# Cloudflare (主入口，国内可访问)
source .env && npx wrangler pages deploy dist --project-name=ai-meow-outfit

# GitHub
git push
```

## 当前待改进

1. 帧差分阈值可能需要根据实际光线环境调参
2. AIGC 目前只能 Tailscale 内网访问，手机无法直连 → 请求会 fallback 到预置 GLB
3. 预置 GLB 只有参数化人体，无纹理贴图
