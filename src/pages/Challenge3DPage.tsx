import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNav from '@/components/common/BottomNav';
import { ROUTES } from '@/config/routes';
import { useChallengeStore } from '@/stores/useChallengeStore';
import DualAvatar3D from '@/components/challenge/DualAvatar3D';
import type { AvatarOutfit } from '@/components/outfit/ProceduralAvatar';

/** 预设PK穿搭配色 */
const PK_COLORS: AvatarOutfit[] = [
  { topColor: '#FF6B8A', bottomColor: '#FFB8C6', shoeColor: '#FFD700' },   // 粉队
  { topColor: '#4A90D9', bottomColor: '#2D5F8A', shoeColor: '#87CEEB' },   // 蓝队
  { topColor: '#2D2D2D', bottomColor: '#1A1A1A', shoeColor: '#C0C0C0' },   // 黑队
  { topColor: '#4CAF50', bottomColor: '#2E7D32', shoeColor: '#A5D6A7' },   // 绿队
];

export default function Challenge3DPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeChallenges = useChallengeStore((s) => s.activeChallenges);
  const completedChallenges = useChallengeStore((s) => s.completedChallenges);

  const challenge =
    activeChallenges.find((c) => c.id === id) ||
    completedChallenges.find((c) => c.id === id);

  if (!challenge) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950">
        <span className="text-4xl mb-4">🔍</span>
        <p className="text-gray-400">挑战不存在</p>
        <button
          className="mt-4 text-pink-400 font-medium"
          onClick={() => navigate(-1)}
        >
          返回
        </button>
      </div>
    );
  }

  const leftName = challenge.teamA.members[0]?.name || '选手A';
  const rightName = challenge.teamB.members[0]?.name || '选手B';
  const leftOutfit = PK_COLORS[0];
  const rightOutfit = PK_COLORS[1];

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom bg-gray-950">
      <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-gray-400 text-sm" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-white">3D 同框PK</h1>
          <button
            className="text-sm text-pink-400 font-medium"
            onClick={async () => {
              if (navigator.share) {
                await navigator.share({
                  title: `${leftName} VS ${rightName} — ${challenge.theme}`,
                  text: `AI喵搭PK挑战：${leftName} vs ${rightName}，来投票！`,
                  url: window.location.href,
                });
              } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('链接已复制！');
              }
            }}
          >
            📤 分享
          </button>
        </div>
      </header>

      <div className="px-2 pt-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <DualAvatar3D
            leftOutfit={leftOutfit}
            rightOutfit={rightOutfit}
            leftName={leftName}
            rightName={rightName}
            leftVotes={challenge.votesA}
            rightVotes={challenge.votesB}
            theme={challenge.theme}
          />
        </motion.div>

        {/* 图例说明 */}
        <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-xs text-gray-400 text-center">
            👆 两个3D模型分别展示两位选手的PK穿搭
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            拖拽旋转 · 滚轮缩放 · 从任意角度对比
          </p>
        </div>
      </div>

      <BottomNav dark />
    </div>
  );
}
