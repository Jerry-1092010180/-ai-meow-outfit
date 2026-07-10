import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

/** 所有页面的统一底部导航 — 保证一致的用户体验 */
const TABS = [
  { path: ROUTES.HOME, label: '今日穿搭', icon: '🏠' },
  { path: ROUTES.TRY_ON, label: '虚拟试穿', icon: '✨' },
  { path: ROUTES.DIARY, label: '穿搭日记', icon: '📖' },
  { path: ROUTES.CHALLENGES, label: 'PK挑战', icon: '⚡' },
  { path: ROUTES.STORE, label: '门店好物', icon: '🛍️' },
] as const;

interface BottomNavProps {
  /** 暗色主题（用于深色背景页面） */
  dark?: boolean;
}

export default function BottomNav({ dark = false }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] backdrop-blur-lg border-t safe-bottom ${
        dark
          ? 'bg-gray-900/90 border-white/10'
          : 'bg-white/90 border-gray-100'
      }`}
    >
      <div className="flex items-center justify-around py-2">
        {TABS.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 transition-colors ${
                isActive
                  ? dark
                    ? 'text-pink-400'
                    : 'text-pink-500'
                  : dark
                  ? 'text-gray-500'
                  : 'text-gray-400'
              }`}
              onClick={() => navigate(tab.path)}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className={`text-[10px] ${isActive ? 'font-medium' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
