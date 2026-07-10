import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface StyleScoreProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

function getColor(score: number): { start: string; end: string } {
  if (score >= 80) return { start: '#10b981', end: '#34d399' };
  if (score >= 60) return { start: '#f59e0b', end: '#fbbf24' };
  return { start: '#ef4444', end: '#f87171' };
}

function getLabel(score: number): string {
  if (score >= 90) return '完美';
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '待提升';
}

export default function StyleScore({ score, size = 100, strokeWidth = 6 }: StyleScoreProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const animRef = useRef<number>(0);

  const center = size / 2;
  const radius = center - strokeWidth - 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (displayScore / 100) * circumference;
  const colors = getColor(score);

  // Count-up animation
  useEffect(() => {
    let rafId: number;
    const duration = 1200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  return (
    <motion.div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 250, damping: 18 }}
    >
      {/* Background circle */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
      </svg>

      {/* Gradient arc */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
      >
        <defs>
          <linearGradient id={`scoreGradient-${String(score)}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#scoreGradient-${String(score)})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-extrabold text-gray-900"
          key={displayScore}
        >
          {displayScore}
        </motion.span>
        <span className="text-[10px] text-gray-400 font-medium mt-0.5">
          {getLabel(displayScore)}
        </span>
      </div>
    </motion.div>
  );
}
