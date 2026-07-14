import { submitReconstruction, getReconstructionModelUrl } from './avatarApi';
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

export const DEFAULT_DEMO_OUTFIT: AvatarOutfit = {
  id: 'yintai-demo-hoodie',
  name: '银泰漫画感连帽套装',
  source: 'procedural-demo',
  category: 'hoodie',
  palette: ['#f4f4ee', '#ed7199', '#23222a'],
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

export class AigcStylizedAvatarProvider implements StylizedAvatarProvider {
  async build(request: StylizedAvatarBuildRequest): Promise<StylizedAvatarBuildResult> {
    const stylizedHead = request.stylizedHead ?? await stylizedHeadProvider.generate(
      request.identity,
      request.appearance.style
    );
    const result = await submitReconstruction(
      request.measurements,
      [],
      request.identity.face.primaryFrame,
      request.identity.face.sourceFrames,
      {
        pipeline: 'identity-driven-stylized-avatar',
        renderStyle: request.appearance.style,
        stylizedHead,
        outfit: request.outfit,
        rigTarget: 'vrm-ready',
      }
    );

    const avatar: StylizedAvatar = {
      id: result.job_id,
      pipeline: 'identity-driven-stylized-avatar',
      identity: request.identity,
      appearance: request.appearance,
      outfit: request.outfit,
      rig: {
        format: result.rig_format === 'vrm-ready' ? 'vrm-ready' : result.rig_ready ? 'glb-rig-ready' : 'glb-static',
        skeleton: result.rig_ready ? 'humanoid-lite' : 'none',
        expressionBlendshapes: result.expression_blendshapes ?? ['smile', 'blink'],
        posePresets: result.animation_clips ?? result.pose_presets ?? ['idle', 'confident-pose'],
      },
      modelUrl: result.model_url,
      cdnUrl: getReconstructionModelUrl(result),
      method: result.method,
      status: 'ready',
      providerStage: 'aigc-gateway',
    };

    return { avatar, rawProviderResult: { result, stylizedHead } };
  }
}

export const faceIdentityProvider = new BrowserFaceIdentityProvider();
export const stylizedAvatarProvider = new AigcStylizedAvatarProvider();
