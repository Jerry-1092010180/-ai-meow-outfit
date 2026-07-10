import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useChallengeStore } from '@/stores/useChallengeStore';
import { useUserStore } from '@/stores/useUserStore';
import { joinChallengeByCode, findChallengeByInviteCode } from '@/services/challengeService';
import DualAvatar3D from '@/components/challenge/DualAvatar3D';
import type { Challenge } from '@/types';

export default function JoinChallengePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const profile = useUserStore((s) => s.profile);
  const activeChallenges = useChallengeStore((s) => s.activeChallenges);

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [joined, setJoined] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;

    // 先查找是否已经存在
    const existing = activeChallenges.find((c) => c.inviteCode === code);
    if (existing) {
      setChallenge(existing);
      setJoined(existing.teamB.members.length > 0);
      return;
    }

    const found = findChallengeByInviteCode(code);
    if (found) {
      setChallenge(found);
      setJoined(found.teamB.members.length > 0);
    } else {
      setNotFound(true);
    }
  }, [code, activeChallenges]);

  const handleJoin = () => {
    if (!code) return;
    const updated = joinChallengeByCode(code);
    if (updated) {
      setChallenge(updated);
      setJoined(true);
    }
  };

  // 未找到挑战
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-6">
        <span className="text-6xl mb-4">🔍</span>
        <h2 className="text-xl font-bold text-white mb-2">挑战不存在</h2>
        <p className="text-gray-400 text-sm text-center">
          邀请码可能已过期或链接不正确
        </p>
        <button
          className="mt-6 px-6 py-3 rounded-xl bg-pink-500 text-white font-bold"
          onClick={() => navigate(ROUTES.HOME)}
        >
          回到首页
        </button>
      </div>
    );
  }

  // 已加入 — 显示 3D 同框
  if (joined && challenge) {
    const me = challenge.teamB.members[0];
    const opponent = challenge.teamA.members[0];
    const colorsA = challenge.teamA.outfitColors || { topColor: '#FF6B8A', bottomColor: '#FFB8C6', shoeColor: '#FFD700' };
    const colorsB = challenge.teamB.outfitColors || { topColor: '#4A90D9', bottomColor: '#2D5F8A', shoeColor: '#87CEEB' };

    return (
      <div className="min-h-screen pb-24 safe-top safe-bottom bg-gray-950">
        <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <button className="text-gray-400 text-sm" onClick={() => navigate(-1)}>← 返回</button>
            <h1 className="text-lg font-bold text-white">PK 对决</h1>
            <button
              className="text-sm text-pink-400 font-medium"
              onClick={async () => {
                const url = `${window.location.origin}/challenges/join/${challenge.inviteCode}`;
                if (navigator.share) {
                  await navigator.share({ title: `${opponent?.name} 邀你PK穿搭！`, text: `来AI喵搭和我PK ${challenge.theme}！`, url });
                } else {
                  await navigator.clipboard.writeText(url);
                }
              }}
            >
              📤 叫朋友来投票
            </button>
          </div>
        </header>

        <div className="px-2 pt-2">
          <DualAvatar3D
            leftOutfit={{
              topColor: colorsA.topColor,
              bottomColor: colorsA.bottomColor,
              shoeColor: colorsA.shoeColor,
              bodyType: opponent?.bodyType,
              skinTone: opponent?.colorPreference,
            }}
            rightOutfit={{
              topColor: colorsB.topColor,
              bottomColor: colorsB.bottomColor,
              shoeColor: colorsB.shoeColor,
              bodyType: me?.bodyType,
              skinTone: me?.colorPreference,
            }}
            leftName={opponent?.name || '对手'}
            rightName={me?.name || '我'}
            leftVotes={challenge.votesA}
            rightVotes={challenge.votesB}
            theme={challenge.theme}
          />

          <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="text-sm text-green-400 font-bold mb-1">✅ 已加入挑战！</p>
            <p className="text-xs text-gray-400">
              分享这个页面给你的朋友，让他们来投票选出最佳穿搭
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 等待加入 — 显示对手信息和应战按钮
  if (challenge) {
    const opponent = challenge.teamA.members[0];
    const colorsA = challenge.teamA.outfitColors || { topColor: '#FF6B8A', bottomColor: '#FFB8C6', shoeColor: '#FFD700' };

    return (
      <div className="min-h-screen flex flex-col bg-gray-950 safe-top safe-bottom">
        <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <button className="text-gray-400 text-sm" onClick={() => navigate(-1)}>← 返回</button>
            <h1 className="text-lg font-bold text-white">PK 挑战邀请</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          {/* 对手信息卡片 */}
          <motion.div
            className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 p-6 mb-8 text-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-3xl shadow-2xl mb-4">
              {opponent?.name?.charAt(0) || '?'}
            </div>
            <p className="text-sm text-gray-400 mb-1">
              {opponent?.name || '神秘选手'}
            </p>
            <h2 className="text-xl font-bold text-white mb-3">
              邀你PK「{challenge.theme}」
            </h2>
            <div className="flex items-center justify-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: colorsA.topColor }}
              />
              <span className="text-xs text-gray-400">
                对手已选择穿搭方案
              </span>
            </div>
          </motion.div>

          {/* 自己的信息 */}
          {profile && (
            <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 p-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center text-xl">
                  🐱
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{profile.nickname}</p>
                  <p className="text-xs text-gray-400">
                    {profile.bodyType ? `${['沙漏型','梨型','苹果型','矩形','倒三角'][['hourglass','pear','apple','rectangle','inverted_triangle'].indexOf(profile.bodyType)]}身材` : ''}
                    {' · '}喵街会员
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 应战按钮 */}
          <motion.button
            className="w-full max-w-sm py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-lg font-black shadow-2xl shadow-pink-500/30"
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleJoin}
          >
            ⚡ 应战！3D同框PK
          </motion.button>

          <p className="text-xs text-gray-500 mt-4 text-center max-w-xs">
            加入后，你和对手的3D模型将同框展示，双方好友可投票选出最佳穿搭
          </p>
        </div>
      </div>
    );
  }

  // 加载中
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" />
        <p className="text-white/40 text-sm">加载挑战...</p>
      </div>
    </div>
  );
}
