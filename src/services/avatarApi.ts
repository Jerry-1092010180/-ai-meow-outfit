/**
 * 真人 3D 重建 API — 对接 AIGC (4090D GPU) 服务器
 * 生产环境指向公网 proxy，开发环境直连 Tailscale IP
 */

import type { BodyModelManifest, CaptureFrame, BodyMeasurements } from '@/types/bodyModel';

// AIGC Tailscale IP → 可通过 Cloudflare Tunnel 代理为公网地址
const AVATAR_API = import.meta.env.DEV
  ? 'http://100.114.7.5:8765'
  : 'https://avatar-api.ai-meow-outfit.workers.dev'; // 替换为实际公网地址

interface ReconstructResult {
  job_id: string;
  status: string;
  elapsed_seconds: number;
  vertices: number;
  faces: number;
  model_url: string;
  preview_url: string;
}

/** 提交真人 3D 重建任务 */
export async function submitReconstruction(
  measurements: BodyMeasurements,
  frames: CaptureFrame[]
): Promise<ReconstructResult> {
  const res = await fetch(`${AVATAR_API}/reconstruct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ measurements, frames }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Server error: ${res.status}`);
  }
  return res.json();
}

/** 获取已生成的模型 GLB 文件 URL */
export function getModelUrl(jobId: string): string {
  return `${AVATAR_API}/models/${jobId}.glb`;
}

/** 获取模型预览图 */
export function getPreviewUrl(jobId: string): string {
  return `${AVATAR_API}/models/${jobId}-preview.png`;
}

/** 检查服务器健康状态 */
export async function checkAvatarHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AVATAR_API}/health`);
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
