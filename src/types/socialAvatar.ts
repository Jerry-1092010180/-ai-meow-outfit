export type AvatarPoseId =
  | 'editorial'
  | 'confident'
  | 'street'
  | 'wave'
  | 'dance'
  | 'celebrate';

export type AvatarHairStyleId =
  | 'high-ponytail'
  | 'soft-wave'
  | 'short-bob'
  | 'long-straight';

export type AvatarExpressionId = 'natural' | 'smile' | 'cool' | 'surprised';
export type AvatarBackgroundId = 'neon' | 'gallery' | 'rooftop' | 'mint';
export type SocialSceneLayout = 'single' | 'duo' | 'trio' | 'group-four';
export type SocialSceneInteractionId =
  | 'side-by-side'
  | 'high-five'
  | 'shopping-walk'
  | 'group-selfie';

export interface AvatarIdentityImageInput {
  primaryPhotoUrl: string | null;
  additionalPhotoUrls: string[];
  preserveFeatures: [
    'face-shape',
    'eyes',
    'nose',
    'mouth',
    'eyebrows',
    'hairline',
    'skin-tone'
  ];
  beautification: {
    skinSmoothing: 'light';
    removeTemporaryBlemishes: true;
    eyeEnhancement: 'subtle';
    preserveRecognition: true;
  };
}

export interface GarmentImagePartInput {
  slot: 'inner' | 'outerwear' | 'base' | 'shoes' | 'accessory';
  layerOrder: number;
  productId: string;
  skuId: string;
  name: string;
  brand: string;
  category: string;
  sourceImageUrl: string;
  sourceImageRole: 'yintai-pim-primary' | 'demo-licensed-placeholder';
  colors: string[];
  fittingInstruction: 'preserve-design-and-color';
}

export interface StylizedAvatarImageRequest {
  requestId: string;
  identity: AvatarIdentityImageInput;
  garments: GarmentImagePartInput[];
  controls: {
    poseId: AvatarPoseId;
    expressionId: AvatarExpressionId;
    hairStyleId: AvatarHairStyleId;
    backgroundId: AvatarBackgroundId;
  };
  renderPolicy: {
    style: 'premium-comic-animation';
    preserveIdentity: true;
    preserveGarmentDesign: true;
    coherentLayering: true;
    fullBody: true;
    fixedPoseForbidden: true;
  };
}

export interface StylizedAvatarImageAsset {
  assetId: string;
  imageUrl: string;
  providerStage: 'effect-preview' | 'gateway-aigc-generated';
  request: StylizedAvatarImageRequest;
  identityConfidence: number | null;
  garmentConsistency: number | null;
  multiViewConsistency: number | null;
  fallbackReason?: string;
}

export interface SocialAvatarMember {
  memberId: string;
  displayName: string;
  avatarAssetId: string;
  avatarImageUrl: string;
  outfitProductIds: string[];
  poseId: AvatarPoseId;
  joinedAt: string;
  role: 'host' | 'friend';
}

export interface SocialSceneRequest {
  sceneId: string;
  layout: SocialSceneLayout;
  backgroundId: AvatarBackgroundId;
  interactionId: SocialSceneInteractionId;
  members: SocialAvatarMember[];
  output: {
    poster: true;
    storyImage: true;
    shortVideoExtension: true;
  };
}

export interface SocialSceneAsset {
  sceneId: string;
  posterUrl: string;
  providerStage: 'effect-preview' | 'gateway-aigc-generated';
  memberCount: number;
  request: SocialSceneRequest;
  fallbackReason?: string;
}

export interface SocialSceneInvite {
  inviteId: string;
  sceneId: string;
  inviteUrl: string;
  hostMemberId: string;
  maxMembers: 2 | 3 | 4;
  joinedCount: number;
  expiresAt: string;
  status: 'open' | 'full' | 'expired';
}

export interface SocialSceneSession {
  sceneId: string;
  invite: SocialSceneInvite;
  members: SocialAvatarMember[];
  backgroundId: AvatarBackgroundId;
  interactionId: SocialSceneInteractionId;
  poster?: SocialSceneAsset;
  updatedAt: string;
}

export interface CreateSocialSceneInviteInput {
  sceneId: string;
  inviteUrl: string;
  host: SocialAvatarMember;
  maxMembers: 2 | 3 | 4;
  backgroundId: AvatarBackgroundId;
  interactionId: SocialSceneInteractionId;
}

export interface SocialAvatarImageProvider {
  generateAvatar(request: StylizedAvatarImageRequest): Promise<StylizedAvatarImageAsset>;
  composeSocialScene(request: SocialSceneRequest): Promise<SocialSceneAsset>;
}

export interface SocialScenePlatformProvider {
  createInvite(input: CreateSocialSceneInviteInput): Promise<SocialSceneInvite>;
  getSession(sceneId: string): Promise<SocialSceneSession | null>;
  joinInvite(inviteId: string, member: SocialAvatarMember): Promise<SocialSceneSession>;
  updateScene(
    sceneId: string,
    patch: Pick<SocialSceneSession, 'backgroundId' | 'interactionId'>
  ): Promise<SocialSceneSession>;
}
