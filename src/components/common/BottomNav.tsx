import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Flame, ShoppingBag, Sparkles, Swords } from 'lucide-react';
import { ROUTES } from '@/config/routes';

/** 所有页面的统一底部导航 — 保证一致的用户体验 */
const TABS = [
  { path: ROUTES.GAME, label: '今日副本', icon: Flame },
  { path: ROUTES.TRY_ON, label: 'AI分身', icon: Sparkles },
  { path: ROUTES.DIARY, label: '穿搭日记', icon: BookOpen },
  { path: ROUTES.CHALLENGES, label: '好友PK', icon: Swords },
  { path: ROUTES.STORE, label: '门店好物', icon: ShoppingBag },
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
          const Icon = tab.icon;
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
              <Icon size={20} strokeWidth={isActive ? 2.6 : 2} aria-hidden="true" />
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
