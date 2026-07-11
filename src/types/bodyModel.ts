import type { BodyType } from './user';

export type CaptureAngle =
  | 0
  | 30
  | 60
  | 90
  | 120
  | 150
  | 180
  | 210
  | 240
  | 270
  | 300
  | 330;

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
