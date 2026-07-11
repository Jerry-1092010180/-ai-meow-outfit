/**
 * Mock 数据加载器
 * 从 public/mock/data/ 加载 JSON 数据
 */

import type { StoreItem } from '@/types/store';
import type { GeneratedOutfit } from '@/types/outfit';
import type { Challenge } from '@/types/challenge';

let itemsCache: StoreItem[] | null = null;
let outfitsCache: GeneratedOutfit[] | null = null;
let challengesCache: Challenge[] | null = null;

async function loadJSON<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

const BASE = import.meta.env.BASE_URL;

export async function getMockItems(): Promise<StoreItem[]> {
  if (!itemsCache) {
    itemsCache = await loadJSON<StoreItem[]>(`${BASE}mock/data/items.json`);
  }
  return itemsCache;
}

export async function getMockOutfits(): Promise<GeneratedOutfit[]> {
  if (!outfitsCache) {
    outfitsCache = await loadJSON<GeneratedOutfit[]>(`${BASE}mock/data/outfits.json`);
  }
  return outfitsCache;
}

export async function getMockChallenges(): Promise<Challenge[]> {
  if (!challengesCache) {
    challengesCache = await loadJSON<Challenge[]>(`${BASE}mock/data/challenges.json`);
  }
  return challengesCache;
}

/** 随机打乱数组 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 随机取 N 个 */
export function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

/** 随机选 1 个 */
export function pickOne<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}
