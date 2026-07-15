import type { StoreItem } from './store';

export type DailyQuestStage = 'lobby' | 'selecting' | 'generating' | 'result';

export interface DailyQuestRound {
  id: string;
  label: string;
  prompt: string;
  candidates: StoreItem[];
}

export interface DailyStyleQuest {
  id: string;
  date: string;
  issue: string;
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
  alternativeItems: StoreItem[];
  generationTrace: string[];
  providerStage: 'demo-personalized-provider' | 'gateway-aigc-provider';
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
    selections: DailyQuestSelection[]
  ): Promise<GeneratedQuestLook>;
}
