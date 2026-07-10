import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Poster, SharePlatform } from '@/types';

interface SocialState {
  generatedPosters: Poster[];
  shareHistory: Array<{ posterId: string; platform: SharePlatform; timestamp: string }>;

  generatePoster: (poster: Poster) => void;
  shareToPlatform: (posterId: string, platform: SharePlatform) => void;
  loadPosters: () => Poster[];
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      generatedPosters: [],
      shareHistory: [],

      generatePoster: (poster) =>
        set((state) => ({
          generatedPosters: [poster, ...state.generatedPosters],
        })),

      shareToPlatform: (posterId, platform) =>
        set((state) => ({
          shareHistory: [
            {
              posterId,
              platform,
              timestamp: new Date().toISOString(),
            },
            ...state.shareHistory,
          ],
        })),

      loadPosters: () => get().generatedPosters,
    }),
    { name: 'aimm-social' }
  )
);
