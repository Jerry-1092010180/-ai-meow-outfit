/**
 * ============================================================
 * AI Provider 接口层
 * ============================================================
 *
 * 这是整个 Avatar 系统的架构基础。
 *
 * ★ 所有 AI 模型通过 Provider 接口调用 ★
 *
 * 设计原则：
 *   1. 每 6-12 个月可以换一代 AI 模型
 *   2. 换模型 = 换 Provider 实现，不改管线
 *   3. Provider 的输出格式是整个系统的数据契约
 *
 * 当前支持的 Provider 类型：
 *   Segmentation      — 人体分割（REMBG / MediaPipe / SAM）
 *   PoseEstimator     — 姿态估计（ViTPose / OpenPose / MediaPipe）
 *   BodyEstimator     — SMPL 人体参数估计（SMPLify-X / SPIN / CLIFF）
 *   FaceEstimator     — 面部重建（DECA / MICA / EMICA）
 *   TextureGen        — 纹理生成（PyTorch3D / DreamGaussian）
 *   MeshDetail        — 几何细节生成（PIFu / ECON / InstantAvatar）
 *   HairGenerator     — 发型生成（NeuralHaircut / 预设）
 *
 * 使用方式：
 *   const provider = new PIFuMeshProvider(); // 或 ECONMeshProvider
 *   const result = await provider.generate(images, smpl);
 *
 * ============================================================
 */

// ── 通用类型 ─────────────────────────────────────────────────

/** 2D/3D 关键点 */
export interface Keypoint {
  x: number;
  y: number;
  z?: number;
  confidence: number;       // 0-1
}

/** 人体 2D 关键点集合 (COCO-17 或 BODY-25) */
export interface PoseKeypoints {
  joints: Keypoint[];
  /** 使用的关键点格式: 'coco-17' | 'body-25' | 'smplx-133' */
  format: string;
  /** 检测置信度 (0-1) */
  confidence: number;
}

/** 相机位姿 */
export interface CameraPose {
  frameIndex: number;
  rotation: [number, number, number, number];  // 四元数
  translation: [number, number, number];
  focalLength: number;
}

/** 图像帧 (管线内部的图像表示) */
export interface PipelineImage {
  /** 原始图像数据 (RGBA) */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** 拍摄角度 (0-315) */
  angle: number;
  cameraPose?: CameraPose;
}

/** 2D 人体掩码 */
export interface SegmentationMask {
  data: Uint8Array;          // 0 或 1 的像素值
  width: number;
  height: number;
}

/** 三角网格 */
export interface MeshData {
  vertices: Float32Array;    // [x0,y0,z0, x1,y1,z1, ...]
  faces: Uint32Array;        // [i0,j0,k0, i1,j1,k1, ...]
  /** 顶点数 */
  vertexCount: number;
  /** 三角面数 */
  faceCount: number;
  /** UV 坐标 (可选) */
  uvs?: Float32Array;
  /** 法线 (可选) */
  normals?: Float32Array;
}

/** RGB 纹理贴图 */
export interface TextureMap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** 贴图类型 */
  mapType: 'baseColor' | 'normal' | 'roughness' | 'metallic';
}


// ── SMPL 数据类型 ────────────────────────────────────────────

/**
 * SMPL-X 人体参数。
 *
 * 这是平台最核心的数据结构。
 * β 参数就是 Avatar 的 DNA — 不可丢失，不可替代。
 */
export interface SMPLParameters {
  /** 形状参数 (~100 维) */
  beta: number[];
  /** 姿态参数 (52 关节 × 3 旋转) */
  pose: number[];
  /** 面部表情参数 */
  expression?: number[];
  /** 性别 */
  gender: 'male' | 'female' | 'unknown';
  /** 拟合置信度 (0-1) */
  confidence: number;
}

/** SMPL 拟合结果 */
export interface SMPLResult {
  parameters: SMPLParameters;
  /** 拟合后的网格 */
  mesh: MeshData;
  /** 拟合误差 (越小越好) */
  fittingError: number;
  /** 使用的 Provider 名称 */
  provider: string;
}

/** FLAME 面部参数 */
export interface FLAMEParameters {
  shape: number[];
  expression: number[];
  jawPose: number[];
}


// ── Provider 接口 ────────────────────────────────────────────

/**
 * 人体分割 Provider
 *
 * 职责：从输入图像中提取人体掩码
 *
 * 可替换实现：
 *   - REMBGProvider (GPU, 精度高)
 *   - MediaPipeSelfieProvider (Web, 实时)
 *   - SAMProvider (精度最高, 速度慢)
 */
export interface SegmentationProvider {
  /** Provider 名称（用于日志和调试） */
  readonly name: string;

  /**
   * 对单帧图像做人体分割
   * @param image  输入图像
   * @returns      人体掩码 (前景=1, 背景=0)
   */
  segment(image: PipelineImage): Promise<SegmentationMask>;
}

/**
 * 姿态估计 Provider
 *
 * 职责：从图像中检测人体关键点
 *
 * 可替换实现：
 *   - ViTPoseProvider (GPU, 精度最高)
 *   - OpenPoseProvider (GPU/CPU, 兼容性好)
 *   - MediaPipePoseProvider (Web, 实时)
 */
export interface PoseEstimatorProvider {
  readonly name: string;

  /**
   * 从单帧图像估计人体姿态
   * @param image  输入图像
   * @returns      2D 关键点
   */
  estimate(image: PipelineImage): Promise<PoseKeypoints>;
}

/**
 * SMPL 身体参数估计 Provider（⭐ 核心资产）
 *
 * 职责：从多帧关键点 + 掩码估计 SMPL-X β/θ 参数
 *
 * 这是整个管线最重要的环节。
 * β 参数是 Avatar 的数字身份，不可丢失。
 *
 * 可替换实现：
 *   - SMPLifyXProvider (经典, 稳定)
 *   - SPINProvider (速度快)
 *   - CLIFFProvider (精度高)
 */
export interface BodyEstimatorProvider {
  readonly name: string;

  /**
   * 估计 SMPL 人体参数
   * @param images        多视角图像
   * @param keypoints     每帧的 2D 关键点
   * @param masks         每帧的人体掩码
   * @param measurements  身体测量值 (身高/体重等)
   * @returns             SMPL 参数 + 拟合网格
   */
  estimate(
    images: PipelineImage[],
    keypoints: PoseKeypoints[],
    masks: SegmentationMask[],
    measurements: BodyMeasurements
  ): Promise<SMPLResult>;

  /**
   * 从单张照片快速估计（用于快速预览）
   * @param image         正面全身照
   * @param heightCm      身高
   * @param weightKg      体重
   * @returns             快速 SMPL 参数 (低精度)
   */
  quickEstimate(
    image: PipelineImage,
    heightCm: number,
    weightKg?: number
  ): Promise<SMPLParameters>;
}

/** 身体测量值 */
export interface BodyMeasurements {
  heightCm: number;
  weightKg?: number;
  /** 肩膀宽度 (cm) */
  shoulderCm?: number;
  /** 胸围 (cm) */
  bustCm?: number;
  /** 腰围 (cm) */
  waistCm?: number;
  /** 臀围 (cm) */
  hipCm?: number;
  /** 大腿内侧长度 (cm) */
  inseamCm?: number;
}

/**
 * 面部重建 Provider
 *
 * 职责：从正面照片重建面部几何 + 纹理
 *
 * 可替换实现：
 *   - MICAProvider (2023, ML 直接从照片回归)
 *   - DECAProvider (经典, 稳定)
 *   - EMICAProvider (2024, 精度更高)
 */
export interface FaceEstimatorProvider {
  readonly name: string;

  /**
   * 从正面照片重建面部
   * @param images      多帧正面面部照片
   * @param smplMesh    已拟合的 SMPL 头部 mesh
   * @returns           FLAME 参数 + 面部纹理贴图
   */
  estimateFace(
    images: PipelineImage[],
    smplMesh: MeshData
  ): Promise<{
    flameParams: FLAMEParameters;
    textureMap: TextureMap;
    mesh: MeshData;
  }>;
}

/**
 * 纹理生成 Provider
 *
 * 职责：从多视角照片生成 PBR 纹理贴图
 *
 * 可替换实现：
 *   - PyTorch3DBaker (自研封装, 稳定)
 *   - DreamGaussian (快速)
 *   - nvdiffrec (高精度)
 */
export interface TextureGeneratorProvider {
  readonly name: string;

  /**
   * 生成 PBR 纹理贴图
   * @param mesh         已对齐的 SMPL mesh
   * @param images       多视角照片
   * @param cameraPoses  相机位姿
   * @returns            纹理贴图集合 (BaseColor + Normal + Roughness)
   */
  generate(
    mesh: MeshData,
    images: PipelineImage[],
    cameraPoses: CameraPose[]
  ): Promise<TextureMap[]>;
}

/**
 * 几何细节生成 Provider
 *
 * 职责：从照片生成高精度几何细节（衣服褶皱、肌肉线条）
 *
 * 可替换实现：
 *   - PIFuHDProvider (经典, 单张照片)
 *   - ECONProvider (SMPL 引导, 精度高)
 *   - InstantAvatarProvider (NeRF, 需要视频)
 *   - GaussianAvatarProvider (3DGS, 前沿)
 */
export interface MeshDetailProvider {
  readonly name: string;

  /**
   * 生成高精度网格
   * @param images      多视角图像
   * @param smpl        SMPL 拟合结果 (base mesh)
   * @param masks       对应掩码
   * @returns           高精度网格 + 法线贴图
   */
  generate(
    images: PipelineImage[],
    smpl: SMPLResult,
    masks: SegmentationMask[]
  ): Promise<{
    mesh: MeshData;
    normals?: TextureMap;
  }>;
}

/**
 * 发型生成 Provider
 *
 * 可替换实现：
 *   - PresetHairProvider (先用预设库)
 *   - NeuralHaircutProvider (发丝级精度)
 *   - H3DNetProvider (体积感好)
 */
export interface HairGeneratorProvider {
  readonly name: string;

  /**
   * 从多视角照片生成发型几何
   * @param images  含头部的照片
   * @param headMesh 已重建的头部 mesh
   * @returns       发型 mesh
   */
  generate(
    images: PipelineImage[],
    headMesh: MeshData
  ): Promise<MeshData>;
}


// ── Avatar 完整构建结果 ──────────────────────────────────────

/**
 * Avatar 完整构建结果。
 * 这是整个管线的最终输出。
 */
export interface AvatarBuildResult {
  /** Avatar 唯一标识 */
  avatarId: string;

  /** 核心资产 */
  smpl: SMPLParameters;

  /** 面部参数 */
  face: {
    flameParams: FLAMEParameters;
    textureUrl: string;
  };

  /** 发型 ID */
  hairStyleId: string;

  /** 身体纹理 URL (CDN) */
  bodyTextureUrl: string;

  /** 详细网格 (可选, 可从 β 重建) */
  detailMesh?: MeshData;

  /** 使用的方法 */
  method: string;

  /** 各 Provider 名称 */
  providers?: {
    segmentation?: string;
    pose?: string;
    bodyEstimator?: string;
    face?: string;
    texture?: string;
    mesh?: string;
    hair?: string;
  };

  /** 构建耗时 (秒) */
  elapsedSeconds: number;

  /** 质量评分 (0-100) */
  qualityScore: number;
}


// ── Avatar Build Pipeline 编排器 ────────────────────────────

/**
 * Pipeline 编排器接口。
 *
 * 负责按顺序调用各 Provider，组装最终 Avatar。
 */
export interface AvatarPipelineOrchestrator {
  /**
   * 编排一次完整的 Avatar 构建
   * @param images  采集到的多视角图像
   * @param measurements 身体测量值
   * @returns 完整的 Avatar 构建结果
   */
  build(
    images: PipelineImage[],
    measurements: BodyMeasurements
  ): Promise<AvatarBuildResult>;

  /** 获取当前编排器配置的 Provider 列表 */
  getProviders(): {
    segmentation?: string;
    pose?: string;
    bodyEstimator?: string;
    face?: string;
    texture?: string;
    mesh?: string;
    hair?: string;
  };
}
