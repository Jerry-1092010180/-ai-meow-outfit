import { useEffect } from 'react';
import { useOutfitStore } from '@/stores/useOutfitStore';
import { getToday } from '@/utils/date';

export function useStreakTracker() {
  const streak = useOutfitStore((s) => s.streak);
  const lastOpenDate = useOutfitStore((s) => s.lastOpenDate);
  const checkStreak = useOutfitStore((s) => s.checkStreak);
  const loadTodayOutfit = useOutfitStore((s) => s.loadTodayOutfit);

  const today = getToday();
  const isNewDay = lastOpenDate !== today;

  useEffect(() => {
    loadTodayOutfit();
    checkStreak();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { streak, isNewDay, lastOpenDate };
}
