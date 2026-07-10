/**
 * 穿搭服务 — 每日穿搭生成
 */

import type { GeneratedOutfit, Mood } from '@/types';
import { getMockOutfits, pickOne, shuffle } from '@/utils/mock';
import { getToday } from '@/utils/date';

/** 生成今日穿搭 */
export async function generateOutfit(
  mood: Mood,
  _userId: string,
  regenerate = false
): Promise<GeneratedOutfit> {
  const outfits = await getMockOutfits();

  // 根据心情过滤匹配的穿搭
  const moodMatches = outfits.filter((o) => o.mood === mood);
  const pool = moodMatches.length >= 3 ? moodMatches : outfits;

  // 随机选一套（稍后会根据更复杂的逻辑匹配）
  const outfit = pickOne(pool);
  const today = getToday();

  return {
    ...outfit,
    id: `${outfit.id}-${Date.now()}`,
    date: today,
    createdAt: new Date().toISOString(),
    // 稍微随机化评分，让每次生成有新鲜感
    styleScore: Math.min(98, Math.max(60, outfit.styleScore + Math.floor(Math.random() * 10) - 5)),
  };
}

/** 获取穿搭历史 */
export async function getOutfitHistory(_userId: string): Promise<GeneratedOutfit[]> {
  const outfits = await getMockOutfits();
  return shuffle(outfits).slice(0, 12).map((o, i) => ({
    ...o,
    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}
