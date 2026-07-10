import { useState, useCallback } from 'react';
import type { GeneratedOutfit, PosterTemplate } from '@/types';
import { generateSimplePoster } from '@/utils/poster';

export function usePosterComposer() {
  const [isComposing, setIsComposing] = useState(false);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);

  const compose = useCallback(
    async (outfit: GeneratedOutfit, template: PosterTemplate) => {
      setIsComposing(true);
      try {
        // 简单海报生成（不需要加载外部图片）
        const dataUrl = generateSimplePoster(outfit, template);
        setPosterDataUrl(dataUrl);
        return dataUrl;
      } catch (e) {
        console.error('Poster composition failed:', e);
        return null;
      } finally {
        setIsComposing(false);
      }
    },
    []
  );

  return { compose, isComposing, posterDataUrl };
}
