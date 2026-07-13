/**
 * 智能采集分析器
 */

export type CaptureLightState = 'waiting' | 'turning' | 'ready' | 'captured';

export interface CaptureBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureAnalysis {
  box: CaptureBox | null;
  motionScore: number;
  fullBodyScore: number;
  distanceScore: number;
  centerScore: number;
  stabilityScore: number;
  angleScore: number;
  qualityScore: number;
  isFullBody: boolean;
  isCentered: boolean;
  isStable: boolean;
  angleMatched: boolean;
  distance: 'too-close' | 'too-far' | 'good' | 'unknown';
  lightState: CaptureLightState;
  ready: boolean;
  instruction: string;
  detail: string;
}

interface AnalyzeOptions {
  previousFrame: ImageData | null;
  targetAngle: number;
}

function clamp(v: number, min = 0, max = 1) { return Math.min(Math.max(v, min), max); }
function scoreAround(v: number, t: number, tol: number) { return clamp(1 - Math.abs(v - t) / tol); }

const ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const ANGLE_LABELS: Record<number, string> = {
  0: '正面', 45: '右前', 90: '右侧', 135: '右后',
  180: '背面', 225: '左后', 270: '左侧', 315: '左前',
};

// ── frame difference ──
function frameDiff(a: ImageData | null, b: ImageData | null): number {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return 1;
  const ad = a.data, bd = b.data;
  let diff = 0, count = 0;
  for (let i = 0; i < ad.length; i += 32) {
    diff += Math.abs(ad[i] - bd[i]) + Math.abs(ad[i+1] - bd[i+1]) + Math.abs(ad[i+2] - bd[i+2]);
    count += 3;
  }
  return diff / (count * 255);
}

// ── centroid-based person box (simpler + more robust than saliency) ──
function findBodyBox(frame: ImageData): { box: CaptureBox | null; skinPct: number } {
  const { width, height, data } = frame;
  // Sample a grid to find skin/non-background pixels
  // Background is estimated from border pixels
  let borderR = 0, borderG = 0, borderB = 0, borderN = 0;
  const step = 3;
  for (let x = 0; x < width; x += step) {
    const i = x * 4; borderR += data[i]; borderG += data[i+1]; borderB += data[i+2]; borderN++;
    const j = ((height-1)*width + x) * 4; borderR += data[j]; borderG += data[j+1]; borderB += data[j+2]; borderN++;
  }
  for (let y = 0; y < height; y += step) {
    const i = (y*width) * 4; borderR += data[i]; borderG += data[i+1]; borderB += data[i+2]; borderN++;
    const j = (y*width + width - 1) * 4; borderR += data[j]; borderG += data[j+1]; borderB += data[j+2]; borderN++;
  }
  const bgR = borderR / borderN, bgG = borderG / borderN, bgB = borderB / borderN;

  // Classify each sampled pixel as foreground or background
  const fgX: number[] = [], fgY: number[] = [];
  const tolerance = 50; // How different from border to be "person"

  for (let y = 0; y < height; y += 6) {
    for (let x = 0; x < width; x += 6) {
      const i = (y * width + x) * 4;
      const dr = Math.abs(data[i] - bgR), dg = Math.abs(data[i+1] - bgG), db = Math.abs(data[i+2] - bgB);
      if (dr + dg + db > tolerance * 3) {
        fgX.push(x); fgY.push(y);
      }
    }
  }

  const totalSamples = Math.floor(width/6) * Math.floor(height/6);
  const skinPct = fgX.length / Math.max(totalSamples, 1);

  if (fgX.length < 40 || skinPct < 0.02) return { box: null, skinPct };

  // Sort and trim outliers (top/bottom 5%)
  const sortedX = fgX.slice().sort((a,b)=>a-b);
  const sortedY = fgY.slice().sort((a,b)=>a-b);
  const trim = Math.floor(fgX.length * 0.05);
  const minX = sortedX[trim] / width;
  const maxX = sortedX[sortedX.length - 1 - trim] / width;
  const minY = sortedY[trim] / height;
  const maxY = sortedY[sortedY.length - 1 - trim] / height;

  if (maxX <= minX || maxY <= minY) return { box: null, skinPct };

  return {
    box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    skinPct,
  };
}

// ── main analysis ──
export function analyzeCaptureFrame(frame: ImageData, opts: AnalyzeOptions): CaptureAnalysis {
  const motionScore = frameDiff(opts.previousFrame, frame);
  const { box, skinPct } = findBodyBox(frame);

  if (!box || box.width < 0.06 || box.height < 0.12) {
    return empty(motionScore, '请站到画面中央，保持头到脚都入镜', `轮廓占比 ${Math.round(skinPct*100)}%`);
  }

  const bottom = box.y + box.height;
  const centerX = box.x + box.width / 2;
  const aspect = box.width / Math.max(box.height, 0.001);

  // Simple scores
  const fullBodyScore = clamp(
    (box.y < 0.2 ? 0.35 : scoreAround(box.y, 0.08, 0.18) * 0.35) +
    (bottom > 0.75 ? 0.45 : scoreAround(bottom, 0.92, 0.2) * 0.45) +
    (box.width > 0.15 ? 0.2 : scoreAround(box.width, 0.35, 0.25) * 0.2)
  );
  const distanceScore = scoreAround(box.height, 0.75, 0.3);
  const centerScore = scoreAround(centerX, 0.5, 0.3);
  const stabilityScore = motionScore < 0.04 ? 1 : motionScore < 0.08 ? 0.6 : motionScore < 0.14 ? 0.25 : 0;
  const angleScore = scoreAround(aspect, aspectForAngle(opts.targetAngle), 0.15);

  const dist: CaptureAnalysis['distance'] =
    box.height > 0.93 || box.width > 0.85 ? 'too-close' : box.height < 0.3 ? 'too-far' : 'good';
  // SKIN PCT override: if skinPct is reasonable, body is definitely in frame
  const isFullBody = skinPct > 0.03 || fullBodyScore >= 0.4;
  const isCentered = centerScore >= 0.3;
  const isStable = skinPct > 0.03 || stabilityScore >= 0.5;
  const angleMatched = angleScore >= 0.15;

  // Ready: 3 of 4, plus not too-close
  const checks = [isFullBody, isCentered, isStable, angleMatched];
  const passCount = checks.filter(Boolean).length;
  const ready = passCount >= 3 && dist !== 'too-close';

  const qualityScore = Math.round(clamp(
    fullBodyScore*0.34 + distanceScore*0.18 + centerScore*0.16 + stabilityScore*0.18 + angleScore*0.14
  ) * 100);

  const motion = motionScore > 0.1 ? 'turning' : motionScore > 0.05 ? 'waiting' : 'waiting';
  const lightState: CaptureLightState = ready ? 'ready' : motion;

  let instruction = `转到 ${ANGLE_LABELS[opts.targetAngle] || opts.targetAngle+'°'} 后停住`;
  let detail = `轮廓${Math.round(skinPct*100)}% 运动${Math.round(motionScore*100)}%`;

  if (!isFullBody) {
    instruction = box.y > 0.2 ? '手机请稍微抬高，拍到头顶' : bottom < 0.75 ? '请退后，脚没入镜' : '确保头到脚完整入镜';
    detail = `全身分 ${Math.round(fullBodyScore*100)}% 轮廓${Math.round(skinPct*100)}%`;
  } else if (dist === 'too-close') {
    instruction = '太近了，后退半步';
  } else if (dist === 'too-far') {
    instruction = '太远了，向前半步';
  } else if (!isCentered) {
    instruction = centerX < 0.5 ? '向画面右侧挪一点' : '向画面左侧挪一点';
  } else if (!isStable) {
    instruction = '请停住别动';
    detail = `稳定 ${Math.round(stabilityScore*100)}%`;
  } else if (ready) {
    instruction = '✅ 保持不动';
    detail = `质量${qualityScore}分`;
  }

  return { box, motionScore, fullBodyScore, distanceScore, centerScore, stabilityScore, angleScore, qualityScore,
    isFullBody, isCentered, isStable, angleMatched, distance: dist, lightState, ready, instruction, detail };
}

function aspectForAngle(a: number): number {
  const n = ((a % 180) + 180) % 180;
  if (n <= 15 || n >= 165) return 0.34;
  if (Math.abs(n - 90) <= 15) return 0.22;
  return 0.28;
}

function empty(motion: number, msg: string, detail: string): CaptureAnalysis {
  return {
    box: null, motionScore: motion, fullBodyScore: 0, distanceScore: 0, centerScore: 0,
    stabilityScore: 0, angleScore: 0, qualityScore: 0, isFullBody: false, isCentered: false,
    isStable: false, angleMatched: false, distance: 'unknown', lightState: 'waiting',
    ready: false, instruction: msg, detail,
  };
}
