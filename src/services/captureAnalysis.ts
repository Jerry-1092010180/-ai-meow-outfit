export type CaptureLightState = 'waiting' | 'turning' | 'ready' | 'captured';

export type CaptureDistance = 'too-close' | 'too-far' | 'good' | 'unknown';

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
  distance: CaptureDistance;
  lightState: CaptureLightState;
  ready: boolean;
  instruction: string;
  detail: string;
}

interface AnalyzeOptions {
  previousFrame: ImageData | null;
  targetAngle: number;
}

const FRONT_BACK_ASPECT = 0.34;
const DIAGONAL_ASPECT = 0.29;
const SIDE_ASPECT = 0.22;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function scoreAround(value: number, target: number, tolerance: number) {
  return clamp(1 - Math.abs(value - target) / tolerance);
}

function frameDifference(a: ImageData | null, b: ImageData | null): number {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return 1;
  const ad = a.data;
  const bd = b.data;
  let diff = 0;
  const step = 8;
  for (let i = 0; i < ad.length; i += step * 4) {
    diff +=
      Math.abs(ad[i] - bd[i]) +
      Math.abs(ad[i + 1] - bd[i + 1]) +
      Math.abs(ad[i + 2] - bd[i + 2]);
  }
  return diff / ((ad.length / (step * 4)) * 3 * 255);
}

function getBorderColor(frame: ImageData) {
  const { width, height, data } = frame;
  const border = Math.max(4, Math.round(Math.min(width, height) * 0.06));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x > border && x < width - border && y > border && y < height - border) continue;
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
  }

  return { r: r / count, g: g / count, b: b / count };
}

function estimatePersonBox(frame: ImageData): { box: CaptureBox | null; maskRatio: number } {
  const { width, height, data } = frame;
  const bg = getBorderColor(frame);
  const saliency = new Float32Array(width * height);
  let sum = 0;
  let sumSq = 0;

  for (let y = 1; y < height; y++) {
    for (let x = 1; x < width; x++) {
      const i = (y * width + x) * 4;
      const left = (y * width + x - 1) * 4;
      const up = ((y - 1) * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const bgDist = (Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b)) / (3 * 255);
      const edge =
        (Math.abs(r - data[left]) +
          Math.abs(g - data[left + 1]) +
          Math.abs(b - data[left + 2]) +
          Math.abs(r - data[up]) +
          Math.abs(g - data[up + 1]) +
          Math.abs(b - data[up + 2])) /
        (6 * 255);
      const centerWeight = 1 - Math.abs(x / width - 0.5) * 1.4;
      const value = clamp(bgDist * 0.72 + edge * 0.2 + clamp(centerWeight) * 0.08);
      saliency[y * width + x] = value;
      sum += value;
      sumSq += value * value;
    }
  }

  const pixels = width * height;
  const mean = sum / pixels;
  const variance = Math.max(0, sumSq / pixels - mean * mean);
  const threshold = Math.max(0.12, mean + Math.sqrt(variance) * 0.3);
  const rowCounts = new Uint16Array(height);
  const colCounts = new Uint16Array(width);
  let maskCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < width * 0.04 || x > width * 0.96 || y < height * 0.01 || y > height * 0.99) continue;
      if (saliency[y * width + x] < threshold) continue;
      rowCounts[y] += 1;
      colCounts[x] += 1;
      maskCount += 1;
    }
  }

  const minRowPixels = Math.max(3, Math.round(width * 0.035));
  const minColPixels = Math.max(4, Math.round(height * 0.035));
  let minY = height;
  let maxY = -1;
  let minX = width;
  let maxX = -1;

  for (let y = 0; y < height; y++) {
    if (rowCounts[y] >= minRowPixels) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  for (let x = 0; x < width; x++) {
    if (colCounts[x] >= minColPixels) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  if (minX >= maxX || minY >= maxY || maskCount / pixels < 0.015) {
    return { box: null, maskRatio: maskCount / pixels };
  }

  return {
    box: {
      x: minX / width,
      y: minY / height,
      width: (maxX - minX + 1) / width,
      height: (maxY - minY + 1) / height,
    },
    maskRatio: maskCount / pixels,
  };
}

function expectedAspectForAngle(angle: number) {
  const normalized = ((angle % 180) + 180) % 180;
  if (normalized <= 18 || normalized >= 162) return FRONT_BACK_ASPECT;
  if (Math.abs(normalized - 90) <= 18) return SIDE_ASPECT;
  return DIAGONAL_ASPECT;
}

function angleLabel(angle: number) {
  const labels: Record<number, string> = {
    0: '正面',
    45: '右前',
    90: '右侧',
    135: '右后',
    180: '背面',
    225: '左后',
    270: '左侧',
    315: '左前',
  };
  return labels[angle] ?? `${angle}°`;
}

export function analyzeCaptureFrame(frame: ImageData, options: AnalyzeOptions): CaptureAnalysis {
  const motionScore = frameDifference(options.previousFrame, frame);
  const { box } = estimatePersonBox(frame);

  if (!box) {
    return {
      box: null,
      motionScore,
      fullBodyScore: 0,
      distanceScore: 0,
      centerScore: 0,
      stabilityScore: 0,
      angleScore: 0,
      qualityScore: 0,
      isFullBody: false,
      isCentered: false,
      isStable: false,
      angleMatched: false,
      distance: 'unknown',
      lightState: motionScore > 0.08 ? 'turning' : 'waiting',
      ready: false,
      instruction: '请站到画面中央，保持头到脚都入镜',
      detail: '未稳定识别到完整人体轮廓',
    };
  }

  const bottom = box.y + box.height;
  const centerX = box.x + box.width / 2;
  const aspect = box.width / Math.max(box.height, 0.01);
  const topScore = box.y > 0.015 && box.y < 0.24 ? 1 : scoreAround(box.y, 0.1, 0.18);
  const bottomScore = bottom > 0.78 && bottom < 0.985 ? 1 : scoreAround(bottom, 0.9, 0.16);
  const widthScore = box.width > 0.16 && box.width < 0.68 ? 1 : scoreAround(box.width, 0.36, 0.24);
  const fullBodyScore = clamp(topScore * 0.35 + bottomScore * 0.45 + widthScore * 0.2);
  const distanceScore = scoreAround(box.height, 0.78, 0.22);
  const centerScore = scoreAround(centerX, 0.5, 0.23);
  const stabilityScore = motionScore < 0.035 ? 1 : motionScore < 0.06 ? 0.65 : motionScore < 0.09 ? 0.25 : 0;
  const angleScore = scoreAround(aspect, expectedAspectForAngle(options.targetAngle), 0.11);

  const distance: CaptureDistance =
    box.height > 0.92 || box.width > 0.72 ? 'too-close' : box.height < 0.56 ? 'too-far' : 'good';
  const isFullBody = fullBodyScore >= 0.72;
  const isCentered = centerScore >= 0.62;
  const isStable = stabilityScore >= 0.75;
  const angleMatched = angleScore >= 0.42;
  const ready =
    isFullBody &&
    isCentered &&
    isStable &&
    angleMatched &&
    distance === 'good';

  const qualityScore = Math.round(
    clamp(
      fullBodyScore * 0.34 +
        distanceScore * 0.18 +
        centerScore * 0.16 +
        stabilityScore * 0.18 +
        angleScore * 0.14
    ) * 100
  );

  let instruction = `转到 ${angleLabel(options.targetAngle)} 后停住`;
  let detail = '正在判断角度和稳定性';
  let lightState: CaptureLightState = motionScore > 0.075 ? 'turning' : 'waiting';

  if (!isFullBody) {
    instruction = box.y >= 0.24 ? '上半身太低，请把手机稍微抬高' : bottom <= 0.78 ? '脚部未入镜，请退后到约2米' : '请保持头到脚都完整入镜';
    detail = `全身完整度 ${Math.round(fullBodyScore * 100)}%`;
  } else if (distance === 'too-close') {
    instruction = '离镜头太近，请后退半步';
    detail = '人体占画面过大，容易裁掉头脚';
  } else if (distance === 'too-far') {
    instruction = '离镜头太远，请向前半步';
    detail = '人体占画面过小，轮廓细节不足';
  } else if (!isCentered) {
    instruction = centerX < 0.5 ? '请向画面右侧挪一点' : '请向画面左侧挪一点';
    detail = `居中度 ${Math.round(centerScore * 100)}%`;
  } else if (!angleMatched) {
    instruction = `继续小幅旋转到 ${angleLabel(options.targetAngle)}`;
    detail = `角度匹配 ${Math.round(angleScore * 100)}%`;
  } else if (!isStable) {
    instruction = '检测到移动，请停住两秒';
    detail = `稳定度 ${Math.round(stabilityScore * 100)}%`;
    lightState = 'turning';
  } else {
    instruction = '角度到位，保持不动';
    detail = `质量 ${qualityScore}分`;
    lightState = 'ready';
  }

  return {
    box,
    motionScore,
    fullBodyScore,
    distanceScore,
    centerScore,
    stabilityScore,
    angleScore,
    qualityScore,
    isFullBody,
    isCentered,
    isStable,
    angleMatched,
    distance,
    lightState,
    ready,
    instruction,
    detail,
  };
}
