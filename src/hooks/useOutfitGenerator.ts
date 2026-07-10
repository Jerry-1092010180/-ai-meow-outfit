import { useState, useCallback } from 'react';
import { useOutfitStore } from '@/stores/useOutfitStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { Mood } from '@/types';

export function useOutfitGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateOutfit = useOutfitStore((s) => s.generateOutfit);
  const todayOutfit = useOutfitStore((s) => s.todayOutfit);

  const generate = useCallback(
    async (mood: Mood) => {
      setIsLoading(true);
      setError(null);
      try {
        await generateOutfit(mood);
      } catch (e) {
        setError('生成失败，请重试');
        useNotificationStore.getState().addNotification('穿搭生成失败，请检查网络后重试', 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [generateOutfit]
  );

  return { generate, isLoading, error, outfit: todayOutfit };
}
