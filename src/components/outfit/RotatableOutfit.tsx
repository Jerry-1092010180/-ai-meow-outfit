import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GeneratedOutfit } from '@/types';

interface RotatableOutfitProps {
  outfit: GeneratedOutfit;
  onRandomize?: () => void;
  onShare?: (outfit: GeneratedOutfit) => void;
}

/** 360°可旋转、可缩放的穿搭展示组件 */
export default function RotatableOutfit({
  outfit,
  onRandomize,
  onShare,
}: RotatableOutfitProps) {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastX = useRef(0);
  const lastDist = useRef(0);

  // 自动旋转
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotation((r) => r + 0.3);
    }, 16);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // 拖拽旋转
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    setAutoRotate(false);
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX.current;
      setRotation((r) => r + dx * 0.5);
      lastX.current = e.clientX;
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    // 2秒后恢复自动旋转
    setTimeout(() => setAutoRotate(true), 2000);
  }, []);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.8, Math.min(2.5, s - e.deltaY * 0.002)));
  }, []);

  // 捏合缩放（移动端）
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastDist.current) {
          const delta = dist - lastDist.current;
          setScale((s) => Math.max(0.8, Math.min(2.5, s + delta * 0.005)));
        }
        lastDist.current = dist;
      }
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    lastDist.current = 0;
  }, []);

  const moodEmojis: Record<string, string> = {
    happy: '😊', calm: '😌', energetic: '⚡', chill: '😎', romantic: '💕', confident: '💪',
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* 3D 旋转容器 */}
      <div
        className="relative w-full flex items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
        style={{ aspectRatio: '3/4', perspective: '1000px' }}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 背景装饰 */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-pink-400 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-60 h-60 rounded-full bg-orange-400 blur-3xl" />
        </div>

        {/* 3D 穿搭模型 */}
        <motion.div
          className="relative cursor-grab active:cursor-grabbing"
          animate={{ rotateY: rotation }}
          transition={
            isDragging
              ? { duration: 0 }
              : { duration: 0.016, ease: 'linear' }
          }
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${rotation}deg) scale(${scale})`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* 正面 — 穿搭主图 */}
          <div
            className="flex flex-col items-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="relative w-56 h-72 rounded-2xl overflow-hidden shadow-2xl">
              {outfit.sceneImage ? (
                <img
                  src={outfit.sceneImage}
                  alt={outfit.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-300 to-orange-300 flex items-center justify-center text-6xl">
                  👗
                </div>
              )}
              {/* 反光效果 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />
            </div>
            {/* 镜面反射 */}
            <div
              className="w-56 h-16 mt-2 rounded-2xl overflow-hidden opacity-30"
              style={{ transform: 'scaleY(-1)' }}
            >
              <img
                src={outfit.sceneImage}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 to-transparent" />
            </div>
          </div>

          {/* 背面 (旋转180°可见) */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="w-56 h-72 rounded-2xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 border border-white/10 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-white/80 text-sm font-medium mb-4">
                {outfit.styleDescription}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {outfit.pieces.map((piece, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-white/10 text-white/70 text-xs"
                  >
                    {piece.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* 旋转提示 */}
        {autoRotate && (
          <div className="absolute bottom-20 text-white/40 text-xs pointer-events-none">
            ← 拖拽旋转查看 →
          </div>
        )}

        {/* 缩放控件 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          <button
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur text-white/70 text-lg flex items-center justify-center active:bg-white/20"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
          >
            +
          </button>
          <button
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur text-white/70 text-lg flex items-center justify-center active:bg-white/20"
            onClick={() => setScale((s) => Math.max(0.8, s - 0.2))}
          >
            −
          </button>
        </div>
      </div>

      {/* 信息 + 操作栏 */}
      <div className="mt-4 px-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{outfit.name}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{moodEmojis[outfit.mood]}</span>
              <span>风格分 {outfit.styleScore}</span>
              <span>·</span>
              <span>{outfit.weather.city}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <motion.button
              className="w-10 h-10 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center text-lg"
              whileTap={{ scale: 0.9 }}
              onClick={onRandomize}
              title="随机换一套"
            >
              🎲
            </motion.button>
            <motion.button
              className="w-10 h-10 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center text-lg"
              whileTap={{ scale: 0.9 }}
              onClick={() => onShare?.(outfit)}
              title="分享"
            >
              📤
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
