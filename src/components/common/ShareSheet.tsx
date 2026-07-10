import { motion, AnimatePresence } from 'framer-motion';
import type { SharePlatform } from '../../types';
import { useNotificationStore } from '../../stores/useNotificationStore';

interface ShareOption {
  platform: SharePlatform;
  label: string;
  icon: string; // SVG path data
  color: string;
}

const shareOptions: ShareOption[] = [
  {
    platform: 'wechat',
    label: '微信',
    icon: 'M8.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM15.5 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM2 8.5C2 5.5 4.5 3 7.5 3h9c3 0 5.5 2.5 5.5 5.5 0 2-1 3.5-2.5 4.5L20 18l-4.5-2.5c-.5.1-1 .2-1.5.2-.5 0-1-.1-1.5-.2l-1 .5H7.5C4.5 16 2 13.5 2 10.5V8.5z',
    color: 'bg-green-500',
  },
  {
    platform: 'moments',
    label: '朋友圈',
    icon: 'M3 3h18v18H3V3zm8 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 2c-1.5 0-3.5 2-3.5 2v1h7v-1s-2-2-3.5-2zM14 9a1 1 0 100-2 1 1 0 000 2zm3 1.5a2 2 0 11-4 0 2 2 0 014 0zm-1 2c-1 0-2.5 1.5-2.5 1.5V15h5v-.5S17.5 12.5 16 12.5z',
    color: 'bg-cyan-500',
  },
  {
    platform: 'xiaohongshu',
    label: '小红书',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z',
    color: 'bg-red-500',
  },
  {
    platform: 'copy_link',
    label: '复制链接',
    icon: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
    color: 'bg-gray-500',
  },
  {
    platform: 'save_image',
    label: '保存图片',
    icon: 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3',
    color: 'bg-violet-500',
  },
];

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
}

export default function ShareSheet({
  isOpen,
  onClose,
  title = 'AI喵搭',
  description = '来看看AI为我搭配的今日穿搭！',
  imageUrl = '',
  url = typeof window !== 'undefined' ? window.location.href : '',
}: ShareSheetProps) {
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleShare = async (platform: SharePlatform) => {
    switch (platform) {
      case 'wechat':
      case 'moments':
      case 'xiaohongshu':
        if (navigator.share) {
          try {
            await navigator.share({ title, text: description, url });
          } catch { /* user cancelled */ }
        } else {
          await navigator.clipboard.writeText(url);
          addNotification('链接已复制到剪贴板', 'success');
        }
        break;
      case 'copy_link':
        await navigator.clipboard.writeText(url);
        addNotification('链接已复制到剪贴板', 'success');
        break;
      case 'save_image':
        addNotification('长按海报即可保存', 'info');
        break;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full md:max-w-md bg-white rounded-t-3xl shadow-2xl pb-8 pt-6 px-6"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center mb-6">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Title */}
            <h3 className="text-center text-lg font-bold text-gray-900 mb-6">
              分享到
            </h3>

            {/* Grid */}
            <div className="grid grid-cols-4 gap-4">
              {shareOptions.map((opt, idx) => (
                <motion.button
                  key={opt.platform}
                  className="flex flex-col items-center gap-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleShare(opt.platform)}
                >
                  <div
                    className={`w-14 h-14 rounded-2xl ${opt.color} flex items-center justify-center text-white shadow-lg`}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d={opt.icon} />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-600">{opt.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Cancel */}
            <motion.button
              className="w-full mt-6 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm text-center"
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
            >
              取消
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
