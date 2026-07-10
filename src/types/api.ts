import type { GeneratedOutfit, Mood } from './outfit';
import type { Challenge, ChallengeType } from './challenge';
import type { StoreItem, Coupon } from './store';
import type { Poster, PosterTemplate, ShareConfig } from './share';
import type { UserProfile } from './user';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface GenerateOutfitRequest {
  mood: Mood;
  userId: string;
  regenerate?: boolean;
}

export interface GenerateOutfitResponse {
  outfit: GeneratedOutfit;
}

export interface CreateChallengeRequest {
  type: ChallengeType;
  theme: string;
  userId: string;
}

export interface JoinChallengeRequest {
  challengeId: string;
  userId: string;
}

export interface VoteRequest {
  challengeId: string;
  teamId: string;
  userId: string;
}

export interface GeneratePosterRequest {
  outfitId: string;
  templateId: string;
}

export interface GeneratePosterResponse {
  poster: Poster;
}

export interface GetShareConfigResponse {
  config: ShareConfig;
}

export interface GetStoreItemsRequest {
  storeId?: string;
  category?: string;
  tags?: string[];
  query?: string;
}

export interface GetStoreItemsResponse {
  items: StoreItem[];
}

export interface PurchaseRequest {
  items: { skuId: string; quantity: number }[];
  storeId: string;
}

export interface PurchaseResponse {
  orderId: string;
  coupon?: Coupon;
}

export interface GetOutfitHistoryResponse {
  outfits: GeneratedOutfit[];
}

export interface GetChallengesResponse {
  active: Challenge[];
  completed: Challenge[];
}

export interface GetUserProfileResponse {
  profile: UserProfile;
}

export interface UpdateProfileRequest {
  bodyType?: string;
  styleTags?: string[];
  colorPreferences?: string[];
  preferredStore?: string;
}
