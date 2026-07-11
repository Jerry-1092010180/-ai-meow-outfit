import type {
  BodyMeasurements,
  BodyModelManifest,
  BodyModelRequest,
  CaptureFrame,
} from '@/types/bodyModel';

const PIPELINE_STEPS = [
  'paper-measurement-normalization',
  'guided-360-frame-alignment',
  'silhouette-and-pose-estimation',
  'parametric-avatar-fitting',
  'garment-try-on-ready-glb-export',
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function estimateBodyModelQuality(
  measurements: BodyMeasurements,
  frames: CaptureFrame[]
) {
  const measurementScore =
    45 +
    (measurements.shoulderCm ? 8 : 0) +
    (measurements.waistCm ? 8 : 0) +
    (measurements.hipCm ? 8 : 0) +
    (measurements.inseamCm ? 6 : 0);
  const frameScore = frames.length >= 12 ? 25 : frames.length * 2;
  const averageFrameQuality =
    frames.length > 0
      ? frames.reduce((sum, frame) => sum + frame.qualityScore, 0) /
        frames.length
      : 0;

  return Math.round(
    clamp(measurementScore + frameScore + averageFrameQuality * 0.15, 0, 100)
  );
}

export function createBodyModelManifest(
  request: BodyModelRequest
): BodyModelManifest {
  const qualityScore = estimateBodyModelQuality(
    request.measurements,
    request.captureFrames
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
      'This manifest is ready to submit to a photogrammetry or neural avatar service. The browser prototype stores captured frames locally and renders a fitted procedural preview.',
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
