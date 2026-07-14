import type {
  BodyMeasurements,
  BodyModelManifest,
  BodyModelRequest,
  CaptureFrame,
  SelfieFrame,
} from '@/types/bodyModel';

const PIPELINE_STEPS = [
  'guided-head-scan-frame-selection',
  'anime-face-beautification',
  'stylized-character-generation',
  'face-hair-body-fusion',
  'pose-and-try-on-ready-glb-export',
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function estimateBodyModelQuality(
  measurements: BodyMeasurements,
  frames: CaptureFrame[],
  selfieFrame?: SelfieFrame
) {
  const measurementScore =
    42 +
    (measurements.headCm ? 5 : 0) +
    (measurements.shoulderCm ? 8 : 0) +
    (measurements.bustCm ? 8 : 0) +
    (measurements.waistCm ? 8 : 0) +
    (measurements.hipCm ? 8 : 0) +
    (measurements.armCm ? 5 : 0) +
    (measurements.legCm || measurements.inseamCm ? 6 : 0) +
    (measurements.skinTone ? 4 : 0);
  const selfieScore = selfieFrame ? selfieFrame.qualityScore * 0.35 : 0;
  const frameScore = frames.length >= 12 ? 25 : frames.length * 2;
  const averageFrameQuality =
    frames.length > 0
      ? frames.reduce((sum, frame) => sum + frame.qualityScore, 0) /
        frames.length
      : 0;

  return Math.round(
    clamp(measurementScore + selfieScore + frameScore + averageFrameQuality * 0.08, 0, 100)
  );
}

export function createBodyModelManifest(
  request: BodyModelRequest
): BodyModelManifest {
  const qualityScore = estimateBodyModelQuality(
    request.measurements,
    request.captureFrames,
    request.selfieFrame
  );
  const id = `ym-avatar-${Date.now().toString(36)}`;

  return {
    id,
    status: qualityScore >= 80 ? 'ready' : 'processing',
    measurements: request.measurements,
    captureFrameCount: request.captureFrames.length,
    qualityScore,
    pipeline: PIPELINE_STEPS,
    output: {
      format: 'glb',
      fileName: `${id}.glb`,
      previewFileName: `${id}-preview.webp`,
      yintaiAppScene: 'miaojie-outfit-3d-try-on',
    },
    createdAt: request.createdAt,
    note:
      'Anime avatar request: guided head-scan frames drive a beautified recognizable manga-style character, with optional style measurements only used as light preferences.',
  };
}

export function downloadBodyModelManifest(manifest: BodyModelManifest) {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${manifest.id}-manifest.json`;
  link.click();
  URL.revokeObjectURL(url);
}
