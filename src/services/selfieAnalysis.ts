export interface SelfieBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelfieAnalysis {
  ready: boolean;
  qualityScore: number;
  faceScore: number;
  centeredScore: number;
  lightingScore: number;
  sharpnessScore: number;
  faceBox: SelfieBox | null;
  skinToneHex?: string;
  instruction: string;
  detail: string;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

function rgbToYcbcr(r: number, g: number, b: number) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return { y, cb, cr };
}

function isLikelySkin(r: number, g: number, b: number) {
  const { y, cb, cr } = rgbToYcbcr(r, g, b);
  const rgbShape = r > 45 && g > 30 && b > 20 && r > b && r - Math.min(g, b) > 8;
  return y > 45 && y < 245 && cb >= 72 && cb <= 142 && cr >= 128 && cr <= 184 && rgbShape;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function toHex(v: number) {
  return Math.round(clamp(v / 255) * 255).toString(16).padStart(2, '0');
}

function skinToneFromSamples(samples: number[][]) {
  if (samples.length < 12) return undefined;
  const r = median(samples.map((s) => s[0]));
  const g = median(samples.map((s) => s[1]));
  const b = median(samples.map((s) => s[2]));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function sharpnessScore(frame: ImageData) {
  const { width, height, data } = frame;
  let edges = 0;
  let samples = 0;
  for (let y = 2; y < height - 2; y += 4) {
    for (let x = 2; x < width - 2; x += 4) {
      const i = (y * width + x) * 4;
      const right = (y * width + x + 2) * 4;
      const down = ((y + 2) * width + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const lumRight = data[right] * 0.299 + data[right + 1] * 0.587 + data[right + 2] * 0.114;
      const lumDown = data[down] * 0.299 + data[down + 1] * 0.587 + data[down + 2] * 0.114;
      edges += Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
      samples += 1;
    }
  }
  return clamp((edges / Math.max(samples, 1) - 8) / 24);
}

export function analyzeSelfieFrame(frame: ImageData): SelfieAnalysis {
  const { width, height, data } = frame;
  const xs: number[] = [];
  const ys: number[] = [];
  const tones: number[][] = [];
  let brightness = 0;
  let brightnessSamples = 0;

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      brightness += lum;
      brightnessSamples += 1;

      const inFaceSearchZone = x > width * 0.12 && x < width * 0.88 && y > height * 0.08 && y < height * 0.82;
      if (inFaceSearchZone && isLikelySkin(r, g, b)) {
        xs.push(x);
        ys.push(y);
        if (x > width * 0.28 && x < width * 0.72 && y > height * 0.16 && y < height * 0.62) {
          tones.push([r, g, b]);
        }
      }
    }
  }

  const avgBrightness = brightness / Math.max(brightnessSamples, 1);
  const lightingScore = clamp(1 - Math.abs(avgBrightness - 148) / 96);
  const sharp = sharpnessScore(frame);

  if (xs.length < 80) {
    return {
      ready: false,
      qualityScore: Math.round((lightingScore * 0.45 + sharp * 0.55) * 40),
      faceScore: 0,
      centeredScore: 0,
      lightingScore,
      sharpnessScore: sharp,
      faceBox: null,
      instruction: '把脸放进取景框',
      detail: '请面向镜头，露出完整额头、下巴和肩颈',
    };
  }

  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const trim = Math.floor(xs.length * 0.08);
  const minX = xs[trim] / width;
  const maxX = xs[xs.length - 1 - trim] / width;
  const minY = ys[trim] / height;
  const maxY = ys[ys.length - 1 - trim] / height;
  const box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const faceSizeScore = clamp(1 - Math.abs(box.height - 0.42) / 0.24);
  const centeredScore = clamp(1 - (Math.abs(centerX - 0.5) / 0.28 + Math.abs(centerY - 0.38) / 0.28) / 2);
  const faceScore = clamp(faceSizeScore * 0.62 + centeredScore * 0.38);
  const qualityScore = Math.round((faceScore * 0.5 + lightingScore * 0.25 + sharp * 0.25) * 100);
  const ready = qualityScore >= 58 && faceScore >= 0.42 && lightingScore >= 0.28 && sharp >= 0.18;

  let instruction = '保持微笑，马上拍照';
  if (box.height < 0.24) instruction = '靠近一点';
  else if (box.height > 0.68) instruction = '离远一点';
  else if (centeredScore < 0.48) instruction = centerX < 0.5 ? '向右一点' : '向左一点';
  else if (lightingScore < 0.38) instruction = '换到更亮的位置';
  else if (sharp < 0.28) instruction = '手机拿稳';

  return {
    ready,
    qualityScore,
    faceScore,
    centeredScore,
    lightingScore,
    sharpnessScore: sharp,
    faceBox: box,
    skinToneHex: skinToneFromSamples(tones),
    instruction,
    detail: `脸部 ${Math.round(faceScore * 100)} · 光线 ${Math.round(lightingScore * 100)} · 清晰 ${Math.round(sharp * 100)}`,
  };
}
