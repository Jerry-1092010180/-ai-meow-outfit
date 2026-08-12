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

export const socialAvatarImageProvider: SocialAvatarImageProvider = new DemoSocialAvatarImageProvider();
