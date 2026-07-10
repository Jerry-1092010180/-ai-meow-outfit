import { motion } from 'framer-motion';

interface LoadingProps {
  variant?: 'spinner' | 'skeleton';
  /** Number of skeleton blocks to show */
  skeletonCount?: number;
  className?: string;
}

export default function Loading({ variant = 'spinner', skeletonCount = 3, className = '' }: LoadingProps) {
  if (variant === 'skeleton') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <motion.div
            key={i}
            className="h-4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]"
            style={{ width: `${80 - i * 15}%` }}
            animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: i * 0.15 }}
          />
        ))}
        <motion.div
          className="h-24 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] mt-4"
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      {/* Animated circle */}
      <div className="relative w-20 h-20">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-pink-400 border-r-orange-300"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-4 border-transparent border-b-orange-400 border-l-pink-300"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-4 rounded-full border-4 border-transparent border-t-pink-300 border-r-orange-200"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
        {/* Cat paw icon center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-pink-400">
            <motion.path
              d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"
              fill="currentColor"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <circle cx="8.5" cy="10" r="1.5" fill="white" />
            <circle cx="15.5" cy="10" r="1.5" fill="white" />
            <motion.path
              d="M8 14c0 0 1.5 2 4 2s4-2 4-2"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              animate={{ pathLength: [0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      <motion.p
        className="text-sm text-gray-500 font-medium"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        AI搭配中...
      </motion.p>
    </div>
  );
}
