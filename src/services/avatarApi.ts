/**
 * 真人 3D 重建 API — 对接 AIGC (4090D GPU) 服务器
 */

import type { BodyMeasurements, CaptureFrame, SelfieFrame } from '@/types/bodyModel';
import type { AvatarOutfit, AvatarPipelineMode, AvatarRenderStyle, StylizedHead } from '@/types/avatarSystem';

// Routed through API Gateway in production so the AIGC machine stays private.
const AVATAR_API = import.meta.env.VITE_AVATAR_API_BASE_URL || '/api/avatar';

export interface ReconstructResult {
  job_id: string;
  status: string;
  elapsed_seconds: number;
  vertices: number;
  faces: number;
  model_url: string;
  cdn_url?: string;
  method: string;
  frame_count: number;
  face_mode?: string;
  selfie_used?: boolean;
  selfie_frame_count?: number;
  provider_stage?: string;
  rig_ready?: boolean;
  vrm_ready?: boolean;
  pose_presets?: string[];
  expression_blendshapes?: string[];
  animation_clips?: string[];
  bone_count?: number;
  skinned_mesh_count?: number;
  animation_count?: number;
  bone_map?: Record<string, string>;
  rig_validation?: { ok: boolean; errors: string[]; bones: number; skinnedMeshes: number; animations: number };
  rig_format?: string;
  vrm_compatible?: boolean;
}

export interface AvatarGenerationOptions {
  pipeline?: AvatarPipelineMode;
  renderStyle?: AvatarRenderStyle;
  stylizedHead?: StylizedHead;
  outfit?: AvatarOutfit;
  rigTarget?: 'glb-static' | 'glb-rig-ready' | 'vrm-ready';
}

/** 提交 identity-driven stylized avatar 生成任务，底层兼容既有 /reconstruct Gateway。 */
export async function submitReconstruction(
  measurements: BodyMeasurements,
  frames: CaptureFrame[],
  selfieFrame?: SelfieFrame,
  selfieFrames: SelfieFrame[] = [],
  options: AvatarGenerationOptions = {}
): Promise<ReconstructResult> {
  // Compress frames before upload (large base64 strings can hit size limits)
  const compressedFrames = await Promise.all(frames.map(async f => ({
    ...f,
    imageDataUrl: await compressImageDataUrl(f.imageDataUrl, 512, 0.7),
  })));

  const compressedSelfie = selfieFrame
    ? { ...selfieFrame, imageDataUrl: await compressImageDataUrl(selfieFrame.imageDataUrl, 768, 0.82) }
    : undefined;
  const compressedSelfieFrames = await Promise.all(selfieFrames.map(async frame => ({
    ...frame,
    imageDataUrl: await compressImageDataUrl(frame.imageDataUrl, 768, 0.82),
  })));
  const compressedStylizedHead = options.stylizedHead?.textureDataUrl
    ? {
        ...options.stylizedHead,
        textureDataUrl: await compressImageDataUrl(options.stylizedHead.textureDataUrl, 768, 0.9, 'image/png'),
        previewDataUrl: options.stylizedHead.previewDataUrl
          ? await compressImageDataUrl(options.stylizedHead.previewDataUrl, 512, 0.86, 'image/png')
          : undefined,
      }
    : options.stylizedHead;

  console.log('[Avatar] Upload Started endpoint=' + AVATAR_API + ' frames=' + compressedFrames.length + ' selfieFrames=' + compressedSelfieFrames.length);
  const res = await fetch(`${AVATAR_API}/reconstruct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatarPipeline: options.pipeline ?? (compressedSelfieFrames.length > 0 ? 'identity-driven-stylized-avatar' : 'legacy-body-reconstruction'),
      renderStyle: options.renderStyle,
      stylizedHead: compressedStylizedHead,
      outfit: options.outfit,
      rigTarget: options.rigTarget ?? 'glb-rig-ready',
      measurements,
      frames: compressedFrames,
      selfieFrame: compressedSelfie,
      selfieFrames: compressedSelfieFrames,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }
  if (res.ok) console.log('[Avatar] Upload Success HTTP' + res.status);
  else console.warn('[Avatar] Upload FAILED HTTP' + res.status);
  return res.json();
}

/** Compress a base64 image to reduce upload size */
async function compressImageDataUrl(dataUrl: string, maxDim: number, quality: number, mime = 'image/jpeg'): Promise<string> {
  console.log('[Avatar] Compress Image', maxDim + 'px', 'q' + quality);
  try {
    const canvas = document.createElement('canvas');
    const img = new Image();
    await new Promise<void>((resolve,reject)=>{
      img.onload=()=>resolve();
      img.onerror=()=>reject(new Error('Captured image decode failed'));
      img.src=dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mime, quality);
  } catch {
    return dataUrl;
  }
}

/** 获取已生成的模型下载 URL */
export function getModelUrl(jobId: string): string {
  return `${AVATAR_API}/models/${jobId}.glb`;
}

/** Prefer CDN URL returned by the gateway, then absolute model URL, then gateway model route. */
export function getReconstructionModelUrl(result: ReconstructResult): string {
  if (result.cdn_url) return result.cdn_url;
  if (result.model_url?.startsWith('http')) return result.model_url;
  if (result.model_url?.startsWith('/')) return `${AVATAR_API}${result.model_url}`;
  return getModelUrl(result.job_id);
}

/** 根据身型匹配预置 GLB 模型路径 (兼容所有部署平台的 BASE_URL) */
export function getPresetModelPath(bodyType: string): string {
  console.log('[Avatar] Fallback GLB path bodyType=' + bodyType);
  const validTypes = ['hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle'];
  const bt = validTypes.includes(bodyType) ? bodyType : 'hourglass';
  const base = import.meta.env.BASE_URL || '/';
  return `${base}models/body-${bt}.glb`;
}

/** 检查 AIGC 服务器是否可达 */
export async function checkAvatarHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AVATAR_API}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
