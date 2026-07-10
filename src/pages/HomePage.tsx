import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useOutfitStore } from '@/stores/useOutfitStore';
import { useOutfitGenerator } from '@/hooks/useOutfitGenerator';
import { useStreakTracker } from '@/hooks/useStreakTracker';
import { useDailyCheckIn } from '@/hooks/useDailyCheckIn';
import { useWeather } from '@/hooks/useWeather';
import OutfitCard from '@/components/outfit/OutfitCard';
import OutfitRevealAnimation from '@/components/outfit/OutfitRevealAnimation';
import MoodPicker from '@/components/outfit/MoodPicker';
import BuyThisLook from '@/components/outfit/BuyThisLook';
import StreakBadge from '@/components/common/StreakBadge';
import type { GeneratedOutfit, Mood } from '@/types';
import { track } from '@/utils/analytics';
import BottomNav from '@/components/common/BottomNav';

const weatherIcons: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', windy: '💨',
};

type Step = 'mood' | 'generating' | 'reveal';

export default function HomePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(() => {
    const outfit = useOutfitStore.getState().todayOutfit;
    return outfit ? 'reveal' : 'mood';
  });

  const todayOutfit = useOutfitStore((s) => s.todayOutfit);
  const { generate, isLoading } = useOutfitGenerator();
  const { streak } = useStreakTracker();
  const { hasCheckedInToday, checkIn } = useDailyCheckIn();
  const saveOutfit = useOutfitStore((s) => s.saveOutfit);
  const { weather, loading: weatherLoading } = useWeather();

  const handleMoodSelect = useCallback(
    async (mood: Mood) => {
      setStep('generating');
      track('outfit_generate', { mood });
      await generate(mood);
      setStep('reveal');
    },
    [generate]
  );

  const handleSave = useCallback(
    (outfit: GeneratedOutfit) => {
      saveOutfit(outfit);
      checkIn(outfit);
      track('outfit_save', { outfitId: outfit.id });
    },
    [saveOutfit, checkIn]
  );

  const handleRegenerate = useCallback(() => {
    setStep('mood');
  }, []);

  const handleShare = useCallback(
    (outfit: GeneratedOutfit) => {
      navigate(`${ROUTES.SHARE.replace(':outfitId', outfit.id)}`);
    },
    [navigate]
  );

  const handleBuy = useCallback(() => {
    navigate(ROUTES.STORE);
    track('purchase_click');
  }, [navigate]);

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <span className="text-lg font-bold bg-gradient-to-r from-pink-500 to-orange-400 bg-clip-text text-transparent">
              AI喵搭
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* 实时天气 */}
            {weather && !weatherLoading && (
              <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                <span>{weatherIcons[weather.condition]}</span>
                <span>{weather.temperature}°</span>
                <span className="text-gray-300">·</span>
                <span>{weather.city}</span>
              </div>
            )}
            <StreakBadge streak={streak} />
            <button
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm"
              onClick={() => navigate(ROUTES.PROFILE)}
            >
              👤
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {step === 'mood' && (
            <motion.div
              key="mood"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-6">
                {/* 天气驱动每日钩子 */}
                {weather && (
                  <motion.div
                    className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-50 to-pink-50 border border-pink-100 mb-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <span className="text-2xl">{weatherIcons[weather.condition]}</span>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-700">
                        {weather.city} · {weather.temperature}°C · {weather.condition === 'rainy' ? '下雨天' : weather.condition === 'sunny' ? '晴天' : weather.condition === 'cloudy' ? '多云' : weather.condition === 'snowy' ? '下雪' : '有风'}
                      </p>
                      <p className="text-xs text-gray-400">
                        湿度 {weather.humidity}% · {weather.season === 'summer' ? '夏季' : weather.season === 'winter' ? '冬季' : weather.season === 'spring' ? '春季' : '秋季'}穿搭推荐
                      </p>
                    </div>
                  </motion.div>
                )}
                <motion.h1
                  className="text-2xl font-bold text-gray-800 mb-2"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {hasCheckedInToday
                    ? '想换一套新穿搭？'
                    : weather
                    ? `今日${weather.city}${weather.temperature}°C，AI为你推荐穿搭`
                    : '今天心情如何？'}
                </motion.h1>
                <p className="text-gray-400 text-sm">
                  选一个心情，AI根据天气、门店新品和你的风格为你搭配
                </p>
              </div>
              <MoodPicker value={null} onChange={handleMoodSelect} />
            </motion.div>
          )}

          {step === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OutfitRevealAnimation
                isActive={isLoading}
                onComplete={() => setStep('reveal')}
              />
            </motion.div>
          )}

          {step === 'reveal' && todayOutfit && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            >
              <OutfitCard
                outfit={todayOutfit}
                revealMode={!hasCheckedInToday && step === 'reveal'}
                onSave={handleSave}
                onShare={handleShare}
                onRegenerate={handleRegenerate}
                onBuy={handleBuy}
              />

              {/* Buy this look panel */}
              {todayOutfit.linkedItems.length > 0 && (
                <div className="mt-4">
                  <BuyThisLook
                    items={todayOutfit.linkedItems}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}
