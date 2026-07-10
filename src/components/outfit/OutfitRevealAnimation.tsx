import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OutfitRevealAnimationProps {
  isActive: boolean;
  onComplete: () => void;
}

const steps = [
  {
    key: 'analyze',
    title: '分析你的风格偏好...',
    subtitle: '正在读取你的穿搭数据',
    icon: '🔍',
    duration: 1500,
  },
  {
    key: 'match',
    title: '匹配今日天气与心情...',
    subtitle: '根据实时天气智能调整',
    icon: '🌤️',
    duration: 1500,
    floatingIcons: ['☀️', '🌧️', '❄️', '💨', '☁️'],
  },
  {
    key: 'select',
    title: '从银泰新品中精选搭配...',
    subtitle: '为你挑选最适合的单品',
    icon: '👗',
    duration: 1500,
    clothingItems: ['👚', '👖', '👠', '👜', '🧥', '👒'],
  },
  {
    key: 'ready',
    title: '✨ 你的今日穿搭已就绪',
    subtitle: '',
    icon: '',
    duration: 800,
    isFinal: true,
  },
];

export default function OutfitRevealAnimation({ isActive, onComplete }: OutfitRevealAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(0);
      return;
    }

    const advance = () => {
      setCurrentStep((prev) => {
        const next = prev + 1;
        if (next >= steps.length) {
          onComplete();
          return prev;
        }
        const timer = setTimeout(advance, steps[next].duration);
        return next;
      });
    };

    const timer = setTimeout(advance, steps[0].duration);
    return () => clearTimeout(timer);
  }, [isActive, onComplete]);

  if (!isActive) return null;

  const step = steps[Math.min(currentStep, steps.length - 1)];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.key}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: ['0vh', '-100vh'],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 5,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: 'linear',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-8 text-center">
          {/* Step progress indicator */}
          <div className="flex gap-2 mb-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.key}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i < currentStep
                    ? 'bg-pink-400 w-8'
                    : i === currentStep
                    ? 'bg-pink-400/70 w-8'
                    : 'bg-white/20 w-4'
                }`}
                layout
              />
            ))}
          </div>

          {/* Icon */}
          {step.icon && (
            <motion.div
              className="text-6xl mb-6"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              {step.icon}
            </motion.div>
          )}

          {/* Title */}
          <motion.h2
            className={`font-bold text-white mb-3 ${
              step.isFinal ? 'text-2xl' : 'text-xl'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {step.title}
          </motion.h2>

          {/* Subtitle */}
          {step.subtitle && (
            <motion.p
              className="text-sm text-white/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {step.subtitle}
            </motion.p>
          )}

          {/* Skeleton pulse (step 1) */}
          {step.key === 'analyze' && (
            <motion.div className="mt-6 w-48 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="h-3 rounded-full bg-white/10"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          )}

          {/* Weather icons floating (step 2) */}
          {'floatingIcons' in step && step.floatingIcons && (
            <div className="mt-8 flex gap-4">
              {step.floatingIcons.map((icon, i) => (
                <motion.span
                  key={i}
                  className="text-3xl"
                  animate={{
                    y: [0, -12, 0],
                    rotate: [0, -5, 5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.25,
                  }}
                >
                  {icon}
                </motion.span>
              ))}
            </div>
          )}

          {/* Clothing items animating (step 3) */}
          {'clothingItems' in step && step.clothingItems && (
            <div className="mt-8 grid grid-cols-3 gap-3">
              {step.clothingItems.map((item, i) => (
                <motion.span
                  key={i}
                  className="text-3xl"
                  initial={{ opacity: 0, scale: 0, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: i * 0.12,
                    type: 'spring',
                    stiffness: 300,
                    damping: 15,
                  }}
                >
                  {item}
                </motion.span>
              ))}
            </div>
          )}

          {/* Burst animation (step 4) */}
          {step.isFinal && (
            <motion.div
              className="mt-8 text-5xl"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🎉
              </motion.div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
