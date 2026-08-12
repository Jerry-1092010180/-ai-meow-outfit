import type { BodyType } from './user';

export type CaptureAngle =
  | 0
  | 45
  | 90
  | 135
  | 180
  | 225
  | 270
  | 315;

export interface BodyMeasurements {
  heightCm: number;
  weightKg: number;
  bodyType: BodyType;
  headCm?: number;
  shoulderCm?: number;
  bustCm?: number;
  waistCm?: number;
  hipCm?: number;
  armCm?: number;
  legCm?: number;
  inseamCm?: number;
  skinTone?: string;
}

export interface CaptureFrame {
  angle: CaptureAngle;
  imageDataUrl: string;
  capturedAt: string;
  qualityScore: number;
}

export interface SelfieFrame {
  imageDataUrl: string;
  capturedAt: string;
  qualityScore: number;
  /** True only when the stored pixels, rather than the preview, are mirrored. */
  mirrored?: boolean;
  imageWidth?: number;
  imageHeight?: number;
  faceBox?: { x: number; y: number; width: number; height: number };
  skinToneHex?: string;
  source: 'camera-selfie' | 'manual-upload' | 'guided-head-scan';
  poseLabel?: 'front' | 'left' | 'right' | 'up' | 'down';
}

export interface BodyModelRequest {
  measurements: BodyMeasurements;
  captureFrames: CaptureFrame[];
  selfieFrame?: SelfieFrame;
  selfieFrames?: SelfieFrame[];
  captureMode: 'guided-360-phone-stand' | 'selfie-face-first' | 'guided-head-scan';
  deviceHint: string;
  createdAt: string;
}

export interface BodyModelManifest {
  id: string;
  status: 'queued' | 'processing' | 'ready';
  measurements: BodyMeasurements;
  captureFrameCount: number;
  qualityScore: number;
  pipeline: string[];
  output: {
    format: 'glb';
    fileName: string;
    previewFileName: string;
    yintaiAppScene: string;
  };
  createdAt: string;
  note: string;
}
