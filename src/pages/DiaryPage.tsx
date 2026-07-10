import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useOutfitStore } from '@/stores/useOutfitStore';
import { useStreakTracker } from '@/hooks/useStreakTracker';
import OutfitCalendar from '@/components/diary/OutfitCalendar';
import DiaryTimeline from '@/components/diary/DiaryTimeline';
import StreakBadge from '@/components/common/StreakBadge';
import type { GeneratedOutfit } from '@/types';

type Tab = 'calendar' | 'timeline';

export default function DiaryPage() {
  const navigate = useNavigate();
  const diary = useOutfitStore((s) => s.diary);
  const history = useOutfitStore((s) => s.history);
  const { streak } = useStreakTracker();
  const [activeTab, setActiveTab] = useState<Tab>('timeline');

  const diaryEntries = useMemo(
    () => Object.entries(diary).sort((a, b) => b[0].localeCompare(a[0])),
    [diary]
  );

  const totalOutfits = diaryEntries.length;
  const sortedOutfits = useMemo(
    () => Object.values(diary).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [diary]
  );

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            className="text-gray-500 text-sm"
            onClick={() => navigate(-1)}
          >
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-gray-800">穿搭日记</h1>
          <StreakBadge streak={streak} />
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-around px-4 pb-3">
          <div className="text-center">
            <div className="text-lg font-bold text-pink-500">{totalOutfits}</div>
            <div className="text-xs text-gray-400">总搭配</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-500">{streak}</div>
            <div className="text-xs text-gray-400">连续打卡</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-500">
              {Math.round(
                diaryEntries.length > 0
                  ? diaryEntries.reduce((sum, [, o]) => sum + o.styleScore, 0) / diaryEntries.length
                  : 0
              )}
            </div>
            <div className="text-xs text-gray-400">平均评分</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-t border-gray-100">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'text-pink-500 border-b-2 border-pink-500'
                : 'text-gray-400'
            }`}
            onClick={() => setActiveTab('timeline')}
          >
            时间线
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'text-pink-500 border-b-2 border-pink-500'
                : 'text-gray-400'
            }`}
            onClick={() => setActiveTab('calendar')}
          >
            日历视图
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 pt-4">
        {activeTab === 'timeline' ? (
          diaryEntries.length > 0 ? (
            <DiaryTimeline
              outfits={sortedOutfits}
            />
          ) : (
            <EmptyState onGoHome={() => navigate(ROUTES.HOME)} />
          )
        ) : (
          <OutfitCalendar outfits={Object.values(diary)} />
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
}

function EmptyState({ onGoHome }: { onGoHome: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span className="text-6xl mb-4">📖</span>
      <h3 className="text-lg font-bold text-gray-700 mb-2">还没有穿搭记录</h3>
      <p className="text-sm text-gray-400 mb-6">
        去生成你的第一套AI穿搭吧！
      </p>
      <button
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold shadow-lg shadow-pink-500/20"
        onClick={onGoHome}
      >
        去生成穿搭
      </button>
    </motion.div>
  );
}

import { ROUTES as R } from '@/config/routes';
import BottomNav from '@/components/common/BottomNav';


