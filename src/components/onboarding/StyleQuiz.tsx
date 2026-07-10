import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BodyType, StyleTag } from '../../types';
import Button from '../common/Button';

interface StyleQuizProps {
  onComplete: (answers: StyleQuizAnswers) => void;
}

export interface StyleQuizAnswers {
  bodyType: BodyType;
  styleTags: StyleTag[];
  preferredStore: string;
}

const bodyTypes: { value: BodyType; label: string; description: string; shape: string }[] = [
  { value: 'apple', label: '苹果型', description: '上半身较丰满，四肢纤细', shape: '🍎' },
  { value: 'pear', label: '梨型', description: '下半身较丰满，上半身纤细', shape: '🍐' },
  { value: 'hourglass', label: '沙漏型', description: '肩宽与胯宽相近，腰细', shape: '⏳' },
  { value: 'rectangle', label: '矩形', description: '肩腰胯宽度相近，线条直', shape: '📏' },
  { value: 'inverted_triangle', label: '倒三角', description: '肩宽大于胯宽', shape: '🔻' },
];

const styleTags: { value: StyleTag; label: string; emoji: string }[] = [
  { value: 'minimalist', label: '极简', emoji: '🤍' },
  { value: 'street', label: '街头', emoji: '🛹' },
  { value: 'elegant', label: '优雅', emoji: '🌹' },
  { value: 'vintage', label: '复古', emoji: '📻' },
  { value: 'sporty', label: '运动', emoji: '🏃' },
  { value: 'romantic', label: '甜美', emoji: '🎀' },
  { value: 'business', label: '职场', emoji: '💼' },
  { value: 'korean', label: '韩系', emoji: '🇰🇷' },
];

const stores = [
  { id: 'intime_hz', name: '杭州武林银泰', city: '杭州' },
  { id: 'intime_sh', name: '上海徐汇银泰', city: '上海' },
  { id: 'intime_bj', name: '北京王府井银泰', city: '北京' },
  { id: 'intime_cd', name: '成都IFS银泰', city: '成都' },
  { id: 'intime_sz', name: '深圳海岸城银泰', city: '深圳' },
  { id: 'intime_gz', name: '广州天河银泰', city: '广州' },
];

const TOTAL_STEPS = 3;

export default function StyleQuiz({ onComplete }: StyleQuizProps) {
  const [step, setStep] = useState(0);
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [selectedTags, setSelectedTags] = useState<StyleTag[]>([]);
  const [preferredStore, setPreferredStore] = useState('');

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const toggleTag = (tag: StyleTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete({
        bodyType: bodyType!,
        styleTags: selectedTags,
        preferredStore,
      });
    }
  };

  const canProceed = () => {
    if (step === 0) return bodyType !== null;
    if (step === 1) return selectedTags.length > 0;
    return preferredStore !== '';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">
            步骤 {step + 1} / {TOTAL_STEPS}
          </span>
          <span className="text-xs text-gray-400">
            {step === 0 ? '选择身型' : step === 1 ? '风格偏好' : '常逛门店'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-pink-400 to-orange-400"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ====== Step 1: Body Type ====== */}
        {step === 0 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-1">你的身型是？</h2>
            <p className="text-sm text-gray-400 mb-6">帮助我们推荐更适合的版型</p>

            <div className="space-y-3">
              {bodyTypes.map((bt) => (
                <motion.button
                  key={bt.value}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setBodyType(bt.value)}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all
                    ${bodyType === bt.value
                      ? 'border-pink-400 bg-pink-50 shadow-md shadow-pink-100'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                    }
                  `}
                >
                  <span className="text-3xl">{bt.shape}</span>
                  <div className="text-left flex-1">
                    <p className={`font-semibold ${bodyType === bt.value ? 'text-pink-600' : 'text-gray-800'}`}>
                      {bt.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{bt.description}</p>
                  </div>
                  {bodyType === bt.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ====== Step 2: Style Tags ====== */}
        {step === 1 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-1">你喜欢什么风格？</h2>
            <p className="text-sm text-gray-400 mb-2">可多选，至少选1个</p>

            {selectedTags.length > 0 && (
              <p className="text-xs text-pink-500 mb-4">已选 {selectedTags.length} 个</p>
            )}

            <div className="flex flex-wrap gap-2.5">
              {styleTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.value);
                return (
                  <motion.button
                    key={tag.value}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleTag(tag.value)}
                    layout
                    className={`
                      inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium
                      transition-colors cursor-pointer select-none
                      ${isSelected
                        ? 'bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-lg shadow-pink-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                  >
                    <span>{tag.emoji}</span>
                    <span>{tag.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ====== Step 3: Store Picker ====== */}
        {step === 2 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-1">你最常逛哪个门店？</h2>
            <p className="text-sm text-gray-400 mb-6">我们会优先推荐这个门店的在售商品</p>

            <div className="space-y-2.5">
              {stores.map((store) => (
                <motion.button
                  key={store.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPreferredStore(store.id)}
                  className={`
                    w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all
                    ${preferredStore === store.id
                      ? 'border-pink-400 bg-pink-50 shadow-md shadow-pink-100'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                    }
                  `}
                >
                  {/* Store icon placeholder */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-lg shrink-0">
                    🏬
                  </div>

                  <div className="text-left flex-1">
                    <p className={`text-sm font-semibold ${preferredStore === store.id ? 'text-pink-600' : 'text-gray-800'}`}>
                      {store.name}
                    </p>
                    <p className="text-xs text-gray-400">{store.city}</p>
                  </div>

                  {preferredStore === store.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
          >
            上一步
          </Button>
        )}
        <Button
          fullWidth={step === 0}
          disabled={!canProceed()}
          onClick={handleNext}
        >
          {step < TOTAL_STEPS - 1 ? '下一步' : '完成 ✨'}
        </Button>
      </div>
    </div>
  );
}
