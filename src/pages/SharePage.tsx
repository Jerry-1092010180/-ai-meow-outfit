import { useParams, useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useOutfitStore } from '@/stores/useOutfitStore';
import { useShareHandler } from '@/hooks/useShareHandler';
import { usePosterComposer } from '@/hooks/usePosterComposer';
import { getPosterTemplates } from '@/services/shareService';
import type { SharePlatform } from '@/types';

export default function SharePage() {
  const { outfitId } = useParams<{ outfitId: string }>();
  const navigate = useNavigate();
  const todayOutfit = useOutfitStore((s) => s.todayOutfit);
  const diary = useOutfitStore((s) => s.diary);
  const outfit = todayOutfit?.id === outfitId
    ? todayOutfit
    : Object.values(diary).find((o) => o.id === outfitId);

  const [selectedTemplate, setSelectedTemplate] = useState('magazine');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const { createPoster, shareOutfit, isSharing } = useShareHandler();
  const { compose } = usePosterComposer();
  const templates = getPosterTemplates();

  const handleGeneratePoster = async () => {
    if (!outfit) return;
    const template = templates.find((t) => t.id === selectedTemplate) || templates[0];
    const dataUrl = await compose(outfit, template);
    if (dataUrl) {
      createPoster(outfit, template);
      setPosterUrl(dataUrl);
    }
  };

  const handleShare = async (platform: SharePlatform) => {
    if (!outfit) return;
    await shareOutfit(outfit, platform);
  };

  const handleCopyLink = async () => {
    if (!outfit) return;
    await shareOutfit(outfit, 'copy_link');
    alert('链接已复制！分享给你的好友吧 ✨');
  };

  const handleSaveImage = () => {
    if (!posterUrl) return;
    const link = document.createElement('a');
    link.download = `AI喵搭-${outfit?.name || '穿搭'}.png`;
    link.href = posterUrl;
    link.click();
    shareOutfit(outfit!, 'save_image');
  };

  if (!outfit) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <span className="text-4xl mb-4">👗</span>
        <p className="text-gray-500">找不到这套穿搭</p>
        <button
          className="mt-4 text-pink-500 font-medium"
          onClick={() => navigate(ROUTES.HOME)}
        >
          回到首页
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button className="text-gray-500" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-gray-800">分享穿搭</h1>
        </div>
      </header>

      <div className="px-4 pt-4">
        {/* Poster preview */}
        <div className="mb-6">
          <div
            ref={posterRef}
            className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-pink-400 to-orange-400"
          >
            {posterUrl ? (
              <img
                src={posterUrl}
                alt="分享海报"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white">
                <span className="text-6xl mb-4">🐱</span>
                <p className="text-lg font-bold mb-2">{outfit.name}</p>
                <p className="text-sm opacity-80">风格评分: {outfit.styleScore}</p>
                <p className="text-xs opacity-60 mt-4">点击下方按钮生成海报</p>
              </div>
            )}
          </div>
        </div>

        {/* Template selector */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-500 mb-3">海报模板</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {templates.map((template) => (
              <motion.button
                key={template.id}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedTemplate === template.id
                    ? 'bg-pink-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600'
                }`}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedTemplate(template.id)}
              >
                {template.name}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <motion.button
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold shadow-lg shadow-pink-500/20"
            whileTap={{ scale: 0.96 }}
            onClick={handleGeneratePoster}
          >
            ✨ 生成海报
          </motion.button>

          {posterUrl && (
            <motion.div
              className="space-y-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="py-2.5 rounded-xl bg-green-50 text-green-600 font-medium text-sm"
                  onClick={() => handleShare('wechat')}
                  disabled={isSharing}
                >
                  💬 微信好友
                </button>
                <button
                  className="py-2.5 rounded-xl bg-green-50 text-green-600 font-medium text-sm"
                  onClick={() => handleShare('moments')}
                  disabled={isSharing}
                >
                  🟢 朋友圈
                </button>
                <button
                  className="py-2.5 rounded-xl bg-red-50 text-red-500 font-medium text-sm"
                  onClick={() => handleShare('xiaohongshu')}
                  disabled={isSharing}
                >
                  📕 小红书
                </button>
                <button
                  className="py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm"
                  onClick={handleSaveImage}
                >
                  💾 保存图片
                </button>
              </div>
              <button
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium"
                onClick={handleCopyLink}
              >
                🔗 复制链接
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
