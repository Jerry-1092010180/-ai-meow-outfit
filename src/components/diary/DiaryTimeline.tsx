import { useState } from 'react';
import { motion } from 'framer-motion';
import type { GeneratedOutfit } from '../../types';
import StyleScore from '../outfit/StyleScore';
import Button from '../common/Button';

interface DiaryTimelineProps {
  outfits: GeneratedOutfit[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  onOutfitClick?: (outfit: GeneratedOutfit) => void;
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊', calm: '😌', energetic: '⚡', chill: '😎', romantic: '💕', confident: '💪',
};

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', windy: '💨',
};

const PAGE_SIZE = 5;

export default function DiaryTimeline({
  outfits,
  onLoadMore,
  hasMore = false,
  onOutfitClick,
}: DiaryTimelineProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const shownOutfits = outfits.slice(0, visibleCount);

  const handleLoadMore = () => {
    if (visibleCount < outfits.length) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    } else if (hasMore && onLoadMore) {
      onLoadMore();
    }
  };

  if (outfits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <span className="text-5xl mb-4">📸</span>
        <p className="text-sm">还没有穿搭日记</p>
        <p className="text-xs mt-1">去生成你的第一套AI穿搭吧</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-pink-300 via-purple-200 to-transparent" />

      <div className="space-y-6">
        {shownOutfits.map((outfit, idx) => {
          const date = new Date(outfit.createdAt);
          const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
          const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];

          return (
            <motion.div
              key={outfit.id}
              className="relative pl-10"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
            >
              {/* Timeline dot */}
              <div className="absolute left-2.5 top-6 w-3 h-3 rounded-full bg-pink-400 ring-4 ring-white z-10" />

              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-gray-800">
                  {dateStr}
                </span>
                <span className="text-xs text-gray-400">周{weekday}</span>
                <span className="text-lg">{MOOD_EMOJIS[outfit.mood]}</span>
                <span className="text-lg">{WEATHER_ICONS[outfit.weather.condition]}</span>
              </div>

              {/* Mini outfit card */}
              <motion.button
                className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                whileTap={{ scale: 0.98 }}
                onClick={() => onOutfitClick?.(outfit)}
              >
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    {outfit.sceneImage ? (
                      <img
                        src={outfit.sceneImage}
                        alt={outfit.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        👗
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate">
                      {outfit.name}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {outfit.styleDescription}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">
                        {outfit.weather.temperature}° {outfit.weather.city}
                      </span>
                      {outfit.linkedItems.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-500 font-medium">
                          {outfit.linkedItems.length}件在售
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="shrink-0">
                    <StyleScore score={outfit.styleScore} size={50} strokeWidth={4} />
                  </div>
                </div>
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* Load more */}
      {(visibleCount < outfits.length || hasMore) && (
        <div className="mt-6 pl-10">
          <Button
            variant="outline"
            fullWidth
            onClick={handleLoadMore}
          >
            加载更多
          </Button>
        </div>
      )}
    </div>
  );
}
