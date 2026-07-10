import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface StreakBadgeProps {
  streak: number;
}

const milestones = new Set([7, 30, 100]);

export default function StreakBadge({ streak }: StreakBadgeProps) {
  const isMilestone = milestones.has(streak);

  const fireVariants = useMemo(
    () => ({
      animate: streak > 0
        ? {
            scale: [1, 1.15, 1],
            rotate: [0, -5, 5, -3, 0],
          }
        : {},
    }),
    [streak],
  );

  const fireTransition = {
    duration: 1.2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  };

  return (
    <motion.div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200"
      animate={isMilestone ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.6, repeat: isMilestone ? Infinity : 0, repeatDelay: 1.5 }}
    >
      {/* Fire emoji */}
      <motion.span
        className="text-xl leading-none"
        variants={fireVariants}
        animate="animate"
        transition={fireTransition}
      >
        {streak > 0 ? '🔥' : '💤'}
      </motion.span>

      {/* Count */}
      <span className="text-sm font-bold text-orange-600">
        {streak}
      </span>

      {/* Label */}
      <span className="text-xs text-orange-500 font-medium">连续打卡</span>

      {/* Milestone sparkle */}
      {isMilestone && (
        <motion.span
          className="text-sm"
          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          ⭐
        </motion.span>
      )}
    </motion.div>
  );
}
