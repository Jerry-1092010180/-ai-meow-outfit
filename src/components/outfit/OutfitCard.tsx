import { useState } from 'react';
import { motion } from 'framer-motion';
import type { GeneratedOutfit } from '../../types';

interface OutfitCardProps {
  outfit: GeneratedOutfit;
  onSave?: (outfit: GeneratedOutfit) => void;
  onShare?: (outfit: GeneratedOutfit) => void;
  onRegenerate?: () => void;
  onBuy?: () => void;
  revealMode?: boolean;
}

const moodLabels: Record<string, string> = {
  happy: '😊 开心', calm: '😌 平静', energetic: '⚡ 活力',
  chill: '😎 随性', romantic: '💕 浪漫', confident: '💪 自信',
};

const weatherIcons: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', windy: '💨',
};

export default function OutfitCard({
  outfit,
  onSave,
  onShare,
  onRegenerate,
  onBuy,
  revealMode = false,
}: OutfitCardProps) {
  const [revealed, setRevealed] = useState(!revealMode);

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto"
      style={{ perspective: 1200 }}
    >
      <motion.div
        className="relative w-full"
        animate={{ rotateY: revealed ? 0 : 180 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* ====== FRONT (revealed) ====== */}
        <div
          className="relative w-full rounded-2xl overflow-hidden shadow-xl"
          style={{
            aspectRatio: '3/4',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Scene background */}
          <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-100 to-orange-100">
            {outfit.sceneImage && (
              <img
                src={outfit.sceneImage}
                alt={outfit.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Style score badge */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg flex items-center gap-1.5">
            <span className="text-yellow-500 text-xs">⭐</span>
            <span className="text-sm font-bold text-gray-800">{outfit.styleScore}</span>
          </div>

          {/* Store-linked badge */}
          {outfit.linkedItems.length > 0 && (
            <div className="absolute top-3 left-3 bg-pink-500/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg">
              <span className="text-xs text-white font-medium">
                {outfit.linkedItems.length}件在售
              </span>
            </div>
          )}

          {/* Name & info overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-bold text-white mb-1 drop-shadow-lg">
              {outfit.name}
            </h3>
            <div className="flex items-center gap-3 text-white/80 text-xs">
              <span>{moodLabels[outfit.mood] || outfit.mood}</span>
              <span>{weatherIcons[outfit.weather.condition]} {outfit.weather.temperature}°</span>
              <span>{outfit.weather.city}</span>
            </div>

            {/* Tags */}
            {outfit.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {outfit.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] text-white font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ====== BACK (face-down) ====== */}
        <div
          className="absolute inset-0 w-full rounded-2xl overflow-hidden shadow-xl flex flex-col items-center justify-center bg-gradient-to-br from-pink-400 to-orange-400"
          style={{
            aspectRatio: '3/4',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Sparkle particles */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 bg-white rounded-full"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${10 + Math.random() * 80}%`,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  y: [0, -15 - Math.random() * 20],
                }}
                transition={{
                  duration: 1.5 + Math.random() * 2,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>

          {/* Cat logo */}
          <motion.div
            className="text-6xl mb-3"
            animate={{ scale: [1, 1.1, 1], rotate: [0, -3, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🐱
          </motion.div>

          <motion.p
            className="text-white/90 text-sm font-medium"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            点击揭晓今日穿搭
          </motion.p>

          <motion.div
            className="mt-4 flex gap-2"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="text-2xl">✨</span>
            <span className="text-2xl" style={{ animationDelay: '0.3s' }}>✨</span>
            <span className="text-2xl" style={{ animationDelay: '0.6s' }}>✨</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ====== Piece list & actions (shown after reveal) ====== */}
      {revealed && (
        <motion.div
          className="mt-4 space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed px-1">
            {outfit.styleDescription}
          </p>

          {/* Pieces */}
          <div className="flex flex-wrap gap-1.5 px-1">
            {outfit.pieces.map((piece, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: piece.color }}
                />
                {piece.name}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            {onSave && (
              <motion.button
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white text-sm font-semibold shadow-lg shadow-pink-500/20"
                whileTap={{ scale: 0.96 }}
                onClick={() => onSave(outfit)}
              >
                💾 保存到日记
              </motion.button>
            )}
            {onRegenerate && (
              <motion.button
                className="py-2.5 px-4 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium"
                whileTap={{ scale: 0.96 }}
                onClick={onRegenerate}
              >
                🔄 换一套
              </motion.button>
            )}
            {onShare && (
              <motion.button
                className="py-2.5 px-4 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium"
                whileTap={{ scale: 0.96 }}
                onClick={() => onShare(outfit)}
              >
                📤 分享
              </motion.button>
            )}
          </div>

          {/* Buy this look */}
          {onBuy && outfit.linkedItems.length > 0 && (
            <motion.button
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold shadow-lg shadow-amber-500/20"
              whileTap={{ scale: 0.96 }}
              onClick={onBuy}
            >
              🛍️ 买这套 ({outfit.linkedItems.length}件在售)
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Tap to reveal (only in reveal mode, not revealed) */}
      {revealMode && !revealed && (
        <motion.button
          className="absolute inset-0 w-full cursor-pointer z-10"
          style={{ aspectRatio: '3/4' }}
          onClick={() => setRevealed(true)}
          aria-label="点击揭晓穿搭"
        />
      )}
    </motion.div>
  );
}
