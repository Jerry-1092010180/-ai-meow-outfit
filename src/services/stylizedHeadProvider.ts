import type { SelfieFrame } from '@/types/bodyModel';
import type {
  AvatarIdentity,
  AvatarRenderStyle,
  FaceIdentityFeatures,
  StylizedHead,
  StylizedHeadProvider,
} from '@/types/avatarSystem';

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Stylized head source image decode failed'));
    img.src = dataUrl;
  });
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (v: number) => Math.round(clamp(v / 255) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function averageRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, preferDark = false) {
  const image = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < image.data.length; i += 16) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (!preferDark || lum < 118) {
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }
  if (rs.length < 8) return undefined;
  return rgbToHex(median(rs), median(gs), median(bs));
}

function extractFeatures(frames: SelfieFrame[], primaryFrame: SelfieFrame, style: AvatarRenderStyle): FaceIdentityFeatures {
  const boxes = frames.map((frame) => frame.faceBox).filter(Boolean) as NonNullable<SelfieFrame['faceBox']>[];
  const aspect = boxes.length ? median(boxes.map((box) => box.height / Math.max(box.width, 0.01))) : 1.25;
  const width = boxes.length ? median(boxes.map((box) => box.width)) : 0.44;
  return {
    faceAspectRatio: Number(aspect.toFixed(3)),
    faceWidthRatio: Number(width.toFixed(3)),
    eyeLineEstimateY: 0.38,
    mouthLineEstimateY: 0.62,
    skinToneHex: primaryFrame.skinToneHex || style.palette.skin,
    poseCoverage: {
      front: frames.some((frame) => frame.poseLabel === 'front'),
      left: frames.some((frame) => frame.poseLabel === 'left'),
      right: frames.some((frame) => frame.poseLabel === 'right'),
      up: frames.some((frame) => frame.poseLabel === 'up'),
      down: frames.some((frame) => frame.poseLabel === 'down'),
    },
  };
}

function posterize(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / 32) * 32;
    data[i + 1] = Math.round(data[i + 1] / 32) * 32;
    data[i + 2] = Math.round(data[i + 2] / 32) * 32;
  }
}

async function createStylizedTexture(primaryFrame: SelfieFrame, style: AvatarRenderStyle) {
  const img = await loadImage(primaryFrame.imageDataUrl);
  const box = primaryFrame.faceBox ?? { x: 0.25, y: 0.08, width: 0.5, height: 0.66 };
  const sourceX = Math.max(0, (box.x - 0.14) * img.naturalWidth);
  const sourceY = Math.max(0, (box.y - 0.18) * img.naturalHeight);
  const sourceW = Math.min(img.naturalWidth - sourceX, (box.width + 0.28) * img.naturalWidth);
  const sourceH = Math.min(img.naturalHeight - sourceY, (box.height + 0.28) * img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(256, 320, 218, 300, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.filter = 'brightness(1.08) contrast(1.1) saturate(1.08)';
  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  posterize(pixels.data);
  ctx.putImageData(pixels, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `${style.palette.accent}18`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.strokeStyle = '#18151c';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(256, 320, 218, 300, 0, 0, Math.PI * 2);
  ctx.stroke();

  const hairToneHex = averageRegion(ctx, 90, 18, 332, 140, true);
  const textureDataUrl = canvas.toDataURL('image/png');
  return { textureDataUrl, previewDataUrl: textureDataUrl, hairToneHex };
}

export class LocalExperimentalStylizedHeadProvider implements StylizedHeadProvider {
  async generate(identity: AvatarIdentity, style: AvatarRenderStyle): Promise<StylizedHead> {
    const primaryFrame = identity.face.primaryFrame;
    const frames = identity.face.sourceFrames.length > 0 ? identity.face.sourceFrames : [primaryFrame];
    const { textureDataUrl, previewDataUrl, hairToneHex } = await createStylizedTexture(primaryFrame, style);
    const features = {
      ...extractFeatures(frames, primaryFrame, style),
      hairToneHex: hairToneHex || style.palette.hair,
    };

    const poseScore = Object.values(features.poseCoverage).filter(Boolean).length / 5;
    const confidence = clamp(identity.face.confidence * 0.72 + poseScore * 0.28);
    const faceAspect = features.faceAspectRatio;

    return {
      id: `head-${Date.now().toString(36)}`,
      providerStage: 'local-experimental',
      representation: 'stylized-face-texture+head-fit-params',
      textureDataUrl,
      previewDataUrl,
      sourceFrameCount: frames.length,
      confidence,
      identityFeatures: features,
      headFit: {
        facePlaneScale: clamp(1.08 + (features.faceWidthRatio - 0.44) * 0.9, 0.9, 1.25),
        verticalOffset: clamp((faceAspect - 1.28) * 0.08, -0.06, 0.06),
        headWidthScale: clamp(1 + (features.faceWidthRatio - 0.44) * 0.5, 0.9, 1.14),
        headHeightScale: clamp(1 + (faceAspect - 1.26) * 0.12, 0.92, 1.14),
        hairVolume: clamp(1.02 + (features.poseCoverage.left && features.poseCoverage.right ? 0.08 : 0), 1, 1.18),
      },
      style,
      notes: [
        'local-experimental-provider',
        'uses-primary-face-texture-with-comic-posterization',
        'aggregates-face-box-and-pose-coverage',
        'not-a-final-industrial-3d-head-model',
      ],
    };
  }
}

export class FutureAigcStylizedHeadProvider implements StylizedHeadProvider {
  async generate(): Promise<StylizedHead> {
    throw new Error('FutureAigcStylizedHeadProvider is not connected yet');
  }
}

export class MockStylizedHeadProvider implements StylizedHeadProvider {
  async generate(identity: AvatarIdentity, style: AvatarRenderStyle): Promise<StylizedHead> {
    const features = extractFeatures(identity.face.sourceFrames, identity.face.primaryFrame, style);
    return {
      id: `mock-head-${Date.now().toString(36)}`,
      providerStage: 'mock-placeholder',
      representation: 'head-parameters-only',
      sourceFrameCount: identity.face.sourceFrames.length,
      confidence: 0.2,
      identityFeatures: features,
      headFit: {
        facePlaneScale: 1,
        verticalOffset: 0,
        headWidthScale: 1,
        headHeightScale: 1,
        hairVolume: 1,
      },
      style,
      notes: ['mock-only-no-personalized-texture'],
    };
  }
}

export const stylizedHeadProvider = new LocalExperimentalStylizedHeadProvider();
