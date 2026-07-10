import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { GeneratedOutfit } from '../../types';
import Modal from '../common/Modal';

interface OutfitCalendarProps {
  outfits: GeneratedOutfit[];
  year?: number;
  month?: number; // 0-indexed (0 = Jan)
  onDayClick?: (date: string) => void;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊', calm: '😌', energetic: '⚡', chill: '😎', romantic: '💕', confident: '💪',
};

export default function OutfitCalendar({
  outfits,
  year: propYear,
  month: propMonth,
  onDayClick,
}: OutfitCalendarProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(propYear ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(propMonth ?? now.getMonth());
  const [selectedOutfit, setSelectedOutfit] = useState<GeneratedOutfit | null>(null);

  const today = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();
  const isCurrentMonth = viewMonth === todayMonth && viewYear === todayYear;

  // Build outfit map by date
  const outfitMap = useMemo(() => {
    const map = new Map<string, GeneratedOutfit>();
    outfits.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, o);
    });
    return map;
  }, [outfits]);

  // Compute streak
  const streakDays = useMemo(() => {
    const days = new Set<string>();
    let check = new Date();
    while (true) {
      const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
      if (outfitMap.has(key)) {
        days.add(key);
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
    return days;
  }, [outfitMap]);

  // Calendar math
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="text-base font-bold text-gray-900">
          {viewYear}年{viewMonth + 1}月
        </h3>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-gray-400 py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${viewYear}-${viewMonth}-${day}`;
          const outfit = outfitMap.get(dateKey);
          const isToday = isCurrentMonth && day === today;
          const isStreak = streakDays.has(dateKey);

          return (
            <motion.button
              key={day}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (outfit) {
                  setSelectedOutfit(outfit);
                  onDayClick?.(dateKey);
                }
              }}
              className={`
                aspect-square rounded-xl flex flex-col items-center justify-center
                text-sm font-medium transition-colors relative
                ${isToday ? 'bg-pink-500 text-white shadow-md shadow-pink-200' : 'hover:bg-gray-50'}
                ${isStreak && !isToday ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
                ${outfit ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              {outfit ? (
                <>
                  <span className="text-xl leading-none">
                    {MOOD_EMOJIS[outfit.mood] || '👗'}
                  </span>
                  <span className={`text-[10px] mt-0.5 ${isToday ? 'text-white' : 'text-gray-600'}`}>
                    {day}
                  </span>
                </>
              ) : (
                <span className={isToday ? 'text-white' : 'text-gray-600'}>{day}</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected outfit modal */}
      <Modal isOpen={!!selectedOutfit} onClose={() => setSelectedOutfit(null)} title="穿搭详情">
        {selectedOutfit && (
          <div className="space-y-3">
            {selectedOutfit.sceneImage && (
              <img
                src={selectedOutfit.sceneImage}
                alt={selectedOutfit.name}
                className="w-full aspect-[3/4] object-cover rounded-xl"
              />
            )}
            <h4 className="font-bold text-gray-900">{selectedOutfit.name}</h4>
            <div className="flex gap-2 text-sm">
              <span>{MOOD_EMOJIS[selectedOutfit.mood]}</span>
              <span className="text-gray-500">{selectedOutfit.styleDescription}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">风格分：</span>
              <span className="font-bold text-pink-500">{selectedOutfit.styleScore}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
