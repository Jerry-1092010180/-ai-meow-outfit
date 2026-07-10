import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useChallengeStore } from '@/stores/useChallengeStore';
import { CHALLENGE_THEMES } from '@/config/constants';
import type { Challenge } from '@/types';
import BottomNav from '@/components/common/BottomNav';

export default function ChallengeListPage() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newChallenge, setNewChallenge] = useState<Challenge | null>(null);
  const activeChallenges = useChallengeStore((s) => s.activeChallenges);
  const completedChallenges = useChallengeStore((s) => s.completedChallenges);
  const loadChallenges = useChallengeStore((s) => s.loadChallenges);
  const createChallenge = useChallengeStore((s) => s.createChallenge);
  const isLoading = useChallengeStore((s) => s.isLoading);

  const inviteUrl = newChallenge
    ? `${window.location.origin}/challenges/join/${newChallenge.inviteCode}`
    : '';

  const handleShare = async (platform: 'wechat' | 'copy') => {
    if (!newChallenge) return;
    const text = `来AI喵搭和我PK「${newChallenge.theme}」穿搭！`;
    if (platform === 'copy') {
      await navigator.clipboard.writeText(inviteUrl);
      alert('邀请链接已复制！发送给好友即可PK');
    } else if (navigator.share) {
      await navigator.share({ title: text, text, url: inviteUrl });
    }
  };

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-gray-500 text-sm" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-gray-800">PK挑战</h1>
          <button
            className="text-sm text-pink-500 font-medium"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? '取消' : '+ 发起'}
          </button>
        </div>
      </header>

      <div className="px-4 pt-4">
        {/* Create challenge panel */}
        <AnimatePresence>
          {showCreate && !newChallenge && (
            <motion.div
              className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-pink-50 to-orange-50 border border-pink-100"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-sm font-bold text-gray-700 mb-3">选择挑战主题</h3>
              <div className="flex flex-wrap gap-2">
                {CHALLENGE_THEMES.map((theme) => (
                  <motion.button
                    key={theme.id}
                    className="px-3 py-2 rounded-full text-xs font-medium bg-white text-gray-700 shadow-sm hover:shadow-md transition-shadow"
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      await createChallenge('1v1', theme.name, 'current-user');
                      // 从 store 获取刚创建的挑战
                      const latest = useChallengeStore.getState().activeChallenges[0];
                      setNewChallenge(latest);
                    }}
                  >
                    {theme.emoji} {theme.name}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* 邀请分享面板 */}
          {newChallenge && (
            <motion.div
              className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">
                  ⚡ 挑战已创建！邀请好友PK
                </h3>
                <button
                  className="text-xs text-gray-400"
                  onClick={() => setNewChallenge(null)}
                >
                  ✕
                </button>
              </div>

              {/* 邀请码 */}
              <div className="bg-white rounded-xl p-3 mb-3 text-center">
                <p className="text-xs text-gray-400 mb-1">邀请码</p>
                <p className="text-2xl font-black tracking-widest text-purple-600">
                  {newChallenge.inviteCode}
                </p>
              </div>

              {/* 邀请链接 */}
              <div className="bg-white rounded-xl p-3 mb-3">
                <p className="text-[10px] text-gray-400 truncate">{inviteUrl}</p>
              </div>

              {/* 分享按钮 */}
              <div className="flex gap-2">
                <motion.button
                  className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleShare('wechat')}
                >
                  💬 微信邀请
                </motion.button>
                <motion.button
                  className="flex-1 py-2.5 rounded-xl bg-gray-700 text-white text-sm font-bold flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleShare('copy')}
                >
                  🔗 复制链接
                </motion.button>
              </div>

              <button
                className="w-full mt-2 py-2 text-xs text-purple-500 font-medium"
                onClick={() => navigate(ROUTES.CHALLENGE_3D.replace(':id', newChallenge.id))}
              >
                ✨ 先自己看看3D效果 →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active challenges */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 mb-3">
            进行中 ({activeChallenges.length})
          </h2>
          {activeChallenges.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无进行中的挑战</p>
          ) : (
            <div className="space-y-3">
              {activeChallenges.map((challenge) => (
                <motion.div
                  key={challenge.id}
                  className="p-4 rounded-2xl bg-white shadow-sm border border-gray-100 cursor-pointer"
                  whileTap={{ scale: 0.98 }}
                  onClick={() =>
                    navigate(
                      ROUTES.CHALLENGE_DETAIL.replace(':id', challenge.id)
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-pink-100 text-pink-600 font-medium">
                      {challenge.type}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        challenge.status === 'voting'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {challenge.status === 'voting' ? '投票中' : '进行中'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-2">
                    {challenge.theme}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>
                      {challenge.teamA.members[0]?.name || '???'} vs{' '}
                      {challenge.teamB.members[0]?.name || '等待加入'}
                    </span>
                  </div>
                  {challenge.status === 'voting' && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-pink-500 rounded-full"
                          style={{
                            width: `${
                              (challenge.votesA / (challenge.votesA + challenge.votesB || 1)) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-gray-400">
                        {challenge.votesA}:{challenge.votesB}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Completed challenges */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-3">
            已结束 ({completedChallenges.length})
          </h2>
          {completedChallenges.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无已结束的挑战</p>
          ) : (
            <div className="space-y-3">
              {completedChallenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="p-4 rounded-2xl bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 font-medium">
                      已结束
                    </span>
                    <span className="text-sm font-bold text-gray-800">
                      {challenge.theme}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>🏆 {challenge.winnerId ? '已有胜者' : '平局'}</span>
                    {challenge.reward && (
                      <span className="text-orange-500">🎁 {challenge.reward.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </div>
  );
}


