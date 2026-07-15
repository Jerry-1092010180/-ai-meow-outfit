export interface VisionFileset {}

export interface PosePoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseLandmarkerResult {
  landmarks: PosePoint[][];
  worldLandmarks: PosePoint[][];
}

export interface PoseLandmarkerOptions {
  baseOptions: { modelAssetPath: string };
  runningMode: 'VIDEO';
  numPoses: number;
  minPoseDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackingConfidence: number;
}

export class FilesetResolver {
  static forVisionTasks(basePath: string): Promise<VisionFileset>;
}

export class PoseLandmarker {
  static createFromOptions(fileset: VisionFileset, options: PoseLandmarkerOptions): Promise<PoseLandmarker>;
  detectForVideo(video: HTMLVideoElement, timestampMs: number): PoseLandmarkerResult;
  close(): void;
}
