import { stylizedHeadProvider } from './stylizedHeadProvider';
import type { BodyMeasurements, SelfieFrame } from '@/types/bodyModel';
import type {
  AvatarAppearance,
  AvatarIdentity,
  AvatarOutfit,
  AvatarRenderStyle,
  FaceIdentityProvider,
  StylizedAvatar,
  StylizedAvatarBuildRequest,
  StylizedAvatarBuildResult,
  StylizedAvatarProvider,
  VrmReadyMetadata,
} from '@/types/avatarSystem';

export const DEFAULT_COMIC_RENDER_STYLE: AvatarRenderStyle = {
  id: 'american-comic-3d',
  name: '高质量美式漫画动画 3D',
  outline: true,
  toonShading: true,
  halftone: true,
  shadowSteps: 3,
  palette: {
    skin: '#e5aa82',
    hair: '#5c3120',
    primary: '#f4f4ee',
    accent: '#ed7199',
  },
};

export const DEFAULT_VRM_READY_METADATA: VrmReadyMetadata = {
  humanoidBoneMap: {
    Root: 'Root',
    Hips: 'Hips',
    Spine: 'Spine',
    Chest: 'Chest',
    Neck: 'Neck',
    Head: 'Head',
    LeftShoulder: 'LeftShoulder',
    LeftUpperArm: 'LeftUpperArm',
    LeftLowerArm: 'LeftLowerArm',
    LeftHand: 'LeftHand',
    RightShoulder: 'RightShoulder',
    RightUpperArm: 'RightUpperArm',
    RightLowerArm: 'RightLowerArm',
    RightHand: 'RightHand',
    LeftUpperLeg: 'LeftUpperLeg',
    LeftLowerLeg: 'LeftLowerLeg',
    LeftFoot: 'LeftFoot',
    RightUpperLeg: 'RightUpperLeg',
    RightLowerLeg: 'RightLowerLeg',
    RightFoot: 'RightFoot',
  },
  coordinateSystem: { unit: 'meter', forward: '+Z', up: '+Y' },
  runtimeLayers: ['identity', 'canonical-body', 'hair', 'outfit', 'accessory'],
  expressions: ['neutral', 'smile', 'cool', 'surprised'],
  springBoneExtensionPoints: { hair: true, clothing: true, accessories: true },
  exportTargets: ['glb-rig-ready', 'vrm-1.0-future'],
};

export const DEFAULT_DEMO_OUTFIT: AvatarOutfit = {
  id: 'fallback-proxy-top',
  productId: 'fallback-proxy-top',
  name: 'Fallback 漫画感上衣',
  brand: 'AI Meow',
  category: 'top',
  previewImage: `${import.meta.env.BASE_URL}product-shots/item-001.jpg`,
  assetFormat: 'procedural-proxy',
  compatibleAvatarType: 'stylized-humanoid-lite',
  fittingMode: 'skinned-compatible',
  skeletonCompatibility: {
    boneMapVersion: 'humanoid-lite-v0.1',
    requiredBones: ['Spine', 'Chest', 'LeftUpperArm', 'LeftLowerArm', 'RightUpperArm', 'RightLowerArm'],
  },
  materialConfig: {
    baseColor: '#f4f4ee',
    secondaryColor: '#ed7199',
    trimColor: '#23222a',
    toonShading: true,
    outline: true,
  },
  source: 'fallback',
  providerStage: 'fallback',
};

export function createDefaultAppearance(measurements: BodyMeasurements): AvatarAppearance {
  return {
    style: {
      ...DEFAULT_COMIC_RENDER_STYLE,
      palette: {
        ...DEFAULT_COMIC_RENDER_STYLE.palette,
        skin: measurements.skinTone || DEFAULT_COMIC_RENDER_STYLE.palette.skin,
      },
    },
    bodyPreference: {
      bodyType: measurements.bodyType,
      heightCm: measurements.heightCm,
      weightKg: measurements.weightKg,
      skinTone: measurements.skinTone,
    },
    expressionHint: 'friendly-confident',
  };
}

function averageQuality(frames: SelfieFrame[]) {
  if (frames.length === 0) return 0;
  return frames.reduce((sum, frame) => sum + frame.qualityScore, 0) / frames.length;
}

export class BrowserFaceIdentityProvider implements FaceIdentityProvider {
  async extract(frames: SelfieFrame[], deviceHint: string): Promise<AvatarIdentity> {
    const primaryFrame = frames.find((frame) => frame.poseLabel === 'front') ?? frames[0];
    if (!primaryFrame) throw new Error('No face frames captured');

    return {
      id: `face-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      deviceHint,
      face: {
        sourceFrames: frames,
        primaryFrame,
        captureMode: frames.length > 1 ? 'guided-head-scan' : 'single-selfie',
        confidence: Math.min(1, averageQuality(frames) / 100),
        identityNotes: [
          'preserve-face-shape',
          'preserve-eye-distance',
          'preserve-hairline-and-main-expression',
          'remove-small-skin-detail',
          'stylize-to-comic-animation',
        ],
      },
    };
  }
}

export class BrowserLocalStylizedAvatarProvider implements StylizedAvatarProvider {
  async build(request: StylizedAvatarBuildRequest): Promise<StylizedAvatarBuildResult> {
    const stylizedHead = request.stylizedHead ?? await stylizedHeadProvider.generate(
      request.identity,
      request.appearance.style
    );
    const localModelUrl = `${import.meta.env.BASE_URL}models/runtime-demo-rigged.glb`;

    const avatar: StylizedAvatar = {
      id: `browser-local-avatar-${Date.now().toString(36)}`,
      pipeline: 'identity-driven-stylized-avatar',
      identity: request.identity,
      appearance: request.appearance,
      stylizedHead,
      outfit: request.outfit,
      rig: {
        format: 'glb-rig-ready',
        skeleton: 'humanoid-lite',
        expressionBlendshapes: ['neutral', 'smile', 'cool', 'surprised'],
        posePresets: ['idle', 'confident-pose'],
      },
      modelUrl: localModelUrl,
      cdnUrl: localModelUrl,
      method: 'browser-local-stylized-head',
      status: 'ready',
      providerStage: 'procedural-mock',
      runtimeMetadata: DEFAULT_VRM_READY_METADATA,
    };

    return { avatar, rawProviderResult: { provider: 'browser-local', stylizedHead } };
  }
}

export const faceIdentityProvider = new BrowserFaceIdentityProvider();
export const stylizedAvatarProvider = new BrowserLocalStylizedAvatarProvider();
