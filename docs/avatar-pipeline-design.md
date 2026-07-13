# Avatar Pipeline v2 — 国际最佳实践

> 基于 SMPL / PIFu / ECON / Gaussian Avatar 等方向重新设计
> 不参考当前项目，按行业标准重建

---

## 总体架构：三阶段 + 双路径

```
采集阶段              云端重建阶段             交付阶段
┌────────┐   ┌────────────────────┐   ┌────────────┐
│ Capture│   │ Pipeline Server    │   │ Runtime     │
│ Phone   │ → │ (4090D + Cloud)    │ → │ Three.js    │
│ Studio  │   │ SMPL + PIFu + Tex  │   │ WebGL       │
└────────┘   └────────────────────┘   └────────────┘
```

**双路径：**

| | 快速路径 (Preview) | 高质量路径 (Final) |
|---|---|---|
| 耗时 | 10-30s | 3-15 min |
| 模型 | SMPLify-X + texture | ECON + Gaussian Avatar |
| 用途 | 采集后立即预览 | 后台异步生成，推送通知 |
| 质量 | 可识别 | 照片级 |

**核心哲学**：所有路径共享 SMPL-X 参数表示。快速路径和高质量路径的 β 参数是同一套，后续升级不丢失身份。

---

## 分步骤设计

### Step 0: Capture（采集）

```
输入：  用户本人
输出：  视频帧序列 / 照片集合
推荐方案：
```

**方案 A（推荐，质量最高）— 门店体测仪**

```
设备： [TC]² / Size Stream / Styku 3D Body Scanner
输入： 60s 全身多视角扫描
输出： 360° 点云 (300K-1M points)
      自动测量的身体围度 (精度 ±2mm)
      身高、体重、三围、肩宽、腿长
```

**方案 B（进阶级）— 手机后置相机 + 全身视频**

```
环境： 浅色/纯色背景，均匀光照，穿紧身浅色衣服
设备： 手机 + 支架 + 后置相机
操作： 用户被拍摄慢慢旋转一周（30-60 秒）
输出： 1080p 视频 → 提取 30-60 帧
```

**方案 C（入门级）— 3 张照片**

```
设备： 任何手机
操作： 正面全身照 + 侧面全身照 + 背面全身照
       (由朋友拍摄，非自拍)
输出： 3 张 JPG
```

**为什么不用前置相机：** 人体建模史上，所有成功方案都用后置相机或专用设备。前置相机是妥协不是方案。

---

### Step 1: Segmentation（分割）

```
输入：  视频帧 / 照片
输出：  人体掩码 (Binary Mask, 每像素 0/1)
推荐模型： REMBG (GPU) / MediaPipe Selfie (Web) / SAM
```

**设计决策：**

| 场景 | 模型 | 原因 |
|------|------|------|
| 云端 GPU | `REMBG` (u²-net) | 精度高，稳定，国产兼容 |
| 本地 Web | `MediaPipe Selfie` | 浏览器内实时，WASM |
| 复杂背景 | `SAM` (Segment Anything) | 99% 准确率，但慢 |

**可替换性**：分割模型通过统一接口 `segment(frame) → mask` 调用。后面换新模型不改管线。

**为什么自己做**：不自己造模型，封装现有成熟方案。分割不是核心竞争力。

---

### Step 2: Background Removal + Cropping

```
输入：  原图 + 掩码
输出：  去掉背景的全身人像
       自适应裁切 (视觉中心)
工具：  OpenCV / Torchvision transforms
```

**这一步的目的是为下游模型提供干净的输入。** PIFu、Pose 模型都对输入有要求（居中、比例合适）。

---

### Step 3: Pose Estimation（姿态估计）

```
输入：  每帧去掉背景的人像
输出：  2D 关节点 (25-133 个) + 置信度
       每帧相机位姿（增量式 SfM）
推荐模型： OpenPose / ViTPose / MediaPipe Pose
```

**技术选择：**

| 模型 | 关节数 | 速度 | 精度 | 推荐 |
|------|--------|------|------|------|
| MediaPipe Pose | 33 | 实时 | 普通 | 本地预览 |
| ViTPose-B | 133 | 25fps | 极高 | 云端主力 |
| OpenPose | 25 (BODY-25) | 30 fps | 高 | 兼容性最好 |

**输出结构：**

```
[{x, y, confidence}, ...] for each of 25+ joints
camera_poses: {frame_idx, R, t} from incremental SfM (COLMAP / OpenMVG)
```

**可替换性**：所有姿态估计模型输出统一为 COCO / BODY-25 格式。切换模型只需修改 `pose.py` 中的一行 import。

---

### Step 4: SMPL-X Parameter Estimation（人体参数估计）

```
输入：  2D 关节点 (多帧) + 人体掩码 (多帧) + 身体测量值
输出：  SMPL-X β (shape) — ~100 维度
        SMPL-X θ (pose) — 52×3 维度 (每个关节)
        每帧拟合误差分数
推荐模型： SMPLify-X / SPIN / CLIFF / PARE
```

**这是整个管线的核心步骤。** 所有后续步骤都依赖准确的 SMPL 参数。

**为什么用 SMPL-X（而非普通 SMPL）：**
- SMPL-X 包含手部（15 关节/手）、面部（FLAME 模型）、脚步
- 可准确对应到后续服装蒙皮
- 是 CLO3D、MetaHuman、Blender 等行业工具的公共语言

**具体流程（SMPLify-X 在 4090D 上）：**

```
每帧 2D joints + mask → 投影匹配 → 优化 β/θ/性别
多帧联合优化 → 输出平均 β
每帧单独优化 θ（姿态）

约 30s on 4090D (10 帧)
约 2min on CPU (可接受)
```

**输出存储格式（数据库核心资产）：**

```json
{
  "avatar_id": "uuid",
  "smpl_parameters": {
    "beta": [0.12, -0.05, 0.33, ...],  // ~100 维
    "gender": "female",
    "height_cm": 168.0,
    "weight_kg": 58.0
  },
  "measurements": {
    "shoulder": 38,
    "bust": 84,
    "waist": 64,
    "hip": 90,
    "inseam": 76
  },
  "confidence": 0.92
}
```

**为什么自己开发（而非调用 API）：**
- SMPL 参数是 Avatar 的核心数字资产
- 不能依赖第三方 API（成本、隐私、稳定性）
- SMPLify-X 是开源代码，已有 10 年验证
- 4090D 可以运行 SMPLify-X 全量优化（不需要蒸馏版）

**可替换性**：SMPL 参数格式是行业标准。未来 SPIN → CLIFF → 更新模型，替换的是优化器，不是输出格式。

---

### Step 5: Face Reconstruction（面部重建）

```
输入：  SMPL-X mesh + 多帧面部截取
输出：  FLAME 参数 (面部形状、表情)
       面部纹理贴图 (512×512)
推荐模型： DECA / MICA / EMICA
```

**为什么面部单独处理：**
- 面部精度需求远高于身体（别人看 Avatar 第一眼看脸）
- SMPL-X 的面部基础模型 (FLAME) 只有 3K 顶点，不够
- 需要专门的面部重建来驱动表情

**推荐方案 (MICA — 2023)：**
```
输入： 1 张正面照片
输出： FLAME 参数，ML 模型直接从照片回归
      (不需要多视角，不需要优化的)
```

**可替换性**：FLAME 参数兼容 SMPL-X。MICA → EMICA → 更高精度的面部重建，输出格式不变。

---

### Step 6: Hair Reconstruction（头发重建）

```
输入：  多帧照片 + SMPL-X 头部 mesh
输出：  头发几何体 (独立 mesh / 发丝)
推荐模型： NeuralHaircut / H3D-Net / Gaussian Hair
```

**这是目前最难的部分。** 头发重建仍然是学术界开放问题。

**实用建议（非学术路线）：**

```
近期方案（6 个月内可交付）：
  └─ 用预设发型库 (20-50 种) + 身高/性别/脸型匹配
  └─ 用户从预设发型中选择，微调颜色 + 长度

远期方案（12 个月+）：
  └─ NeuralHaircut：从 3 张照片恢复发丝级精度
  └─ 需要约 30s on 4090D
```

**可替换性**：发型系统独立于 body pipeline。前期可以完全用预设方案，后期切换。

---

### Step 7: Detailed Mesh Generation（几何细节生成）

```
输入：  SMPL-X mesh + 多帧照片 + 人体掩码
输出：  高精度三角网格 (50K-100K 顶点)
       几何细节 (衣服褶皱、肌肉线条、皮肤细节)
推荐模型： PIFuHD → ECON → InstantAvatar (三代演进)
```

**模型演进路线：**

```
PIFuHD (2020)     → 从单张图推断 3D 几何，隐式函数
                     精度一般，纹理模糊
                         ↓
ECON (2023)       → 显式 + 隐式混合
                     SMPL 引导的隐式重建
                     衣服细节更清晰
                     当前最佳"单张照片→穿衣人体"方案
                         ↓
InstantAvatar (2024) → NeRF-based
                       需要 30-60s 视频
                       精度最高，速度最慢
                         ↓
3D Gaussian Avatar (2025) → 3DGS + SMPL
                            可实时渲染
                            当前学术界最前沿
```

**推荐当前方案**：**ECON** 结合 SMPL 引导，是目前实际可用的最优解。

```
时间： 约 40s on 4090D
输入： 1 张正面照片 + SMPL fitting
输出： 50K 顶点网格 + 法线贴图
```

**可替换性**：所有模型输出都对齐到 SMPL-X 骨骼（通过模板匹配）。换模型不影响下游纹理、蒙皮、服装。

---

### Step 8: Texture Generation（纹理贴图生成）

```
输入：  SMPL mesh + 多视角照片 + 相机位姿
输出：  PBR 纹理贴图 (2048×2048)
       - Base Color (漫反射)
       - Normal (法线)
       - Roughness (粗糙度)
       - Metallic (金属度)
推荐模型： PyTorch3D texture baking / nvdiffrec / DreamFusion
```

**流程：**

```
SMPL mesh → UV 展开 (使用 SMPL 标准 UV 布局)
         ↓
对每张三⾓面，找到最垂直的视角 → 从照片采样颜色
         ↓
多视角颜⾊融合 → Seamless blending → 消除接缝
         ↓
超分辨率 (可选) → ESRGAN / GFPGAN 提升到 4K
```

**为什么自己开发：**
- 纹理烘焙不是研究问题，是工程问题
- 多视角颜色融合需要针对亚洲肤色调参
- 颜⾊一致性对中国用户尤其重要（肤色、发型）
- PyTorch3D 提供了所有基础工具，只需组合

---

### Step 9: Rigging（蒙皮绑定）

```
输入：  SMPL-X mesh (或 ECON 细节 mesh)
输出：  同一骨骼绑定的 skinned mesh
工具：  SMPL 标准 LBS (Linear Blend Skinning)
```

**不是模型——是一个确定性计算步骤。**

```
SMPL-X template:  10475 顶点, 52 个关节
     ↓
ECON mesh 投影到 SMPL 拓扑 → 继承蒙皮权重
     ↓
输出顶点数: 10475 (标准) 或 50000+ (细节)
     ↓
权重传递方法: 最近邻 + 拉普拉斯平滑
```

**为什么自动完成：**
- SMPL 框架自带 LBS
- 不需要深度学习
- 毫秒级计算

---

### Step 10: Garment System（服装系统）

```
输入：  裸体 SMPL Avatar + 服装资产库
输出：  穿着衣物的 Avatar (同一骨架)
工具：  CLO3D (专业) / ML (自动化) / 混合 (推荐)
```

**行业现状：**

| 方案 | 效果 | 成本 | 速度 |
|------|------|------|------|
| CLO3D 物理仿真 | 真实 | ¥5-20/件 | 10 min/件 |
| ML 虚拟试穿 (VTON) | 尚可 | ¥0.01/次 | 1s/次 |
| 人工 3D 建模 | 极高 | ¥200-500/件 | 2 天/件 |
| **混合方案 (推荐)** | **良** | **低** | **快** |

**推荐方案：两阶段**

```
阶段一 (0-3 月)：CLO3D 数字样衣
  采购：银泰品牌商提供 CLO3D 版型文件
  转换：GLB 蒙皮到 SMPL 骨骼
  穿法：替换 skinning weight，覆盖身体 mesh

阶段二 (3-12 月)：神经服装仿真
  ML 从视频学习服装褶皱
  实时推理服装变形
  参考：SNUG / HOOD / CAPE / TailorNet
```

---

### Step 11: Animation (动画)

```
输入：  SMPL-X pose 参数 (θ)
输出：  GLB 骨骼动画
工具：  SMPL pose blend shapes + LBS
```

**动画来源：**

```
预设动画库：
  ├── T-pose → A-pose 过渡 (站立)
  ├── 360° 旋转展示 (自动旋转)
  ├── 走秀 (catwalk, 30 帧循环)
  ├── 试衣姿态 (T-pose)
  └── 手势变化 (10 个常见手势)

Mixamo 动画 → retarget → SMPL 骨骼：
  ├── 走路  (walk: 30 fps, 60 帧)
  ├── 跑步  (run: 30 fps, 40 帧)
  ├── 转身  (turn: 30 fps, 30 帧)
  └── 跳跃  (jump: 24 fps, 45 帧)
```

---

### Step 12: Export → GLB → Three.js（最终交付）

```
输入：  SMPL mesh + 纹理 + 服装 + 动画
输出：  GLB 二进制文件 (单文件，含全部数据)
```

**GLB 结构：**

```
scene.glb
├── Mesh_Avatar_Body    → SMPL 几何 (5000-50000 tris)
├── Mesh_Avatar_Head    → 面部几何 (3000 tris)
├── Mesh_Hair           → 头发几何 (500-5000 tris)
├── Mesh_Garment_Top    → 上衣 (由 CLO3D 或 ML 生成)
├── Mesh_Garment_Bottom → 下装
├── Mesh_Shoes          → 鞋子
├── Skeleton            → 52 关节 SMPL 骨骼
├── Animations           → 预设动画序列
└── Textures             → 2048×2048 PBR 贴图
```

**Three.js 加载架构：**

```typescript
// 前端不下载 GLB 文件！
// 前端下载: β (2KB) + 纹理图 (8MB)
// 使用 @smplx/three 库或自建 loader 实时构建 mesh

new SMPLLoader()
  .loadBeta(beta_array)          // 2KB 参数
  .loadTexture(texture_url)       // 纹理从 CDN 加载
  .loadGarment(garment_id)       // 服装资产 (可选)
  .buildSkeleton()               // LBS 蒙皮
  .playAnimation('walk')         // 播放动画
```

---

## 管线总览

```
Step    输入                 输出              模型                耗时(4090D)
───     ────                ────              ────                ──────────
 0      User                Video/Photos      Phone / Scanner     30-60s
 1      Frame               Mask              REMBG / SAM        2s/帧
 2      Mask                Cropped           OpenCV             1s/帧
 3      Cropped             2D Joints         ViTPose / OpenPose 1s/帧
 4      Joints+Masks        SMPL β+θ          SMPLify-X          30s
 5      SMPL+Face shots     FLAME params      DECA / MICA        5s
 6      SMPL+Photos         Hair mesh         NeuralHaircut      20s
 7      SMPL+Photos         50K mesh          ECON               40s
 8      Mesh+Photos         Texture           PyTorch3D          30s
 9      Mesh                Rigged mesh       SMPL LBS           1s
10      Avatar+Garment      衣装 Mesh         CLO3D / ML         10s+
11      Rigged mesh         Animation         SMPL pose          1s
12      Mesh+Tex+Anim       GLB               GLTF exporter      2s
                                            ──────────────
                                             总计: ~2-3min
```

---

## 模块自制 vs 调用决策

| 模块 | 自研 | 调成熟模型 | 可替换 | 理由 |
|------|:----:|:---------:|:-----:|------|
| 分割 | ❌ | ✅ REMBG/SAM | ✅ | 不是核心竞争力 |
| 姿态估计 | ❌ | ✅ ViTPose | ✅ | 换模型不改格式 |
| **SMPL 拟合** | ✅ 封装 | ✅ SMPLify-X | ⚠️ 格式固定 | **核心资产，可控** |
| 面部重建 | ❌ | ✅ DECA/MICA | ✅ | 专业模型优于自研 |
| 头发 | ❌ | ✅ H3D-Net | ✅ | 先用预设，后续升级 |
| 几何细节 | ⚠️ 封装 | ✅ ECON | ✅ | 调参，不反复造轮子 |
| 纹理烘焙 | ✅ 自研 | PyTorch3D 工具 | ✅ | 需要针对亚洲人调参 |
| 蒙皮 | ✅ 自研 | SMPL LBS | ❌ 标准 | 确定性算法 |
| 服装系统 | ⚠️ 混合 | CLO3D + ML | ❌ 依赖 | 需要与银泰服装商合作 |
| 动画 | ❌ | Mixamo / 预设 | ✅ | 改动画不改管线 |
| GLB 导出 | ✅ 自研 | THREE.GLTFExporter | ✅ | 工程问题 |

---

## 对比：当前方案 vs 新方案

| | 当前 (Visual Hull) | 新 (SMPL + ECON) |
|---|---|---|
| 人体检测 | 颜色阈值→常失败 | 关键点+分割+多帧 |
| 几何 | 纸片级 | 照片级 |
| 纹理 | 无 | 2048×2048 PBR |
| 可换衣服 | ❌ | ✅ (标准化骨架) |
| 可动画 | ❌ | ✅ (52 关节骨骼) |
| 存储 | 10MB/GLB/次 | 2KB β + 8MB 纹理 |
| 身份持久 | ❌ | ✅ (Avatar ID) |
| 单人操作 | ❌ 前置难 | ✅ 后置+朋友 |
| 门店体测仪 | ❌ 不支持 | ✅ 支持 (同输出格式) |

---

## 关键结论

> **SMPL-X 不是技术选择——它是商业选择。**
> 
> 使用 SMPL 意味着你和 CLO3D、MetaHuman、Unreal Engine、Blender、银泰供应商使用的是同一套人体表示。服装资产可以跨平台复用，Avatar 可以导出到任何支持 SMPL 的环境。
>
> Visual Hull 生成的网格只有你自己能读。SMPL 生成的 Avatar 是整个人体数字经济的通行证。
