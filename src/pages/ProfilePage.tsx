import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useUserStore } from '@/stores/useUserStore';
import { useOutfitStore } from '@/stores/useOutfitStore';
import { useStreakTracker } from '@/hooks/useStreakTracker';
import { BODY_TYPES, STYLE_TAGS } from '@/config/constants';
import BottomNav from '@/components/common/BottomNav';

export default function ProfilePage() {
  const navigate = useNavigate();
  const profile = useUserStore((s) => s.profile);
  const clearProfile = useUserStore((s) => s.clearProfile);
  const diary = useOutfitStore((s) => s.diary);
  const { streak } = useStreakTracker();

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？这将清除你的穿搭日记和个人资料。')) {
      clearProfile();
      // Clear other stores
      useOutfitStore.getState().checkStreak();
      navigate(ROUTES.ONBOARDING, { replace: true });
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <span className="text-4xl mb-4">👤</span>
        <p className="text-gray-500 mb-4">未登录</p>
        <button
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold"
          onClick={() => navigate(ROUTES.ONBOARDING)}
        >
          创建个人资料
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
          <h1 className="text-lg font-bold text-gray-800">个人中心</h1>
        </div>
      </header>

      <div className="px-4 pt-6">
        {/* Profile card */}
        <div className="rounded-2xl bg-gradient-to-br from-pink-400 to-orange-400 p-6 text-white mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center text-3xl">
              🐱
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.nickname}</h2>
              <p className="text-sm text-white/70 mt-0.5">喵街会员 · 银泰百货</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{Object.keys(diary).length}</div>
              <div className="text-xs text-white/70">穿搭日记</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{streak}</div>
              <div className="text-xs text-white/70">连续打卡</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Object.values(diary).length > 0
                  ? Math.round(
                      Object.values(diary).reduce((s, o) => s + o.styleScore, 0) /
                        Object.values(diary).length
                    )
                  : 0}
              </div>
              <div className="text-xs text-white/70">平均评分</div>
            </div>
          </div>
        </div>

        {/* Style profile */}
        <section className="mb-6">
          <h3 className="text-sm font-bold text-gray-500 mb-3">风格档案</h3>
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">身型</span>
              <span className="text-sm font-medium text-gray-800">
                {BODY_TYPES[profile.bodyType] || profile.bodyType}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">风格偏好</span>
              <div className="flex gap-1">
                {profile.styleTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-500"
                  >
                    {STYLE_TAGS[tag] || tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">常去门店</span>
              <span className="text-sm font-medium text-gray-800">
                {profile.preferredStore === 'store-hzwl' ? '杭州武林银泰' : profile.preferredStore}
              </span>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section className="mb-6">
          <h3 className="text-sm font-bold text-gray-500 mb-3">快捷入口</h3>
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100 divide-y divide-gray-50">
            {[
              { label: '穿搭日记', icon: '📖', path: ROUTES.DIARY },
              { label: 'PK挑战', icon: '⚡', path: ROUTES.CHALLENGES },
              { label: '门店好物', icon: '🛍️', path: ROUTES.STORE },
            ].map((link) => (
              <button
                key={link.path}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => navigate(link.path)}
              >
                <span className="text-lg">{link.icon}</span>
                <span>{link.label}</span>
                <span className="ml-auto text-gray-300">›</span>
              </button>
            ))}
          </div>
        </section>

        {/* Reset */}
        <motion.button
          className="w-full py-3 rounded-xl bg-red-50 text-red-500 text-sm font-medium"
          whileTap={{ scale: 0.96 }}
          onClick={handleReset}
        >
          重置所有数据
        </motion.button>

        <p className="text-center text-xs text-gray-300 mt-4 mb-8">
          AI喵搭 v1.0 · 银泰百货喵街APP
        </p>
      </div>

      <BottomNav />
    </div>
  );
}


