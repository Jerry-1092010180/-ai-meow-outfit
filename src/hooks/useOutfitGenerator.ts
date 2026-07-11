import { useCallback } from 'react';
import { useOutfitStore } from '@/stores/useOutfitStore';
import type { Mood } from '@/types';

export function useOutfitGenerator() {
  const generateOutfitAction = useOutfitStore((s) => s.generateOutfit);
  const todayOutfit = useOutfitStore((s) => s.todayOutfit);
  const isLoading = useOutfitStore((s) => s.isGenerating);

  const generate = useCallback(
    async (mood: Mood) => {
      try {
        await generateOutfitAction(mood);
      } catch {
        // notification already shown by store; just re-mount to mood picker
      }
    },
    [generateOutfitAction]
  );

  return { generate, isLoading, outfit: todayOutfit };
}
