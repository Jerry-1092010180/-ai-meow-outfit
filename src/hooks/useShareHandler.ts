import { useState, useCallback } from 'react';
import { useSocialStore } from '@/stores/useSocialStore';
import type { GeneratedOutfit, SharePlatform, PosterTemplate, Poster } from '@/types';
import { getShareConfig } from '@/services/shareService';
import { generateSimplePoster } from '@/utils/poster';
import { copyToClipboard } from '@/utils/deepLink';

export function useShareHandler() {
  const [isSharing, setIsSharing] = useState(false);
  const generatePoster = useSocialStore((s) => s.generatePoster);
  const shareToPlatform = useSocialStore((s) => s.shareToPlatform);
  const shareHistory = useSocialStore((s) => s.shareHistory);

  /** 生成分享海报 */
  const createPoster = useCallback(
    (outfit: GeneratedOutfit, template: PosterTemplate): Poster => {
      const imageDataUrl = generateSimplePoster(outfit, template);
      const poster: Poster = {
        id: `poster-${Date.now()}`,
        outfitId: outfit.id,
        templateId: template.id,
        imageDataUrl,
        createdAt: new Date().toISOString(),
      };
      generatePoster(poster);
      return poster;
    },
    [generatePoster]
  );

  /** 执行分享 */
  const shareOutfit = useCallback(
    async (outfit: GeneratedOutfit, platform: SharePlatform) => {
      setIsSharing(true);
      try {
        const config = await getShareConfig(outfit.id);

        switch (platform) {
          case 'wechat':
          case 'moments':
          case 'xiaohongshu':
            if (navigator.share) {
              await navigator.share({
                title: config.title,
                text: config.description,
                url: config.h5Url,
              });
            } else {
              await copyToClipboard(config.h5Url);
            }
            break;
          case 'copy_link':
            await copyToClipboard(config.h5Url);
            break;
          case 'save_image':
            break;
        }

        const posters = useSocialStore.getState().generatedPosters;
        const latestPoster = posters.find((p) => p.outfitId === outfit.id);
        if (latestPoster) {
          shareToPlatform(latestPoster.id, platform);
        }
      } catch (e) {
        console.error('Share failed:', e);
      } finally {
        setIsSharing(false);
      }
    },
    [shareToPlatform]
  );

  return { shareOutfit, createPoster, shareHistory, isSharing };
}
