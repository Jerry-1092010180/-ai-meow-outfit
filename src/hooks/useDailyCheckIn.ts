import { useCallback } from 'react';
import { useOutfitStore } from '@/stores/useOutfitStore';
import type { GeneratedOutfit } from '@/types';

export function useDailyCheckIn() {
  const todayOutfit = useOutfitStore((s) => s.todayOutfit);
  const saveOutfit = useOutfitStore((s) => s.saveOutfit);
  const streak = useOutfitStore((s) => s.streak);
  const lastOpenDate = useOutfitStore((s) => s.lastOpenDate);
  const diary = useOutfitStore((s) => s.diary);

  const today = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = lastOpenDate === today && !!diary[today];

  const checkIn = useCallback(
    (outfit?: GeneratedOutfit) => {
      if (outfit || todayOutfit) {
        saveOutfit(outfit || todayOutfit!);
      }
    },
    [saveOutfit, todayOutfit]
  );

  const dailyReward = streak > 0 ? `${streak}天连续打卡` : '今日首次打卡';

  return { hasCheckedInToday, checkIn, dailyReward, streak };
}
