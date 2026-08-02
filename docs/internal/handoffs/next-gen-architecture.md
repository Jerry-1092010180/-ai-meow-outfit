# next-gen-avatar — 完整架构分析与重新设计

---

## 第一步：当前系统架构分析

### 1.1 当前架构总览

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React 18)               │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────────┐  │
│  │ Pages (12)│ │Components│ │Stores│ │ Services  │  │
│  │ 路由页面  │ │  UI组件  │ │Zustand│ │ API层     │  │
│  └──────────┘ └──────────┘ └──────┘ └───────────┘  │
│                      │                              │
│               ┌──────┴──────┐                       │
│               │ Three.js     │                       │
│               │ WebGL 3D     │                       │
│               └──────┬──────┘                       │
├──────────────────────┼──────────────────────────────┤
│                 HTTP │                              │
├──────────────────────┼──────────────────────────────┤
│                      ▼                              │
│              ┌───────────────┐                      │
│              │ Cloudflare    │                      │
│              │ Pages / Worker│                      │
│              └───────┬───────┘                      │
├──────────────────────┼──────────────────────────────┤
│                      ▼                              │
│              ┌───────────────┐                      │
│              │ AIGC Server   │                      │
│              │ 4090D GPU     │                      │
│              │ FastAPI       │                      │
│              │ Tailscale     │                      │
│              └───────────────┘                      │
└─────────────────────────────────────────────────────┘
```

### 1.2 当前数据流

```
用户打开 H5
  → Onboarding（身型/风格/门店 3 步引导）
  → 首页（天气 API → AI 穿搭推荐标题 → 选心情 → 生成穿搭卡片）
  → 虚拟试穿（填身体数据 → 前置摄像头 → 8 张照片采集 → 帧差分检测转⾝）
  → 提交 AIGC（压缩照片 → POST /reconstruct）
  → grabCut 轮廓提取 → Visual Hull silhouette carving → GLB
  → Three.js 展示 GLB + OrbitControls
  → 预置 5 种身型 GLB 作为 fallback
```

### 1.3 所有主要模块

| 模块 | 位置 | 技术栈 | 状态 |
|------|------|--------|------|
| 首页/穿搭推荐 | `src/pages/HomePage.tsx` | React + Zustand | ✅ 可用 |
| 引导页 | `src/pages/OnboardingPage.tsx` | React | ✅ 可用 |
| 虚拟试穿 | `src/pages/TryOnPage.tsx` | React + getUserMedia | ⚠️ 采集不稳定 |
| 采集分析 | `src/services/captureAnalysis.ts` | Canvas API | ⚠️ 检测易失败 |
| 3D 试穿查看 | `src/components/outfit/GLBModelViewer.tsx` | Three.js + GLTFLoader | ✅ 可用 |
| 穿搭日记 | `src/pages/DiaryPage.tsx` | React | ✅ 可用 |
| PK 挑战 | `src/pages/ChallengeListPage.tsx` | React | ✅ 可用 |
| 双人 3D 同框 | `src/components/challenge/DualAvatar3D.tsx` | Three.js | ✅ 可用 |
| 门店好物 | `src/pages/StorePage.tsx` | React + mock data | ✅ 可用 |
| 天气服务 | `src/services/weatherService.ts` | Geolocation + Open-Meteo | ✅ 可用 |
| 重建服务 | `server/avatar_server.py` | FastAPI + OpenCV + trimesh | ⚠️ 质量有限 |
| API Gateway | `server/gateway-worker.js` | Cloudflare Worker | ❌ 未部署 |
| 状态管理 | `src/stores/` | Zustand + localStorage | ✅ 可用 |
| 海报分享 | `src/utils/poster.ts` | Canvas API | ✅ 可用 |
| 预置 GLB | `public/models/body-*.glb` | Three.js | ⚠️ 无纹理 |

### 1.4 应保留的设计

| 设计 | 保留原因 |
|------|---------|
| Three.js OrbitControls 360° 查看 | 交互成熟，用户习惯 |
| BottomNav 统一导航 | 5 个 tab 覆盖核心功能 |
| Zustand + localStorage 离线状态 | 零后端可用 |
| Cloudflare Pages 部署 | 国内访问稳定 |
| Open-Meteo 天气 API | 免费、免 Key、全球可用 |
| PK 挑战 + 双人同框 | 社交裂变已验证 |
| store/ 与 service/ 分离 | 架构清晰 |

### 1.5 应废弃的设计

| 设计 | 废弃原因 |
|------|---------|
| **Visual Hull silhouette carving** | 1990 年代技术，8 视图几何质量天花板极低，永远无法生成可用的 Avatar |
| **前置摄像头 8 张采集** | 画质差、姿态不可控、用户操作不便，行业标准已转向后置视频 / 多方案 |
| **border-color 人体检测** | 实验室算法，真实环境不可靠（白墙+白衣即失败） |
| **5 种预置身型 GLB** | 897 顶点无纹理，本质是参数化圆柱体，不可识别为"用户本人" |
| **一次性 GLB 作为最终资产** | 无身份、不可迭代、不可换衣、不可动画 |
| **纯前端 localStorage 持久化** | 产品化必须有后端数据库 |

---

## 第二步：第一性原理重新定义

### 2.1 真正目标

```
不是 "生成 GLB"
而是 "数字分身系统" (Digital Avatar System)

Avatar 的生命周期：
  创建 → 永久存储 → 迭代优化 → 试衣 → 分享 → 增长
               ↕
        商城数字身份
```

### 2.2 核心约束

```
1. Avatar ID 绑定会员 ID，永不丢失 ★★★★★
2. β 参数是身体 DNA，可丢失性 = 0 ★★★★★
3. AI 模型可替换（每半年换一代）★★★★
4. 服装和身体分离（换衣不换身）★★★★
5. 单人在家可完成创建 ★★★
6. 持续优化（越用越像）★★★
```

### 2.3 最高设计原则

> **AI 模型是可替换插件。真正稳定的是：Avatar 数据结构、数据库、商城接口、Three.js Viewer、用户资产。**

```
可替换（每 6-12 个月换一代）：
  ├── 人体检测模型   MediaPipe → ViTPose → 下一代
  ├── 3D 重建模型    PIFu → ECON → Gaussian Avatar
  ├── 纹理生成模型   PyTorch3D → DreamGaussian → 下一代
  ├── 人脸模型       DECA → MICA → EMICA
  └── 发型模型       NeuralHaircut → 下一代

不可替换（系统骨架）：
  ├── Avatar 数据结构 (SMPL β + 纹理 URL)
  ├── PostgreSQL 数据库 (13 张表)
  ├── 商城服装资产接口 (Garments API)
  ├── Three.js Viewer (GLB 加载 + OrbitControls)
  └── 用户身份系统 (User → Avatar 绑定)
```

---

## 第三步：完整 Pipeline 设计

### 3.1 采集层 (Capture)

```
方案 A（门店，最优）：
  3D 体测仪（[TC]² / Size Stream）
  → 360° 点云 + 准确围度
  → 数据直传后端

方案 B（家中，推荐）：
  手机后置相机 + 30s 全身视频
  → 用户穿紧身衣，朋友拍摄
  → 或手机支架 + 自我录制
  → 提取 30-60 帧

方案 C（家中，入门）：
  3 张照片（正 + 侧 + 背）
  → 由朋友拍摄（非自拍）
  → 质量最低但可用

方案 D（兼容）：
  现有前置相机 8 张
  → 保留通道，但标为低质量
```

**关键变更**：前置相机不再为主方案。默认引导用户使用后置相机（方案 B）。

### 3.2 分割层 (Segmentation)

```
输入：  视频帧 / 照片
输出：  人体掩码 (binary mask)
推荐：  REMBG (GPU) / MediaPipe Selfie (Web)
设计：  插件化，接口 segment(frame: ImageData) → mask: ImageData
可替换： ✅ 直接换模型不改管线
```

### 3.3 姿态估计层 (Pose Estimation)

```
输入：  去除背景的图像
输出：  2D/3D 关节点 (COCO-17 / BODY-25)
推荐：  ViTPose / OpenPose
用途：  → SMPL fitting 初始化
       → 相机位姿估计 (SfM)
       → 角度判断
可替换： ✅ 统一 joint 格式
```

### 3.4 身体参数估计层 (Body Parameter) ⭐ 核心

```
输入：  2D joints + mask + 多视角照片
输出：  SMPL-X β (100 floats) + θ (pose params)
推荐：  SMPLify-X / SPIN / CLIFF
存储：  body_parameters 表 (1:N 版本化)
可替换： ✅ SMPL 输出格式固定
         ⚠️ 但模型可换（核心资产）
```

### 3.5 面部重建层 (Face)

```
输入：  正面照片 + SMPL head mesh
输出：  FLAME parameters (~100 维)
        面部纹理图 (512×512)
推荐：  DECA / MICA
存储：  faces 表 (1:N 版本化)
可替换： ✅ FLAME 参数固定
```

### 3.6 发型层 (Hair)

```
输入：  多帧照片 + 头 mesh
输出：  发型参数 / 预设 ID
推荐：  先用预设库 (20 种)，后续 NeuralHaircut
存储：  hairs 表
可替换： ✅ 独立于 body
```

### 3.7 几何细节层 (Mesh Detail)

```
输入：  SMPL mesh + 多视角照片
输出：  50K-100K 顶点三角网格
推荐：  ECON (当前最佳)
        → InstantAvatar (NeRF)
        → Gaussian Avatar (3DGS, 前沿)
存储：  不存 mesh，只存原始数据
       mesh 可从 β + texture 随时重建
可替换： ✅ 模板投影，不影响下游
```

### 3.8 纹理层 (Texture)

```
输入：  SMPL mesh + 多视角照片 + 相机位姿
输出：  PBR 纹理贴图 (2048×2048)
        BaseColor + Normal + Roughness
推荐：  PyTorch3D texture baking (自研封装)
存储：  CDN → URL 存数据库
可替换： ⚠️ 需要自研（需针对亚洲肤色调参）
```

### 3.9 蒙皮层 (Rigging)

```
输入：  SMPL mesh (任意版本)
输出：  已蒙皮到 52 关节骨骼的 mesh
推荐：  SMPL LBS (确定性算法，无模型)
存储：  不存，运行时实时计算
可替换： ❌ 标准算法，无需替换
```

### 3.10 服装层 (Garment)

```
输入：  SMPL Avatar + 服装资产库 (GLB)
输出：  穿着衣物后的完整 Avatar
推荐：  品牌商 CLO3D 上传 GLB
        → 后期 ML 神经服装仿真
存储：  garments 表 (平台资产)
可替换： ✅ 服装资产独立于 body
```

### 3.11 动画层 (Animation)

```
输入：  SMPL pose θ 序列
输出：  驱动 Avatar 的骨骼动画
推荐：  预设动画库 + Mixamo retarget
可替换： ✅ 换动画不改管线
```

### 3.12 最终交付 (Three.js)

```
前端加载策略：
  avatar_id + outfit_id
  → API 返回 β (2KB) + 纹理 URL (8MB) + 服装 GLB URL
  → Three.js 实时构建 mesh
  → 加载纹理 + 服装
  → OrbitControls + animation
  → 不下载 GLB 文件（β 重建）
```

---

## 第四步：数据库设计（13 张表）

见 `docs/database-design.md`（已从 experiment/avatar-v2 分支同步）。核心总结：

| 表 | 核心字段 | 为什么 |
|------|---------|--------|
| `users` | phone, wechat_openid, miaojie_member_id | 身份锚点 |
| `avatars` | user_id (1:1), 4 个 active version FK | 分离身份与分身 |
| `body_parameters` | beta JSONB (100 floats), version | **核心资产，DNA** |
| `faces` | flame_params JSONB, texture_url | 独立于身体迭代 |
| `hairs` | hairstyle_id, color_hex | 独立维度 |
| `measurements` | 各种 cm 值, source | 尺码推荐 |
| `capture_sessions` | method, quality | 采集来源追踪 |
| `images` | angle, image_type, file_url | 原始数据保存 |
| `garments` | brand, category, glb_url | 平台共享资产 |
| `outfits` + `outfit_items` | avatar_id + garment_id[] | 用户穿搭 |
| `try_on_history` | **body_id + garment_id + fit_score** | **AI 训练核心** |
| `shares` | avatar_id, platform, poster_url | 社交度量 |
| `animations` | pose_sequence (JSONB) | 平台动画库 |

---

## 第五步：目录结构

```
next-gen-avatar/
│
├── frontend/                    ← 前端 (React + Three.js)
│   ├── src/
│   │   ├── pages/               # 路由页面 (保留当前 12 页)
│   │   ├── components/          # UI 组件
│   │   ├── avatar/              # Avatar 核心 (新增)
│   │   │   ├── SMPLGenerator.ts # β → mesh 实时生成
│   │   │   ├── TextureLoader.ts # 纹理加载
│   │   │   ├── GarmentLayer.ts  # 服装叠加
│   │   │   └── AvatarViewer.tsx # 统一的 3D Viewer
│   │   ├── capture/             # 采集模块 (新增)
│   │   │   ├── rear-camera/     # 后置相机采集
│   │   │   ├── front-camera/    # 前置兼容 (现有代码)
│   │   │   └── photo-3/         # 3 张照片方案
│   │   ├── stores/              # Zustand (保留)
│   │   ├── services/            # API 层
│   │   │   └── avatar-api.ts    # 新 Avatar REST API
│   │   └── types/               # 类型
│   │       └── avatar.ts        # 新 Avatar 数据类型
│   ├── public/
│   │   └── vendor/              # MediaPipe wasm 等本地资源
│   └── package.json
│
├── backend/                     ← 后端 (可独立部署)
│   ├── api/                     # FastAPI REST
│   │   ├── main.py              # 路由入口
│   │   ├── avatar.py            # Avatar CRUD
│   │   ├── capture.py           # 采集上传
│   │   ├── garment.py           # 服装资产
│   │   └── recommendations.py   # AI 推荐
│   ├── services/                # 业务逻辑
│   │   ├── avatar_service.py    # Avatar 生命周期
│   │   ├── reconstruction.py    # 重建管线编排
│   │   └── garment_service.py   # 服装匹配
│   ├── models/                  # SQLAlchemy / ORM
│   │   ├── user.py
│   │   ├── avatar.py
│   │   ├── body_parameters.py
│   │   ├── garment.py
│   │   └── try_on_history.py
│   ├── migrations/              # Alembic 迁移
│   └── requirements.txt
│
├── pipeline/                    ← AI 重建管线 (可独立部署)
│   ├── segment/                 # 分割模块 (可插拔)
│   │   ├── interface.py         # 统一接口
│   │   └── models/
│   │       ├── rembg_model.py
│   │       └── mediapipe_model.py
│   ├── pose/                    # 姿态估计 (可插拔)
│   │   ├── interface.py
│   │   └── models/
│   │       ├── vítpose.py
│   │       └── openpose.py
│   ├── smpl/                    # SMPL 核心 (自研)
│   │   ├── smplx_model.py
│   │   ├── smplify_x.py
│   │   └── texture_baking.py
│   ├── face/                    # 面部重建 (可插拔)
│   │   ├── interface.py
│   │   └── models/
│   │       ├── mica.py
│   │       └── deca.py
│   └── hair/                    # 发型 (先用预设)
│       ├── preset_library.py
│       └── shapes.py
│
├── worker/                      ← Cloudflare Worker (单独部署)
│   └── gateway.js               # API Gateway
│
├── storage/                     ← 存储
│   ├── avatar-output/           # AIGC 生成输出
│   └── uploads/                 # 用户上传
│
├── docs/                        ← 设计文档
│   ├── architecture.md
│   ├── database-design.md
│   └── pipeline-modules.md
│
└── README.md
```

### 可独立部署的模块

| 模块 | 独立部署 | 原因 |
|------|---------|------|
| `frontend/` | ✅ Cloudflare Pages | 静态文件，CDN 部署 |
| `backend/` | ✅ 任意云 | 数据库操作，可水平扩展 |
| `pipeline/` | ✅ AIGC 4090D | GPU 密集，单独机器 |
| `worker/` | ✅ Cloudflare Workers | Serverless |

### 应保持单体的模块

| 模块 | 原因 |
|------|------|
| `backend/models/` | 统一 ORM，跨表事务 |
| `backend/services/` | Avatar 创建需要跨多表操作 |

---

## 第六步：三个月 Roadmap

### P0 — 系统骨架（Month 1）

**核心原则：即使 AI 模型全部替换，这些模块仍然稳定。**

| 任务 | 交付物 | 依赖 |
|------|--------|------|
| P0.1 数据库 Schema 实现 | PostgreSQL + Alembic 迁移 | 无 |
| P0.2 Avatar REST API (CRUD) | 创建/读取/更新 Avatar | P0.1 |
| P0.3 Three.js SMPL Viewer | β → mesh 实时生成 | SMPL 模型文件 |
| P0.4 用户 → Avatar 绑定 | user_id → avatar_id 注册流程 | P0.2 |
| P0.5 服装资产 CRUD API | 品牌商上传 GLB | P0.1 |

### P1 — 采集与重建（Month 1-2）

| 任务 | 交付物 | 依赖 |
|------|--------|------|
| P1.1 后置相机采集 (B 方案) | 引导用户+朋友拍摄视频 | 前端 |
| P1.2 3 张照片采集 (C 方案) | 拍照→上传→预览 | 前端 |
| P1.3 REMBG 分割服务 | 部署 segment/ 管线 | P0.1 |
| P1.4 ViTPose 姿态估计 | 部署 pose/ 管线 | P0.1 |
| P1.5 SMPLify-X 拟合 | β 参数输出, 存数据库 | P0.2 + 4090D |
| P1.6 MICA 面部重建 | FLAME 参数 + 纹理 | P0.2 + 4090D |
| P1.7 纹理烘焙 | PBR 贴图 (2048×2048) | P0.2 + 4090D |

### P2 — 产品化（Month 2-3）

| 任务 | 交付物 | 依赖 |
|------|--------|------|
| P2.1 Avatar Studio 页面 | 查看/编辑/版本管理 | P1.1-P1.7 |
| P2.2 服装试穿 | CLO3D GLB 加载 + Avatar 叠加 | P0.3 |
| P2.3 现有页面迁移 | 将旧采集→新采集 | P1.1 |
| P2.4 API Gateway 部署 | Worker 上线 + health | P1.5 |
| P2.5 预设动画 | walk/turn/catwalk | P0.3 |

### P3 — 增强（Month 3+）

| 任务 | 交付物 | 依赖 |
|------|--------|------|
| P3.1 门店体测仪对接 | 方案 A 集成 | P0.1 |
| P3.2 发型系统 | 预设 20 种 → NeuralHaircut | P1.6 |
| P3.3 多 Al 模型对比 | ECON / InstantAvatar / Gaussian | P1.7 |
| P3.4 社交分享 | Avatar 截屏→AI 海报→朋友圈 | P2.1 |
| P3.5 try_on_history 数据收集 | AI 训练数据集 | P2.2 |
