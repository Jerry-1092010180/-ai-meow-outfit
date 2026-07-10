import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Challenge, ChallengeType } from '@/types';
import { getChallenges, createChallenge as createChallengeService } from '@/services/challengeService';

interface ChallengeState {
  activeChallenges: Challenge[];
  completedChallenges: Challenge[];
  isLoading: boolean;

  loadChallenges: () => Promise<void>;
  createChallenge: (type: ChallengeType, theme: string, userId: string) => Promise<void>;
  joinChallenge: (challengeId: string, userId: string) => Promise<void>;
  submitVote: (challengeId: string, teamId: string, userId: string) => Promise<void>;
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      activeChallenges: [],
      completedChallenges: [],
      isLoading: false,

      loadChallenges: async () => {
        set({ isLoading: true });
        try {
          const { active, completed } = await getChallenges();
          set({ activeChallenges: active, completedChallenges: completed, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      createChallenge: async (type, theme, userId) => {
        const challenge = await createChallengeService(type, theme, userId);
        set((state) => ({
          activeChallenges: [challenge, ...state.activeChallenges],
        }));
      },

      joinChallenge: async (challengeId, userId) => {
        set((state) => ({
          activeChallenges: state.activeChallenges.map((c) =>
            c.id === challengeId
              ? {
                  ...c,
                  teamB: {
                    ...c.teamB,
                    members: [
                      ...c.teamB.members,
                      { userId, name: '我', avatar: '' },
                    ],
                  },
                  status: c.teamB.members.length >= c.teamA.members.length ? 'active' as const : c.status,
                }
              : c
          ),
        }));
      },

      submitVote: async (challengeId, teamId, _userId) => {
        set((state) => ({
          activeChallenges: state.activeChallenges.map((c) =>
            c.id === challengeId
              ? {
                  ...c,
                  votesA: teamId === c.teamA.id ? c.votesA + 1 : c.votesA,
                  votesB: teamId === c.teamB.id ? c.votesB + 1 : c.votesB,
                }
              : c
          ),
        }));
      },
    }),
    { name: 'aimm-challenge' }
  )
);
