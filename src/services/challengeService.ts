/**
 * 挑战服务 — PK 挑战 CRUD + 邀请码系统
 */

import type { Challenge, ChallengeType, ChallengeMember, BodyType, ColorPreference } from '@/types';
import { useUserStore } from '@/stores/useUserStore';

function uid(): string {
  return `ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 生成6位邀请码 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** PK 配色方案 */
const PK_PALETTES = [
  { teamA: { topColor: '#FF6B8A', bottomColor: '#FFB8C6', shoeColor: '#FFD700' },
    teamB: { topColor: '#4A90D9', bottomColor: '#2D5F8A', shoeColor: '#87CEEB' } },
  { teamA: { topColor: '#2D2D2D', bottomColor: '#1A1A1A', shoeColor: '#C0C0C0' },
    teamB: { topColor: '#FAFAFA', bottomColor: '#E0E0E0', shoeColor: '#FFFFFF' } },
  { teamA: { topColor: '#4CAF50', bottomColor: '#2E7D32', shoeColor: '#A5D6A7' },
    teamB: { topColor: '#FF9800', bottomColor: '#E65100', shoeColor: '#FFB74D' } },
];

/** 获取当前用户的资料（用于存入挑战） */
export function getMyProfile(): ChallengeMember {
  const profile = useUserStore.getState().profile;
  return {
    userId: profile?.id || 'anon',
    name: profile?.nickname || '喵街会员',
    avatar: profile?.avatar || '',
    bodyType: profile?.bodyType,
    colorPreference: profile?.colorPreferences?.[0],
    styleTags: profile?.styleTags,
  };
}

/** 加载挑战列表 */
export async function getChallenges(): Promise<{ active: Challenge[]; completed: Challenge[] }> {
  const now = new Date();
  const palette = PK_PALETTES[0];

  const active: Challenge[] = [
    {
      id: uid(), type: '1v1', theme: '夏日清凉穿搭', status: 'voting', inviteCode: 'SUMMER',
      teamA: { id: 'ta', members: [{ userId: 'u1', name: '时尚达人小美', avatar: '', bodyType: 'hourglass', colorPreference: 'warm' }], outfit: null, outfitColors: palette.teamA },
      teamB: { id: 'tb', members: [{ userId: 'u2', name: '穿搭新手阿杰', avatar: '', bodyType: 'rectangle', colorPreference: 'cool' }], outfit: null, outfitColors: palette.teamB },
      votesA: 128, votesB: 93,
      createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      votingEndsAt: new Date(now.getTime() + 22 * 3600000).toISOString(),
    },
    {
      id: uid(), type: '1v1', theme: '通勤穿搭PK', status: 'active', inviteCode: 'OFFICE',
      teamA: { id: 'ta2', members: [{ userId: 'u3', name: '办公室女王Lily', avatar: '', bodyType: 'pear', colorPreference: 'neutral' }], outfit: null, outfitColors: PK_PALETTES[1].teamA },
      teamB: { id: 'tb2', members: [{ userId: 'u1', name: '时尚达人小美', avatar: '', bodyType: 'hourglass', colorPreference: 'warm' }], outfit: null, outfitColors: PK_PALETTES[1].teamB },
      votesA: 0, votesB: 0,
      createdAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
      votingEndsAt: new Date(now.getTime() + 47 * 3600000).toISOString(),
    },
  ];

  const completed: Challenge[] = [
    {
      id: uid(), type: '1v1', theme: '约会穿搭', status: 'completed', inviteCode: 'DATING',
      teamA: { id: 'ta3', members: [{ userId: 'u1', name: '时尚达人小美', avatar: '', bodyType: 'hourglass', colorPreference: 'warm' }], outfit: null, outfitColors: PK_PALETTES[2].teamA },
      teamB: { id: 'tb3', members: [{ userId: 'u4', name: '甜妹苏苏', avatar: '', bodyType: 'pear', colorPreference: 'vibrant' }], outfit: null, outfitColors: PK_PALETTES[2].teamB },
      votesA: 256, votesB: 208, winnerId: 'ta3',
      createdAt: new Date(now.getTime() - 26 * 3600000).toISOString(),
      votingEndsAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      reward: { type: 'coupon', name: '银泰50元穿搭券', description: '适用于任意门店女装区', value: 50, code: 'MM50-OFF-2026' },
    },
  ];

  return { active, completed };
}

/** 创建新挑战（带邀请码） */
export async function createChallenge(
  type: ChallengeType,
  theme: string,
  _userId: string
): Promise<Challenge> {
  const now = new Date();
  const myProfile = getMyProfile();
  const palette = PK_PALETTES[Math.floor(Math.random() * PK_PALETTES.length)];

  return {
    id: uid(),
    type,
    theme,
    status: 'pending',
    inviteCode: generateInviteCode(),
    teamA: {
      id: 'ta',
      members: [myProfile],
      outfit: null,
      outfitColors: palette.teamA,
    },
    teamB: {
      id: 'tb',
      members: [],
      outfit: null,
      outfitColors: palette.teamB,
    },
    votesA: 0,
    votesB: 0,
    createdAt: now.toISOString(),
    votingEndsAt: new Date(now.getTime() + 48 * 3600000).toISOString(),
  };
}

/** 通过邀请码查找挑战 */
export function findChallengeByInviteCode(code: string): Challenge | null {
  // 从 localStorage 中查找（所有活跃挑战都持久化在 store 中）
  try {
    const raw = localStorage.getItem('aimm-challenge');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const state = data.state || data;
    const allChallenges = [
      ...(state.activeChallenges || []),
      ...(state.completedChallenges || []),
    ];
    return allChallenges.find((c: Challenge) => c.inviteCode === code) || null;
  } catch {
    return null;
  }
}

/** 通过邀请码加入挑战 */
export function joinChallengeByCode(inviteCode: string): Challenge | null {
  const myProfile = getMyProfile();

  try {
    const raw = localStorage.getItem('aimm-challenge');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const state = data.state || data;
    const activeChallenges: Challenge[] = state.activeChallenges || [];

    const idx = activeChallenges.findIndex((c) => c.inviteCode === inviteCode);
    if (idx === -1) return null;

    const challenge = activeChallenges[idx];
    if (challenge.teamB.members.length > 0) return challenge; // 已满

    activeChallenges[idx] = {
      ...challenge,
      teamB: {
        ...challenge.teamB,
        members: [myProfile],
      },
      status: 'active',
    };

    // 写回 localStorage
    const newState = { ...state, activeChallenges };
    localStorage.setItem('aimm-challenge', JSON.stringify({ state: newState, version: 0 }));

    return activeChallenges[idx];
  } catch {
    return null;
  }
}
