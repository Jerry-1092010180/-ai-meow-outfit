import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/common/BottomNav';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useShareHandler } from '@/hooks/useShareHandler';
import Model3DViewer, { OUTFITS } from '@/components/outfit/Model3DViewer';
import type { SharePlatform } from '@/types';

type TryOnStep = 'upload' | 'processing' | 'result';

export default function TryOnPage() {
  const navigate = useNavigate();
  const { shareOutfit, isSharing } = useShareHandler();
  const [step, setStep] = useState<TryOnStep>('result'); // 直接展示3D
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [currentOutfitName, setCurrentOutfitName] = useState(OUTFITS[0].name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
      setStep('processing');
      setTimeout(() => setStep('result'), 2500);
    };
    reader.readAsDataURL(file);
  };

  const handleShare = async (platform: SharePlatform) => {
    // 分享3D穿搭
    if (navigator.share) {
      try {
        await navigator.share({
          title: `AI喵搭 - ${currentOutfitName}`,
          text: `我正在AI喵搭试穿${currentOutfitName}，360°查看穿搭效果！`,
          url: window.location.href,
        });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('链接已复制！');
    }
  };

  const weatherIcons: Record<string, string> = {
    wechat: '💬',
    moments: '🟢',
    xiaohongshu: '📕',
    copy_link: '🔗',
    save_image: '💾',
  };

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            className="text-gray-400 text-sm"
            onClick={() => navigate(-1)}
          >
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-white">AI 3D 虚拟试穿</h1>
          <button
            className="text-sm text-pink-400 font-medium"
            onClick={() => {
              setStep('upload');
              setPhotoPreview(null);
            }}
          >
            {step === 'result' ? '拍照' : ''}
          </button>
        </div>
      </header>

      <div className="px-2 pt-2">
        <AnimatePresence mode="wait">
          {/* Step 1: 拍照上传 */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center mb-6 mt-4">
                <motion.div
                  className="text-6xl mb-4"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  📸
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">
                  AI 3D 虚拟试穿
                </h2>
                <p className="text-gray-400 text-sm max-w-xs mx-auto">
                  上传照片后，AI 将为你创建
                  <span className="text-pink-400 font-medium">
                    {' '}
                    3D 数字分身
                  </span>
                  ，穿上各种穿搭，支持
                  <span className="text-pink-400 font-medium"> 360°旋转</span>、
                  <span className="text-pink-400 font-medium"> 缩放</span> 查看
                </p>
              </div>

              <div className="mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                {photoPreview ? (
                  <motion.div
                    className="relative w-full rounded-2xl overflow-hidden"
                    style={{ aspectRatio: '3/4' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <img
                      src={photoPreview}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                ) : (
                  <motion.button
                    className="w-full rounded-2xl border-2 border-dashed border-white/20 hover:border-pink-400/50 transition-colors flex flex-col items-center justify-center py-16"
                    style={{ aspectRatio: '3/4' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mb-4">
                      <span className="text-2xl">📷</span>
                    </div>
                    <p className="text-white/60 text-sm">点击拍照或选择照片</p>
                    <p className="text-white/30 text-xs mt-1">
                      支持 JPG/PNG，建议全身照
                    </p>
                  </motion.button>
                )}
              </div>

              {!photoPreview && (
                <motion.button
                  className="w-full py-3 rounded-xl bg-white/5 text-white/40 text-sm"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep('result')}
                >
                  跳过拍照，直接体验3D试穿 →
                </motion.button>
              )}
            </motion.div>
          )}

          {/* Step 2: AI 建模处理 */}
          {step === 'processing' && (
            <motion.div
              key="processing"
              className="flex flex-col items-center justify-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {photoPreview && (
                <div className="w-32 h-40 rounded-2xl overflow-hidden mb-8 opacity-40">
                  <img
                    src={photoPreview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <motion.div
                className="text-5xl mb-6"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                ✨
              </motion.div>

              <div className="space-y-4 text-center">
                {[
                  { text: '🔍 分析体型与骨骼...', d: 0 },
                  { text: '🎨 生成3D数字分身...', d: 800 },
                  { text: '👗 AI匹配门店新品...', d: 1600 },
                  { text: '✨ 试穿效果已就绪', d: 2200, last: true },
                ].map((item) => (
                  <motion.p
                    key={item.text}
                    className={`text-sm ${
                      item.last
                        ? 'text-pink-400 font-bold text-base'
                        : 'text-white/50'
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: item.d / 1000,
                      duration: 0.5,
                    }}
                  >
                    {item.text}
                  </motion.p>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: 3D 试穿结果 */}
          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Model3DViewer
                outfitId="casual"
                onOutfitChange={(outfit) =>
                  setCurrentOutfitName(outfit.name)
                }
              />

              {/* 操作按钮 */}
              <div className="mt-4 flex gap-3">
                {(
                  [
                    { p: 'wechat', label: '微信', icon: '💬' },
                    { p: 'moments', label: '朋友圈', icon: '🟢' },
                    { p: 'copy_link', label: '复制链接', icon: '🔗' },
                  ] as { p: SharePlatform; label: string; icon: string }[]
                ).map(({ p, label, icon }) => (
                  <motion.button
                    key={p}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/70 text-xs font-medium flex items-center justify-center gap-1.5"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleShare(p)}
                    disabled={isSharing}
                  >
                    {icon} {label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
    </div>
  );
}
