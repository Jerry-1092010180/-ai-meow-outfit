import type { SelfieFrame } from '@/types/bodyModel';
import type {
  AvatarIdentity,
  AvatarRenderStyle,
  FaceIdentityFeatures,
  StylizedHead,
  StylizedHeadProvider,
} from '@/types/avatarSystem';

export const REQUIRED_HEAD_SCAN_POSES = ['front', 'left', 'right', 'up', 'down'] as const;

export type HeadScanPoseLabel = (typeof REQUIRED_HEAD_SCAN_POSES)[number];

export interface HeadScanCaptureValidation {
  ok: boolean;
  missingPoses: HeadScanPoseLabel[];
  duplicatePoses: HeadScanPoseLabel[];
  lowQualityPoses: HeadScanPoseLabel[];
  errors: string[];
}

export interface NeuralHeadTrainingSummary {
  backend: 'nerfacto-face-prior' | 'splatfacto-face-prior' | 'fdnerf-future';
  gpuName: string;
  iterations: number;
  elapsedSeconds: number;
  photometricLoss: number | null;
  identityLoss: number;
  geometryPriorLoss: number | null;
  multiviewConsistencyLoss: number | null;
  styleLoss: number | null;
}

export interface StylizedHeadValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  identityScore: number;
  styleScore: number;
  geometryScore: number;
  multiviewCoverageScore: number;
  textureOrientationScore: number;
}

export type NerfStylizedHeadJobStage =
  | 'queued'
  | 'preprocessing'
  | 'camera-solving'
  | 'face-prior-fitting'
  | 'identity-encoding'
  | 'geometry-training'
  | 'anime-reference-generation'
  | 'style-distillation'
  | 'mesh-extraction'
  | 'texture-baking'
  | 'validation'
  | 'publishing'
  | 'succeeded'
  | 'failed';

export interface NerfStylizedHeadProviderOptions {
  /** API Gateway base URL. Never point the browser at the private AIGC host. */
  endpoint: string;
  backend: NeuralHeadTrainingSummary['backend'];
  pollIntervalMs: number;
  timeoutMs: number;
  minCaptureQuality: number;
  minIdentityScore: number;
  minStyleScore: number;
  minGeometryScore: number;
  onProgress?: (job: NerfStylizedHeadJob) => void;
}

export interface CreateNerfStylizedHeadJobRequest {
  identityId: string;
  renderStyle: AvatarRenderStyle;
  frames: Array<{
    id: string;
    poseLabel: HeadScanPoseLabel;
    imageDataUrl: string;
    width?: number;
    height?: number;
    mirrored: boolean;
    qualityScore: number;
    faceBox?: SelfieFrame['faceBox'];
  }>;
  training: {
    backend: NeuralHeadTrainingSummary['backend'];
    geometryMode: 'original-rgb-with-face-prior';
    stylizationMode: 'canonical-reference-3d-distillation';
    outputFormat: 'glb';
    geometryIterations: number;
    styleIterations: number;
  };
}

export interface NerfStylizedHeadJobResult {
  providerStage: 'nerf-aigc-provider' | 'gaussian-splat-aigc-provider';
  representation: 'neural-field+mesh+texture';
  meshUrl: string;
  neuralFieldUrl: string;
  canonicalTextureUrl: string;
  previewUrl: string;
  reportUrl?: string;
  animeReferenceUrl?: string;
  sourceFrameCount: number;
  confidence: number;
  identityFeatures: FaceIdentityFeatures;
  multiViewCoverage: Record<HeadScanPoseLabel, boolean> & { score: number };
  trainingSummary: NeuralHeadTrainingSummary;
  validation: StylizedHeadValidation;
  fallbackReason?: string;
}

export interface NerfStylizedHeadJob {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  stage: NerfStylizedHeadJobStage;
  progress: number;
  failureReason?: string;
  validationErrors?: string[];
  result?: NerfStylizedHeadJobResult;
}

export class InvalidHeadScanError extends Error {
  constructor(readonly validation: HeadScanCaptureValidation) {
    super(`Invalid five-view head scan: ${validation.errors.join(', ')}`);
    this.name = 'InvalidHeadScanError';
  }
}

export class NerfStylizedHeadJobError extends Error {
  constructor(readonly job: NerfStylizedHeadJob) {
    super(job.failureReason || `NeRF stylized head job failed at ${job.stage}`);
    this.name = 'NerfStylizedHeadJobError';
  }
}

/** Validate the exact five guided poses before consuming GPU time. */
export function validateFiveViewCapture(
  frames: SelfieFrame[],
  minCaptureQuality = 0.55
): HeadScanCaptureValidation {
  const counts = new Map<HeadScanPoseLabel, number>();
  const lowQualityPoses: HeadScanPoseLabel[] = [];

  for (const frame of frames) {
    if (!frame.poseLabel || !REQUIRED_HEAD_SCAN_POSES.includes(frame.poseLabel)) continue;
    counts.set(frame.poseLabel, (counts.get(frame.poseLabel) ?? 0) + 1);
    const normalizedQuality = frame.qualityScore > 1 ? frame.qualityScore / 100 : frame.qualityScore;
    if (normalizedQuality < minCaptureQuality) lowQualityPoses.push(frame.poseLabel);
  }

  const missingPoses = REQUIRED_HEAD_SCAN_POSES.filter((pose) => !counts.has(pose));
  const duplicatePoses = REQUIRED_HEAD_SCAN_POSES.filter((pose) => (counts.get(pose) ?? 0) > 1);
  const errors: string[] = [];
  if (missingPoses.length) errors.push(`missing_poses:${missingPoses.join('|')}`);
  if (duplicatePoses.length) errors.push(`duplicate_poses:${duplicatePoses.join('|')}`);
  if (lowQualityPoses.length) errors.push(`low_quality_poses:${[...new Set(lowQualityPoses)].join('|')}`);

  return {
    ok: errors.length === 0 && frames.length === REQUIRED_HEAD_SCAN_POSES.length,
    missingPoses,
    duplicatePoses,
    lowQualityPoses: [...new Set(lowQualityPoses)],
    errors,
  };
}

export function createNerfStylizedHeadJobRequest(
  identity: AvatarIdentity,
  style: AvatarRenderStyle,
  options: NerfStylizedHeadProviderOptions
): CreateNerfStylizedHeadJobRequest {
  return {
    identityId: identity.id,
    renderStyle: style,
    frames: identity.face.sourceFrames.map((frame) => ({
      id: `${frame.poseLabel}-${frame.capturedAt}`,
      poseLabel: frame.poseLabel as HeadScanPoseLabel,
      imageDataUrl: frame.imageDataUrl,
      width: frame.imageWidth,
      height: frame.imageHeight,
      // CSS-mirrored previews do not imply mirrored stored pixels.
      mirrored: frame.mirrored ?? false,
      qualityScore: frame.qualityScore,
      faceBox: frame.faceBox,
    })),
    training: {
      backend: options.backend,
      geometryMode: 'original-rgb-with-face-prior',
      stylizationMode: 'canonical-reference-3d-distillation',
      outputFormat: 'glb',
      geometryIterations: 1800,
      styleIterations: 2600,
    },
  };
}

export async function submitNerfStylizedHeadJob(
  request: CreateNerfStylizedHeadJobRequest,
  options: NerfStylizedHeadProviderOptions
): Promise<NerfStylizedHeadJob> {
  const response = await fetch(`${options.endpoint}/stylized-head/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(Math.min(options.timeoutMs, 30_000)),
  });
  if (!response.ok) throw new Error(`Unable to create NeRF head job: HTTP ${response.status}`);
  return response.json() as Promise<NerfStylizedHeadJob>;
}

export async function getNerfStylizedHeadJob(
  jobId: string,
  options: NerfStylizedHeadProviderOptions
): Promise<NerfStylizedHeadJob> {
  const response = await fetch(`${options.endpoint}/stylized-head/jobs/${encodeURIComponent(jobId)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Unable to read NeRF head job: HTTP ${response.status}`);
  return response.json() as Promise<NerfStylizedHeadJob>;
}

export async function waitForNerfStylizedHeadJob(
  initialJob: NerfStylizedHeadJob,
  options: NerfStylizedHeadProviderOptions
): Promise<NerfStylizedHeadJob> {
  const deadline = Date.now() + options.timeoutMs;
  let job = initialJob;
  options.onProgress?.(job);

  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() >= deadline) throw new Error(`NeRF head job timed out: ${job.jobId}`);
    await new Promise((resolve) => window.setTimeout(resolve, options.pollIntervalMs));
    job = await getNerfStylizedHeadJob(job.jobId, options);
    options.onProgress?.(job);
  }

  if (job.status !== 'succeeded' || !job.result) throw new NerfStylizedHeadJobError(job);
  return job;
}

export function validateNerfStylizedHeadResult(
  result: NerfStylizedHeadJobResult,
  options: NerfStylizedHeadProviderOptions
): StylizedHeadValidation {
  const errors = [...result.validation.errors];
  const warnings = [...result.validation.warnings];
  if (!result.meshUrl) errors.push('missing_head_mesh_url');
  if (!result.canonicalTextureUrl) errors.push('missing_canonical_texture_url');
  if (!result.neuralFieldUrl) warnings.push('missing_neural_field_checkpoint_url');
  if (result.identityFeatures.poseCoverage.front !== true) errors.push('front_pose_not_covered');
  if (result.validation.identityScore < options.minIdentityScore) errors.push('identity_score_below_threshold');
  if (result.validation.styleScore < options.minStyleScore) errors.push('style_score_below_threshold');
  if (result.validation.geometryScore < options.minGeometryScore) errors.push('geometry_score_below_threshold');
  if (result.validation.textureOrientationScore < 0.95) errors.push('texture_orientation_invalid');

  return { ...result.validation, ok: errors.length === 0, errors, warnings };
}

export function mapNerfJobResultToStylizedHead(
  result: NerfStylizedHeadJobResult,
  style: AvatarRenderStyle
): StylizedHead {
  return {
    id: `nerf-head-${crypto.randomUUID()}`,
    providerStage: result.providerStage,
    representation: result.representation,
    previewDataUrl: result.previewUrl,
    meshUrl: result.meshUrl,
    neuralFieldUrl: result.neuralFieldUrl,
    canonicalTextureUrl: result.canonicalTextureUrl,
    reportUrl: result.reportUrl,
    animeReferenceUrl: result.animeReferenceUrl,
    sourceFrameCount: result.sourceFrameCount,
    confidence: result.confidence,
    identityFeatures: result.identityFeatures,
    multiViewCoverage: result.multiViewCoverage,
    fallbackReason: result.fallbackReason,
    headFit: {
      facePlaneScale: 0,
      verticalOffset: 0,
      headWidthScale: 1,
      headHeightScale: 1,
      hairVolume: 1,
    },
    style,
    notes: [
      'five-view-face-prior-nerf',
      'canonical-anime-reference-3d-distillation',
      'real-3d-head-mesh-no-face-plane',
    ],
  };
}

export class NerfStylizedHeadProvider implements StylizedHeadProvider {
  constructor(private readonly options: NerfStylizedHeadProviderOptions) {}

  async generate(identity: AvatarIdentity, style: AvatarRenderStyle): Promise<StylizedHead> {
    const captureValidation = validateFiveViewCapture(
      identity.face.sourceFrames,
      this.options.minCaptureQuality
    );
    if (!captureValidation.ok) throw new InvalidHeadScanError(captureValidation);

    const request = createNerfStylizedHeadJobRequest(identity, style, this.options);
    const initialJob = await submitNerfStylizedHeadJob(request, this.options);
    const completedJob = await waitForNerfStylizedHeadJob(initialJob, this.options);
    const result = completedJob.result!;
    const validation = validateNerfStylizedHeadResult(result, this.options);

    // A failed identity or geometry check is a failed job, never a personalized fallback.
    if (!validation.ok) {
      throw new NerfStylizedHeadJobError({
        ...completedJob,
        status: 'failed',
        stage: 'validation',
        failureReason: 'stylized_head_validation_failed',
        validationErrors: validation.errors,
      });
    }

    return mapNerfJobResultToStylizedHead(result, style);
  }
}
