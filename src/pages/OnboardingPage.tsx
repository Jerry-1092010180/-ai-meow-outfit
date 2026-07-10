import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useUserStore } from '@/stores/useUserStore';
import type { BodyType, StyleTag, ColorPreference } from '@/types';
import { BODY_TYPES, STYLE_TAGS, COLOR_PREFERENCES } from '@/config/constants';
import { track } from '@/utils/analytics';

/** 身型可视化图标：用CSS形状替代不准确的emoji */
function BodyTypeIcon({ type }: { type: BodyType }) {
  const baseClasses = 'mx-auto';
  switch (type) {
    case 'apple':
      return <span className={baseClasses}>🍎</span>;
    case 'pear':
      return <span className={baseClasses}>🍐</span>;
    case 'hourglass':
      return <span className={baseClasses}>⏳</span>;
    case 'rectangle':
      // 矩形身材用CSS矩形代替错误的📐三角板
      return (
        <div className="mx-auto w-7 h-9 rounded-sm border-2 border-current opacity-70" />
      );
    case 'inverted_triangle':
      // 倒三角：CSS三角形
      return (
        <div
          className="mx-auto"
          style={{
            width: 0,
            height: 0,
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: '18px solid currentColor',
            opacity: 0.7,
          }}
        />
      );
    default:
      return <span className={baseClasses}>👤</span>;
  }
}

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const setProfile = useUserStore((s) => s.setProfile);
  const [step, setStep] = useState<Step>(1);
  const [bodyType, setBodyType] = useState<BodyType>('hourglass');
  const [styleTags, setStyleTags] = useState<StyleTag[]>([]);
  const [colorPrefs, setColorPrefs] = useState<ColorPreference[]>([]);
  const [preferredStore, setPreferredStore] = useState('store-hzwl');

  const stores = [
    { id: 'store-hzwl', name: '杭州武林银泰', city: '杭州' },
    { id: 'store-hzxh', name: '杭州西湖银泰', city: '杭州' },
    { id: 'store-nbdm', name: '宁波东门银泰', city: '宁波' },
    { id: 'store-nbty', name: '宁波天一银泰', city: '宁波' },
    { id: 'store-hzcx', name: '杭州城西银泰', city: '杭州' },
  ];

  const toggleStyleTag = (tag: StyleTag) => {
    setStyleTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleColor = (color: ColorPreference) => {
    setColorPrefs((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const handleComplete = () => {
    const id = `user-${Date.now()}`;
    setProfile({
      id,
      nickname: '喵街会员',
      avatar: '',
      bodyType,
      styleTags: styleTags.length > 0 ? styleTags : ['minimalist', 'street'],
      colorPreferences: colorPrefs.length > 0 ? colorPrefs : ['warm', 'neutral'],
      height: 165,
      preferredStore,
      onboardedAt: new Date().toISOString(),
      miaojieMemberId: '',
    });
    track('onboarding_complete');
    navigate(ROUTES.HOME, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col safe-top safe-bottom">
      {/* Progress bar */}
      <div className="px-4 pt-6">
        <div className="flex gap-1 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                s <= step ? 'bg-pink-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-4">
        <AnimatePresence mode="wait">
          {/* Step 1: Body Type */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">选择你的身型</h2>
              <p className="text-sm text-gray-400 mb-6">AI将根据身型为你推荐最合适的穿搭</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(BODY_TYPES).map(([key, label]) => (
                  <motion.button
                    key={key}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      bodyType === key
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setBodyType(key as BodyType)}
                  >
                    <div className="text-2xl mb-1">
                      <BodyTypeIcon type={key as BodyType} />
                    </div>
                    <div className="text-sm font-medium text-gray-700">{label}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Style Preferences */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">你喜欢什么风格？</h2>
              <p className="text-sm text-gray-400 mb-6">多选，至少选1个</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STYLE_TAGS).map(([key, label]) => (
                  <motion.button
                    key={key}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                      styleTags.includes(key as StyleTag)
                        ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleStyleTag(key as StyleTag)}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">色调偏好</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COLOR_PREFERENCES).map(([key, label]) => (
                    <motion.button
                      key={key}
                      className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                        colorPrefs.includes(key as ColorPreference)
                          ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleColor(key as ColorPreference)}
                    >
                      {label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Store */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <h2 className="text-xl font-bold text-gray-800 mb-2">选择你常去的银泰门店</h2>
              <p className="text-sm text-gray-400 mb-6">AI会优先推荐该门店在售商品</p>
              <div className="space-y-3">
                {stores.map((store) => (
                  <motion.button
                    key={store.id}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                      preferredStore === store.id
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPreferredStore(store.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{store.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{store.city}</div>
                      </div>
                      {preferredStore === store.id && (
                        <span className="text-pink-500 text-lg">✓</span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom buttons */}
      <div className="px-4 py-6 border-t border-gray-100">
        <div className="flex gap-3">
          {step > 1 && (
            <button
              className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium"
              onClick={() => setStep((s) => (s - 1) as Step)}
            >
              上一步
            </button>
          )}
          <button
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold shadow-lg shadow-pink-500/20"
            onClick={() => {
              if (step < 3) {
                setStep((s) => (s + 1) as Step);
              } else {
                handleComplete();
              }
            }}
          >
            {step === 3 ? '✨ 开始AI穿搭之旅' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
