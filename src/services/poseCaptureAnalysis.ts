import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export interface PoseBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PoseEvidence {
  detected: boolean;
  box: PoseBox | null;
  confidence: number;
  fullBodyScore: number;
  centerScore: number;
  yawDeg: number | null;
  turnDeltaDeg: number | null;
  angleScore: number;
  angleMatched: boolean;
  detail: string;
}

const REQUIRED_LANDMARKS = [0, 11, 12, 23, 24, 25, 26, 27, 28];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function scoreAround(value: number, target: number, tolerance: number) {
  return clamp(1 - Math.abs(value - target) / tolerance);
}

function circularDelta(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function publicAsset(path: string) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\//, '')}`;
}

export class PoseCaptureAnalyzer {
  private lastCapturedYaw: number | null = null;
  private latestYaw: number | null = null;

  constructor(private readonly landmarker: PoseLandmarker) {}

  analyze(video: HTMLVideoElement, timestampMs: number, targetAngle: number): PoseEvidence {
    const result = this.landmarker.detectForVideo(video, timestampMs);
    const landmarks = result.landmarks?.[0];
    const world = result.worldLandmarks?.[0];
    if (!landmarks || landmarks.length < 29) {
      this.latestYaw = null;
      return {
        detected: false, box: null, confidence: 0, fullBodyScore: 0, centerScore: 0,
        yawDeg: null, turnDeltaDeg: null, angleScore: 0, angleMatched: false, detail: 'pose:none',
      };
    }

    const requiredVisibility = REQUIRED_LANDMARKS.map((index) => landmarks[index]?.visibility ?? 0);
    const confidence = requiredVisibility.reduce((sum, value) => sum + value, 0) / requiredVisibility.length;
    const visible = landmarks.filter((point) => (point.visibility ?? 0) >= 0.35);
    if (visible.length < 12 || confidence < 0.38) {
      return {
        detected: false, box: null, confidence, fullBodyScore: 0, centerScore: 0,
        yawDeg: null, turnDeltaDeg: null, angleScore: 0, angleMatched: false,
        detail: `pose:weak-${Math.round(confidence * 100)}`,
      };
    }

    const nose = landmarks[0];
    const ankles = [landmarks[27], landmarks[28]];
    const minX = Math.min(...visible.map((point) => point.x));
    const maxX = Math.max(...visible.map((point) => point.x));
    const footY = Math.max(...ankles.map((point) => point.y));
    const x = clamp(minX - 0.07);
    const right = clamp(maxX + 0.07);
    const y = clamp(nose.y - 0.08);
    const bottom = clamp(footY + 0.03);
    const box: PoseBox = { x, y, width: right - x, height: bottom - y };

    const headVisible = (nose.visibility ?? 0) >= 0.45 && nose.y > 0.025 && nose.y < 0.28;
    const feetVisible = ankles.every((point) => (point.visibility ?? 0) >= 0.35 && point.y > 0.68 && point.y < 0.985);
    const landmarkVisibilityScore = clamp((confidence - 0.35) / 0.5);
    const framingScore = (headVisible ? 0.5 : 0) + (feetVisible ? 0.5 : 0);
    const fullBodyScore = framingScore * 0.7 + landmarkVisibilityScore * 0.3;
    const centerScore = scoreAround(box.x + box.width / 2, 0.5, 0.3);

    let yawDeg: number | null = null;
    if (world && world.length >= 25) {
      const leftShoulder = world[11];
      const rightShoulder = world[12];
      const leftHip = world[23];
      const rightHip = world[24];
      const dx = ((rightShoulder.x - leftShoulder.x) + (rightHip.x - leftHip.x)) / 2;
      const dz = ((rightShoulder.z - leftShoulder.z) + (rightHip.z - leftHip.z)) / 2;
      if (Math.hypot(dx, dz) > 0.04) yawDeg = (Math.atan2(dz, dx) * 180 / Math.PI + 360) % 360;
    }
    this.latestYaw = yawDeg;

    const turnDeltaDeg = yawDeg !== null && this.lastCapturedYaw !== null
      ? circularDelta(yawDeg, this.lastCapturedYaw)
      : null;
    const isFirstAngle = targetAngle === 0 && this.lastCapturedYaw === null;
    const angleScore = isFirstAngle ? 1 : turnDeltaDeg === null ? 0 : scoreAround(turnDeltaDeg, 45, 35);
    const angleMatched = isFirstAngle || (turnDeltaDeg !== null && turnDeltaDeg >= 22 && turnDeltaDeg <= 72);

    return {
      detected: true, box, confidence, fullBodyScore, centerScore, yawDeg, turnDeltaDeg,
      angleScore, angleMatched,
      detail: `pose:${Math.round(confidence * 100)},turn:${turnDeltaDeg === null ? '--' : Math.round(turnDeltaDeg)}`,
    };
  }

  markCaptured() {
    if (this.latestYaw !== null) this.lastCapturedYaw = this.latestYaw;
  }

  reset() {
    this.lastCapturedYaw = null;
    this.latestYaw = null;
  }

  close() {
    this.landmarker.close();
  }
}

export async function createPoseCaptureAnalyzer(): Promise<PoseCaptureAnalyzer> {
  const wasm = await FilesetResolver.forVisionTasks(publicAsset('vendor/mediapipe/wasm'));
  const landmarker = await PoseLandmarker.createFromOptions(wasm, {
    baseOptions: { modelAssetPath: publicAsset('vendor/mediapipe/models/pose_landmarker_lite.task') },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return new PoseCaptureAnalyzer(landmarker);
}
