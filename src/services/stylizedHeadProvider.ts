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
  const frontBox = primaryFrame.faceBox ?? boxes[0];
  const sideCoverage = Number(frames.some((frame) => frame.poseLabel === 'left')) + Number(frames.some((frame) => frame.poseLabel === 'right'));
  return {
    faceAspectRatio: Number(aspect.toFixed(3)),
    faceWidthRatio: Number(width.toFixed(3)),
    eyeLineEstimateY: Number(clamp(0.36 + (aspect - 1.24) * 0.035, 0.32, 0.42).toFixed(3)),
    mouthLineEstimateY: Number(clamp(0.62 + (aspect - 1.24) * 0.025, 0.58, 0.68).toFixed(3)),
    skinToneHex: primaryFrame.skinToneHex || style.palette.skin,
    eyeDistanceRatio: Number(clamp(0.34 + (width - 0.42) * 0.18, 0.29, 0.4).toFixed(3)),
    noseWidthRatio: Number(clamp(0.13 + (width - 0.42) * 0.08, 0.1, 0.18).toFixed(3)),
    mouthWidthRatio: Number(clamp(0.23 + (frontBox?.width ?? width - 0.42) * 0.1, 0.19, 0.31).toFixed(3)),
    browTilt: Number((sideCoverage > 1 ? 0.02 : 0).toFixed(3)),
    hairlineY: Number(clamp((frontBox?.y ?? 0.1) + 0.03, 0.06, 0.18).toFixed(3)),
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

function drawFeatureEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  rotation = 0
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawComicCurve(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, width: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.stroke();
  ctx.restore();
}

async function createEnhancedStylizedTexture(
  frames: SelfieFrame[],
  primaryFrame: SelfieFrame,
  style: AvatarRenderStyle,
  features: FaceIdentityFeatures
) {
  const img = await loadImage(primaryFrame.imageDataUrl);
  const box = primaryFrame.faceBox ?? { x: 0.25, y: 0.08, width: 0.5, height: 0.66 };
  const cropPadX = 0.2 + (features.poseCoverage.left && features.poseCoverage.right ? 0.04 : 0);
  const cropPadY = 0.2;
  const sourceX = Math.max(0, (box.x - cropPadX) * img.naturalWidth);
  const sourceY = Math.max(0, (box.y - cropPadY) * img.naturalHeight);
  const sourceW = Math.min(img.naturalWidth - sourceX, (box.width + cropPadX * 2) * img.naturalWidth);
  const sourceH = Math.min(img.naturalHeight - sourceY, (box.height + cropPadY * 1.85) * img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 960;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');

  const skin = primaryFrame.skinToneHex || style.palette.skin;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(384, 484, 268 * clamp(features.faceWidthRatio / 0.44, 0.86, 1.18), 360 * clamp(features.faceAspectRatio / 1.28, 0.9, 1.16), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(384, 482, 278, 374, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.filter = 'brightness(1.16) contrast(1.16) saturate(1.18) blur(0.35px)';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  posterize(pixels.data);
  ctx.putImageData(pixels, 0, 0);

  const skinToneHex = averageRegion(ctx, 280, 340, 200, 260, false) || skin;
  const hairToneHex = averageRegion(ctx, 170, 40, 430, 190, true) || style.palette.hair;
  const eyeY = canvas.height * features.eyeLineEstimateY;
  const mouthY = canvas.height * features.mouthLineEstimateY;
  const eyeDx = canvas.width * (features.eyeDistanceRatio ?? 0.34) * 0.5;
  const mouthW = canvas.width * (features.mouthWidthRatio ?? 0.24);

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `${style.palette.accent}20`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = hairToneHex;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.ellipse(384, 210, 280, 150, 0, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(645, 170, 635, 430);
  ctx.quadraticCurveTo(535, 330, 384, 350);
  ctx.quadraticCurveTo(230, 330, 130, 430);
  ctx.quadraticCurveTo(115, 165, 384, 60);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#17141b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(384, 484, 278, 374, 0, 0, Math.PI * 2);
  ctx.stroke();

  drawFeatureEllipse(ctx, 384 - eyeDx, eyeY, 35, 17, '#17141b', -0.08);
  drawFeatureEllipse(ctx, 384 + eyeDx, eyeY, 35, 17, '#17141b', 0.08);
  drawFeatureEllipse(ctx, 384 - eyeDx + 9, eyeY - 4, 7, 5, '#ffffff', 0);
  drawFeatureEllipse(ctx, 384 + eyeDx + 9, eyeY - 4, 7, 5, '#ffffff', 0);
  drawComicCurve(ctx, [[384 - eyeDx - 42, eyeY - 54], [384 - eyeDx, eyeY - 68], [384 - eyeDx + 48, eyeY - 56]], 9, '#3c2118');
  drawComicCurve(ctx, [[384 + eyeDx - 48, eyeY - 56], [384 + eyeDx, eyeY - 68], [384 + eyeDx + 42, eyeY - 54]], 9, '#3c2118');

  ctx.fillStyle = '#8f4b3f';
  ctx.globalAlpha = 0.36;
  ctx.beginPath();
  ctx.ellipse(384, eyeY + 118, canvas.width * (features.noseWidthRatio ?? 0.13) * 0.5, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  drawComicCurve(ctx, [[384 - mouthW * 0.5, mouthY], [384, mouthY + 24], [384 + mouthW * 0.5, mouthY]], 13, '#a84b62');
  drawComicCurve(ctx, [[384 - mouthW * 0.35, mouthY + 8], [384, mouthY + 18], [384 + mouthW * 0.35, mouthY + 8]], 5, '#f4c0ca');

  ctx.save();
  ctx.fillStyle = skinToneHex;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.ellipse(278, mouthY - 76, 46, 24, -0.2, 0, Math.PI * 2);
  ctx.ellipse(490, mouthY - 76, 46, 24, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return {
    textureDataUrl: canvas.toDataURL('image/png'),
    previewDataUrl: canvas.toDataURL('image/png'),
    hairToneHex,
    skinToneHex,
  };
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

export class EnhancedLocalStylizedHeadProvider implements StylizedHeadProvider {
  async generate(identity: AvatarIdentity, style: AvatarRenderStyle): Promise<StylizedHead> {
    const primaryFrame = identity.face.primaryFrame;
    const frames = identity.face.sourceFrames.length > 0 ? identity.face.sourceFrames : [primaryFrame];
    const baseFeatures = extractFeatures(frames, primaryFrame, style);
    const { textureDataUrl, previewDataUrl, hairToneHex, skinToneHex } = await createEnhancedStylizedTexture(
      frames,
      primaryFrame,
      style,
      baseFeatures
    );
    const features = {
      ...baseFeatures,
      skinToneHex,
      hairToneHex,
    };

    const coverage = {
      ...features.poseCoverage,
      score: Object.values(features.poseCoverage).filter(Boolean).length / 5,
    };
    const confidence = clamp(identity.face.confidence * 0.55 + coverage.score * 0.35 + (textureDataUrl ? 0.1 : 0));
    const faceAspect = features.faceAspectRatio;
    const fallbackReason = coverage.score < 0.6
      ? 'insufficient-multiview-coverage-enhanced-local-used'
      : undefined;

    return {
      id: `enhanced-head-${Date.now().toString(36)}`,
      providerStage: 'enhanced-local',
      representation: 'stylized-face-texture+head-fit-params',
      textureDataUrl,
      previewDataUrl,
      sourceFrameCount: frames.length,
      confidence,
      identityFeatures: features,
      multiViewCoverage: coverage,
      fallbackReason,
      headFit: {
        facePlaneScale: clamp(1.11 + (features.faceWidthRatio - 0.44) * 1.08, 0.9, 1.3),
        verticalOffset: clamp((faceAspect - 1.28) * 0.11, -0.07, 0.07),
        headWidthScale: clamp(1 + (features.faceWidthRatio - 0.44) * 0.72, 0.88, 1.18),
        headHeightScale: clamp(1 + (faceAspect - 1.26) * 0.16, 0.9, 1.18),
        hairVolume: clamp(1.05 + coverage.score * 0.11 + (features.hairlineY ? (0.14 - features.hairlineY) * 0.3 : 0), 1, 1.24),
      },
      style,
      notes: [
        'enhanced-local-provider',
        'uses-front-frame-as-identity-anchor',
        'aggregates-left-right-up-down-coverage',
        'preserves-skin-hair-eye-mouth-brow-proportions-with-comic-overlay',
        'not-a-neural-3d-head-reconstruction',
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

export const stylizedHeadProvider = new EnhancedLocalStylizedHeadProvider();
