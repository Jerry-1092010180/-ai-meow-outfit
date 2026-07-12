/**
 * 真人 3D 重建 API — 对接 AIGC (4090D GPU) 服务器
 */

import type { BodyMeasurements, CaptureFrame } from '@/types/bodyModel';

// AIGC Tailscale IP ← 通过 Cloudflare Tunnel 代理时替换为此处
const AVATAR_API = 'http://100.114.7.5:8765';

interface ReconstructResult {
  job_id: string;
  status: string;
  elapsed_seconds: number;
  vertices: number;
  faces: number;
  model_url: string;
  method: string;
  frame_count: number;
}

/** 提交参数化人体建模任务 */
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
    throw new Error(`Server error: ${res.status}`);
  }
  return res.json();
}

/** 获取已生成的模型下载 URL */
export function getModelUrl(jobId: string): string {
  return `${AVATAR_API}/models/${jobId}.glb`;
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
