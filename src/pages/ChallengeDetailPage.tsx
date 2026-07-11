import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ROUTES } from '@/config/routes';
import { useChallengeStore } from '@/stores/useChallengeStore';
import BottomNav from '@/components/common/BottomNav';

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeChallenges = useChallengeStore((s) => s.activeChallenges);
  const completedChallenges = useChallengeStore((s) => s.completedChallenges);
  const joinChallenge = useChallengeStore((s) => s.joinChallenge);
  const submitVote = useChallengeStore((s) => s.submitVote);

  const challenge =
    activeChallenges.find((c) => c.id === id) ||
    completedChallenges.find((c) => c.id === id);

  const [voted, setVoted] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  if (!challenge) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <span className="text-4xl mb-4">🔍</span>
        <p className="text-gray-500">挑战不存在或已过期</p>
        <button
          className="mt-4 text-pink-500 font-medium"
          onClick={() => navigate(-1)}
        >
          返回
        </button>
      </div>
    );
  }

  const handleVote = (teamId: string) => {
    if (voted) return;
    setSelectedTeam(teamId);
    setVoted(true);
    submitVote(challenge.id, teamId, 'current-user');
  };

  const isCompleted = challenge.status === 'completed';
  const canVote = challenge.status === 'voting' && !voted;
  const canJoin =
    challenge.status === 'pending' && challenge.teamB.members.length === 0;

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button className="text-gray-500" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-gray-800">挑战详情</h1>
        </div>
      </header>

      <div className="px-4 pt-6">
        {/* Theme header */}
        <div className="text-center mb-8">
          <span className="text-sm px-3 py-1 rounded-full bg-pink-100 text-pink-600 font-medium">
            {challenge.type} 对决
          </span>
          <h2 className="text-2xl font-bold text-gray-800 mt-3">{challenge.theme}</h2>
          <p className="text-sm text-gray-400 mt-1">
            {isCompleted
              ? '已结束'
              : challenge.status === 'voting'
              ? '投票中 — 快去支持你喜欢的一方'
              : '等待对手加入'}
          </p>
        </div>

        {/* 3D同框按钮 */}
        <div className="text-center mb-4">
          <motion.button
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-bold shadow-lg"
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(ROUTES.CHALLENGE_3D.replace(':id', challenge.id))}
          >
            ✨ 3D同框查看
          </motion.button>
        </div>

        {/* VS display */}
        <div className="flex items-center justify-between gap-4 mb-8">
          {/* Team A */}
          <div className="flex-1 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-pink-300 to-pink-500 flex items-center justify-center text-2xl text-white font-bold shadow-lg">
              {challenge.teamA.members[0]?.name?.charAt(0) || 'A'}
            </div>
            <p className="mt-2 text-sm font-bold text-gray-700">
              {challenge.teamA.members[0]?.name || '等待加入'}
            </p>
            <p className="text-xs text-gray-400">
              {challenge.votesA} 票
            </p>
          </div>

          {/* VS badge */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              VS
            </div>
          </div>

          {/* Team B */}
          <div className="flex-1 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center text-2xl text-white font-bold shadow-lg">
              {challenge.teamB.members[0]?.name?.charAt(0) || 'B'}
            </div>
            <p className="mt-2 text-sm font-bold text-gray-700">
              {challenge.teamB.members[0]?.name || '等待加入'}
            </p>
            <p className="text-xs text-gray-400">
              {challenge.votesB} 票
            </p>
          </div>
        </div>

        {/* Vote bar */}
        {!isCompleted && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
              <span>投票进度</span>
              <span className="ml-auto">
                {challenge.votesA + challenge.votesB} 票
              </span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
              <div
                className="h-full bg-pink-500 transition-all duration-500"
                style={{
                  width: `${
                    (challenge.votesA / (challenge.votesA + challenge.votesB || 1)) * 100
                  }%`,
                }}
              />
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{
                  width: `${
                    (challenge.votesB / (challenge.votesA + challenge.votesB || 1)) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {canVote && (
            <>
              <motion.button
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                  selectedTeam === challenge.teamA.id
                    ? 'bg-pink-500 text-white shadow-lg'
                    : 'bg-pink-50 text-pink-500'
                }`}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleVote(challenge.teamA.id)}
                disabled={voted}
              >
                投给 {challenge.teamA.members[0]?.name}
              </motion.button>
              <motion.button
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                  selectedTeam === challenge.teamB.id
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-blue-50 text-blue-500'
                }`}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleVote(challenge.teamB.id)}
                disabled={voted}
              >
                投给 {challenge.teamB.members[0]?.name}
              </motion.button>
            </>
          )}

          {canJoin && (
            <motion.button
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold shadow-lg"
              whileTap={{ scale: 0.96 }}
              onClick={() => joinChallenge(challenge.id, 'current-user')}
            >
              加入挑战
            </motion.button>
          )}

          {voted && (
            <div className="flex-1 text-center py-3 text-green-600 font-medium">
              ✅ 投票成功！
            </div>
          )}

          {challenge.status === 'completed' && challenge.winnerId && (
            <div className="flex-1 text-center py-3">
              <span className="text-lg">🏆</span>
              <p className="text-sm font-bold text-orange-500">
                {challenge.winnerId === challenge.teamA.id
                  ? challenge.teamA.members[0]?.name
                  : challenge.teamB.members[0]?.name}{' '}
                获胜！
              </p>
              {challenge.reward && (
                <p className="text-xs text-gray-400 mt-1">
                  🎁 {challenge.reward.name}: {challenge.reward.code}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
