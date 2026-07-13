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
  shoulderCm?: number;
  bustCm?: number;
  waistCm?: number;
  hipCm?: number;
  inseamCm?: number;
}

export interface CaptureFrame {
  angle: CaptureAngle;
  imageDataUrl: string;
  capturedAt: string;
  qualityScore: number;
}

export interface BodyModelRequest {
  measurements: BodyMeasurements;
  captureFrames: CaptureFrame[];
  captureMode: 'guided-360-phone-stand';
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
