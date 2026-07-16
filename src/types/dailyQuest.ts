import type { StoreItem } from './store';
import type {
  AvatarBackgroundId,
  AvatarExpressionId,
  AvatarHairStyleId,
  AvatarPoseId,
  StylizedAvatarImageAsset,
} from './socialAvatar';

export type DailyQuestStage = 'lobby' | 'selecting' | 'generating' | 'result';
export type DailyQuestOutfitSlot = 'inner' | 'outerwear' | 'base' | 'shoes' | 'accessory';

export interface DailyQuestRound {
  id: string;
  slot: DailyQuestOutfitSlot;
  label: string;
  prompt: string;
  optional?: boolean;
  candidates: StoreItem[];
}

export interface DailyStyleQuest {
  id: string;
  date: string;
  issue: string;
  episodeNumber: number;
  weeklyArc: string;
  title: string;
  scene: string;
  story: string;
  weather: string;
  storeName: string;
  deadline: string;
  timeLimitSeconds: number;
  reward: {
    inspiration: number;
    couponLabel: string;
    collectible: string;
  };
  nextTeaser: string;
  aigcInputs: string[];
  rounds: DailyQuestRound[];
  providerStage: 'demo-personalized-provider' | 'gateway-aigc-provider';
}

export interface DailyQuestSelection {
  roundId: string;
  item: StoreItem;
}

export interface DailyQuestScoreDimension {
  label: string;
  score: number;
}

export interface GeneratedQuestLook {
  id: string;
  title: string;
  score: number;
  verdict: string;
  storyCaption: string;
  tags: string[];
  dimensions: DailyQuestScoreDimension[];
  selections: DailyQuestSelection[];
  items: StoreItem[];
  avatar: StylizedAvatarImageAsset;
  generationTrace: string[];
  providerStage: 'demo-personalized-provider' | 'gateway-aigc-provider';
}

export interface DailyQuestGenerationOptions {
  identityImageUrl: string | null;
  poseId: AvatarPoseId;
  expressionId: AvatarExpressionId;
  hairStyleId: AvatarHairStyleId;
  backgroundId: AvatarBackgroundId;
}

export interface DailyQuestContext {
  city: string;
  temperature: number;
  weather: string;
  preferredStore: string;
  styleTags: string[];
}

export interface DailyQuestAigcProvider {
  createDailyQuest(context: DailyQuestContext): Promise<DailyStyleQuest>;
  generateLook(
    quest: DailyStyleQuest,
    selections: DailyQuestSelection[],
    options: DailyQuestGenerationOptions
  ): Promise<GeneratedQuestLook>;
}
