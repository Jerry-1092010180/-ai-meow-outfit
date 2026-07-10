import type { GeneratedOutfit } from './outfit';
import type { BodyType, ColorPreference, StyleTag } from './user';

export interface Challenge {
  id: string;
  type: ChallengeType;
  theme: string;
  status: ChallengeStatus;
  inviteCode: string;
  teamA: ChallengeTeam;
  teamB: ChallengeTeam;
  votesA: number;
  votesB: number;
  createdAt: string;
  votingEndsAt: string;
  winnerId?: string;
  reward?: ChallengeReward;
}

export type ChallengeType = '1v1' | '2v2';

export type ChallengeStatus = 'pending' | 'active' | 'voting' | 'completed';

export interface ChallengeTeam {
  id: string;
  members: ChallengeMember[];
  outfit: GeneratedOutfit | null;
  /** PK穿搭配色 */
  outfitColors?: TeamOutfitColors;
}

export interface TeamOutfitColors {
  topColor: string;
  bottomColor: string;
  shoeColor: string;
}

export interface ChallengeMember {
  userId: string;
  name: string;
  avatar: string;
  /** 身材参数，用于3D建模 */
  bodyType?: BodyType;
  /** 肤色偏好 */
  colorPreference?: ColorPreference;
  /** 风格标签 */
  styleTags?: StyleTag[];
}

export interface ChallengeReward {
  type: 'coupon' | 'badge';
  name: string;
  description: string;
  value?: number;
  code?: string;
}

export interface ChallengeResult {
  challenge: Challenge;
  winner: ChallengeTeam;
  loser: ChallengeTeam;
  userVoted: string;
}
