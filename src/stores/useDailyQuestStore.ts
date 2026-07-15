import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getToday } from '@/utils/date';

interface DailyQuestState {
  streak: number;
  inspiration: number;
  completedDate: string | null;
  shareCount: number;
  assistCount: number;
  lastLookScore: number | null;
  completeQuest: (score: number, reward: number) => void;
  recordShare: () => void;
  recordAssist: () => void;
  resetDemo: () => void;
}

export const useDailyQuestStore = create<DailyQuestState>()(
  persist(
    (set) => ({
      streak: 6,
      inspiration: 380,
      completedDate: null,
      shareCount: 0,
      assistCount: 0,
      lastLookScore: null,
      completeQuest: (score, reward) =>
        set((state) => {
          const alreadyCompletedToday = state.completedDate === getToday();
          return {
            completedDate: getToday(),
            lastLookScore: score,
            inspiration: alreadyCompletedToday ? state.inspiration : state.inspiration + reward,
            streak: alreadyCompletedToday ? state.streak : state.streak + 1,
          };
        }),
      recordShare: () => set((state) => ({ shareCount: state.shareCount + 1 })),
      recordAssist: () => set((state) => ({ assistCount: state.assistCount + 1 })),
      resetDemo: () => set({ completedDate: null, shareCount: 0, assistCount: 0, lastLookScore: null }),
    }),
    { name: 'aimm-daily-quest-v1' }
  )
);
