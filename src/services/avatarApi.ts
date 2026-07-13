/**
 * 真人 3D 重建 API — 对接 AIGC (4090D GPU) 服务器
 */

import type { BodyMeasurements, CaptureFrame } from '@/types/bodyModel';

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
}

/** 提交参数化人体建模任务 */
export async function submitReconstruction(
  measurements: BodyMeasurements,
  frames: CaptureFrame[]
): Promise<ReconstructResult> {
  // Compress frames before upload (large base64 strings can hit size limits)
  const compressedFrames = frames.map(f => ({
    ...f,
    imageDataUrl: compressImageDataUrl(f.imageDataUrl, 512, 0.7),
  }));

  const res = await fetch(`${AVATAR_API}/reconstruct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ measurements, frames: compressedFrames }),
  });
  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }
  return res.json();
}

/** Compress a base64 image to reduce upload size */
function compressImageDataUrl(dataUrl: string, maxDim: number, quality: number): string {
  // Quick compression: decode → resize → re-encode synchronously
  try {
    const canvas = document.createElement('canvas');
    const img = new Image();
    // Read sync — image is already in browser cache from capture
    img.src = dataUrl;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1280, img.naturalHeight || 720));
    canvas.width = Math.round((img.naturalWidth || 1280) * scale);
    canvas.height = Math.round((img.naturalHeight || 720) * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
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

/** 根据身型匹配预置 GLB 模型路径 */
export function getPresetModelPath(bodyType: string): string {
  const validTypes = ['hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle'];
  const bt = validTypes.includes(bodyType) ? bodyType : 'hourglass';
  return `/models/body-${bt}.glb`;
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
