import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GeneratedOutfit, Mood } from '@/types';
import { getToday, calculateStreak } from '@/utils/date';
import { generateOutfit as generateOutfitService } from '@/services/outfitService';
import { useNotificationStore } from './useNotificationStore';

interface OutfitState {
  todayOutfit: GeneratedOutfit | null;
  diary: Record<string, GeneratedOutfit>;
  streak: number;
  lastOpenDate: string;
  history: GeneratedOutfit[];
  isGenerating: boolean;

  generateOutfit: (mood: Mood) => Promise<void>;
  saveOutfit: (outfit: GeneratedOutfit) => void;
  loadTodayOutfit: () => void;
  checkStreak: () => void;
}

export const useOutfitStore = create<OutfitState>()(
  persist(
    (set, get) => ({
      todayOutfit: null,
      diary: {},
      streak: 0,
      lastOpenDate: '',
      history: [],
      isGenerating: false,

      generateOutfit: async (mood: Mood) => {
        set({ isGenerating: true });
        try {
          const outfit = await generateOutfitService(mood, 'current-user');
          const today = getToday();
          set((state) => ({
            todayOutfit: outfit,
            lastOpenDate: today,
            isGenerating: false,
          }));
        } catch {
          set({ isGenerating: false });
          useNotificationStore
            .getState()
            .addNotification('生成失败，请重试', 'error');
        }
      },

      saveOutfit: (outfit: GeneratedOutfit) => {
        const today = getToday();
        set((state) => ({
          diary: { ...state.diary, [today]: outfit },
          lastOpenDate: today,
          history: [outfit, ...state.history.filter((o) => o.id !== outfit.id)],
        }));
        useNotificationStore.getState().addNotification('穿搭已保存到日记 ✨', 'success');
      },

      loadTodayOutfit: () => {
        const today = getToday();
        const { diary, todayOutfit } = get();
        if (!todayOutfit && diary[today]) {
          set({ todayOutfit: diary[today], lastOpenDate: today });
        }
      },

      checkStreak: () => {
        const { diary, lastOpenDate } = get();
        const streak = calculateStreak(diary, lastOpenDate);
        set({ streak });
      },
    }),
    { name: 'aimm-outfit' }
  )
);
