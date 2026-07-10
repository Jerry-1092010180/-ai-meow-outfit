import { motion } from 'framer-motion';
import type { Mood } from '../../types';

interface MoodOption {
  value: Mood;
  emoji: string;
  label: string;
}

const moods: MoodOption[] = [
  { value: 'happy', emoji: '😊', label: '开心' },
  { value: 'calm', emoji: '😌', label: '平静' },
  { value: 'energetic', emoji: '⚡', label: '活力' },
  { value: 'chill', emoji: '😎', label: '随性' },
  { value: 'romantic', emoji: '💕', label: '浪漫' },
  { value: 'confident', emoji: '💪', label: '自信' },
];

interface MoodPickerProps {
  value: Mood | null;
  onChange: (mood: Mood) => void;
}

export default function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {moods.map((mood) => {
        const isSelected = value === mood.value;

        return (
          <motion.button
            key={mood.value}
            layoutId={isSelected ? `mood-selected-${mood.value}` : undefined}
            onClick={() => onChange(mood.value)}
            whileTap={{ scale: 0.92 }}
            className={`
              relative flex flex-col items-center justify-center gap-2
              py-5 rounded-2xl cursor-pointer select-none
              transition-colors duration-200
              ${isSelected ? 'bg-gradient-to-br from-pink-50 to-orange-50' : 'bg-gray-50 hover:bg-gray-100'}
            `}
          >
            {/* Glow ring when selected */}
            {isSelected && (
              <motion.div
                className="absolute inset-0 rounded-2xl ring-2 ring-pink-400 ring-offset-1 ring-offset-white"
                layoutId="mood-ring"
                initial={false}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {/* Emoji */}
            <motion.span
              className="text-3xl leading-none"
              animate={isSelected ? { scale: 1.15 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {mood.emoji}
            </motion.span>

            {/* Label */}
            <span
              className={`text-xs font-medium ${
                isSelected ? 'text-pink-500' : 'text-gray-500'
              }`}
            >
              {mood.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
