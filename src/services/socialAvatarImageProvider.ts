import type {
  SocialAvatarImageProvider,
  SocialSceneAsset,
  SocialSceneRequest,
  StylizedAvatarImageAsset,
  StylizedAvatarImageRequest,
} from '@/types/socialAvatar';

const DEMO_AVATAR_URL = `${import.meta.env.BASE_URL}avatar-demo/stylized-avatar-v1-small.png`;

export class DemoSocialAvatarImageProvider implements SocialAvatarImageProvider {
  async generateAvatar(request: StylizedAvatarImageRequest): Promise<StylizedAvatarImageAsset> {
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    return {
      assetId: `avatar-preview-${Date.now().toString(36)}`,
      imageUrl: DEMO_AVATAR_URL,
      providerStage: 'effect-preview',
      request,
      identityConfidence: null,
      garmentConsistency: null,
      multiViewConsistency: null,
      fallbackReason: 'Real identity-preserving image provider is not connected in this H5 build.',
    };
  }

  async composeSocialScene(request: SocialSceneRequest): Promise<SocialSceneAsset> {
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    return {
      sceneId: request.sceneId,
      posterUrl: DEMO_AVATAR_URL,
      providerStage: 'effect-preview',
      memberCount: request.members.length,
      request,
      fallbackReason: 'The H5 composes the preview locally; production must return a generated group poster.',
    };
  }
}

export class GatewaySocialAvatarImageProvider implements SocialAvatarImageProvider {
  constructor(private readonly endpoint: string) {}

  async generateAvatar(request: StylizedAvatarImageRequest): Promise<StylizedAvatarImageAsset> {
    const response = await fetch(`${this.endpoint}/stylized-avatar/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`Stylized avatar image provider failed: ${response.status}`);
    return response.json() as Promise<StylizedAvatarImageAsset>;
  }

  async composeSocialScene(request: SocialSceneRequest): Promise<SocialSceneAsset> {
    const response = await fetch(`${this.endpoint}/stylized-avatar/social-scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`Social scene provider failed: ${response.status}`);
    return response.json() as Promise<SocialSceneAsset>;
  }
}

const gatewayBase = import.meta.env.VITE_AVATAR_API_BASE_URL as string | undefined;

export const socialAvatarImageProvider: SocialAvatarImageProvider = gatewayBase
  ? new GatewaySocialAvatarImageProvider(gatewayBase)
  : new DemoSocialAvatarImageProvider();

