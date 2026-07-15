import type { BodyMeasurements, SelfieFrame } from './bodyModel';

export type AvatarPipelineMode =
  | 'identity-driven-stylized-avatar'
  | 'legacy-body-reconstruction';

export type AvatarRenderStyleId =
  | 'american-comic-3d'
  | 'manga-toon-3d'
  | 'soft-toy-3d';

export interface FaceIdentity {
  sourceFrames: SelfieFrame[];
  primaryFrame: SelfieFrame;
  captureMode: 'guided-head-scan' | 'single-selfie';
  confidence: number;
  identityNotes: string[];
}

export interface FaceIdentityFeatures {
  faceAspectRatio: number;
  faceWidthRatio: number;
  eyeLineEstimateY: number;
  mouthLineEstimateY: number;
  skinToneHex?: string;
  hairToneHex?: string;
  eyeDistanceRatio?: number;
  noseWidthRatio?: number;
  mouthWidthRatio?: number;
  browTilt?: number;
  hairlineY?: number;
  poseCoverage: {
    front: boolean;
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
}

export interface AvatarIdentity {
  id: string;
  face: FaceIdentity;
  createdAt: string;
  deviceHint: string;
}

export interface AvatarRenderStyle {
  id: AvatarRenderStyleId;
  name: string;
  outline: boolean;
  toonShading: boolean;
  halftone: boolean;
  shadowSteps: number;
  palette: {
    skin: string;
    hair: string;
    primary: string;
    accent: string;
  };
}

export interface AvatarAppearance {
  style: AvatarRenderStyle;
  bodyPreference: Pick<
    BodyMeasurements,
    'bodyType' | 'heightCm' | 'weightKg' | 'skinTone'
  >;
  hairHint?: string;
  makeupHint?: string;
  expressionHint?: string;
}

export type AvatarRuntimeLayer =
  | 'identity'
  | 'canonical-body'
  | 'hair'
  | 'outfit'
  | 'accessory';

export type AvatarExpressionName =
  | 'neutral'
  | 'smile'
  | 'cool'
  | 'surprised';

export interface BodyVisibilityMask {
  hiddenPrimitiveNames: string[];
  mutedMaterialNames: string[];
  reason: 'outfit-overlay-active' | 'canonical-body-runtime';
}

export type AvatarOutfitCategory =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'shoes'
  | 'accessory';

export type AvatarOutfitFittingMode =
  | 'rigid-attach'
  | 'skinned-compatible'
  | 'procedural-proxy'
  | 'future-physics';

export type AvatarOutfitProviderStage =
  | 'real-asset'
  | 'proxy-from-product'
  | 'fallback';

export interface AvatarOutfit {
  id: string;
  productId: string;
  name: string;
  brand: string;
  category: AvatarOutfitCategory;
  previewImage: string;
  assetUrl?: string;
  assetFormat: 'glb' | 'procedural-proxy';
  compatibleAvatarType: 'stylized-humanoid-lite';
  fittingMode: AvatarOutfitFittingMode;
  skeletonCompatibility: {
    boneMapVersion: 'humanoid-lite-v0.1';
    requiredBones: string[];
    attachBone?: string;
  };
  materialConfig: {
    baseColor: string;
    secondaryColor?: string;
    trimColor?: string;
    textureUrl?: string;
    toonShading: boolean;
    outline: boolean;
  };
  source: 'yintai-product' | 'mock-product' | 'fallback';
  providerStage: AvatarOutfitProviderStage;
}

export interface AvatarRig {
  format: 'glb-static' | 'glb-rig-ready' | 'vrm-ready';
  skeleton: 'none' | 'humanoid-lite' | 'vrm-humanoid';
  expressionBlendshapes: string[];
  posePresets: string[];
}

export interface RigValidation {
  ok: boolean;
  errors: string[];
  bones: number;
  skinnedMeshes: number;
  animations: number;
}

export interface RiggedAvatarAsset {
  riggedModelUrl: string;
  format: 'glb-rig-ready' | 'vrm-ready';
  skeletonMetadata: {
    skeleton: 'humanoid-lite' | 'vrm-humanoid';
    boneCount: number;
    skinnedMeshCount: number;
    animationCount: number;
  };
  boneMap: Record<string, string>;
  animationClips: string[];
  rigValidation: RigValidation;
  providerStage: 'local-humanoid-lite-rig-provider' | 'future-vrm-provider' | 'auto-rig-aigc-provider';
  confidence: number;
  vrmReadyMetadata?: VrmReadyMetadata;
}

export interface VrmReadyMetadata {
  humanoidBoneMap: Record<string, string>;
  coordinateSystem: {
    unit: 'meter';
    forward: '+Z' | '-Z';
    up: '+Y';
  };
  runtimeLayers: AvatarRuntimeLayer[];
  expressions: AvatarExpressionName[];
  springBoneExtensionPoints: {
    hair: boolean;
    clothing: boolean;
    accessories: boolean;
  };
  exportTargets: Array<'glb-rig-ready' | 'vrm-1.0-future'>;
}

export interface StylizedHead {
  id: string;
  providerStage: 'enhanced-local' | 'local-experimental' | 'mock-placeholder' | 'future-aigc-provider' | 'nerf-aigc-provider' | 'gaussian-splat-aigc-provider';
  representation: 'stylized-face-texture+head-fit-params' | 'stylized-head-mesh' | 'head-parameters-only' | 'neural-field+mesh+texture';
  textureDataUrl?: string;
  previewDataUrl?: string;
  meshUrl?: string;
  neuralFieldUrl?: string;
  canonicalTextureUrl?: string;
  reportUrl?: string;
  animeReferenceUrl?: string;
  sourceFrameCount: number;
  confidence: number;
  identityFeatures: FaceIdentityFeatures;
  multiViewCoverage?: {
    front: boolean;
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    score: number;
  };
  fallbackReason?: string;
  headFit: {
    facePlaneScale: number;
    verticalOffset: number;
    headWidthScale: number;
    headHeightScale: number;
    hairVolume: number;
  };
  style: AvatarRenderStyle;
  notes: string[];
}

export interface StylizedAvatar {
  id: string;
  pipeline: AvatarPipelineMode;
  identity: AvatarIdentity;
  appearance: AvatarAppearance;
  stylizedHead?: StylizedHead;
  outfit: AvatarOutfit;
  rig: AvatarRig;
  modelUrl?: string;
  cdnUrl?: string;
  method?: string;
  status: 'local-preview' | 'processing' | 'ready' | 'failed';
  providerStage: 'procedural-mock' | 'aigc-gateway' | 'future-vrm-provider';
  runtimeMetadata?: VrmReadyMetadata;
}

export interface StylizedAvatarBuildRequest {
  identity: AvatarIdentity;
  stylizedHead?: StylizedHead;
  appearance: AvatarAppearance;
  outfit: AvatarOutfit;
  measurements: BodyMeasurements;
}

export interface StylizedAvatarBuildResult {
  avatar: StylizedAvatar;
  rawProviderResult?: unknown;
}

export interface FaceIdentityProvider {
  extract(frames: SelfieFrame[], deviceHint: string): Promise<AvatarIdentity>;
}

export interface StylizedHeadProvider {
  generate(identity: AvatarIdentity, style: AvatarRenderStyle): Promise<StylizedHead>;
}

export interface StylizedAvatarProvider {
  build(request: StylizedAvatarBuildRequest): Promise<StylizedAvatarBuildResult>;
}

export interface RiggedAvatarExportProvider {
  export(avatar: StylizedAvatar, target: 'glb' | 'vrm'): Promise<RiggedAvatarAsset>;
}

export interface AvatarOutfitProvider {
  listDemoOutfits(): Promise<AvatarOutfit[]>;
  resolve(productId: string): Promise<AvatarOutfit>;
}
