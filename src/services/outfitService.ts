/**
 * 穿搭服务 — 每日穿搭生成
 * 优先从 mock JSON 加载，失败时使用内置模板兜底
 */

import type { GeneratedOutfit, Mood, OutfitPiece, WeatherCondition, Season } from '@/types';
import { getMockOutfits, pickOne } from '@/utils/mock';
import { getToday } from '@/utils/date';

/** 内置兜底穿搭 — 永远可用，零网络依赖 */
const FALLBACK_OUTFITS: GeneratedOutfit[] = [
  {
    id: 'fallback-01', date: '', name: '初夏微风通勤装', mood: 'happy',
    weather: { temperature: 28, condition: 'sunny', city: '杭州', season: 'summer', humidity: 55 },
    pieces: [
      { type: 'top', name: '白色真丝衬衫', description: '轻盈透气', color: '#FFFFFF', material: '真丝' },
      { type: 'bottom', name: '浅蓝直筒牛仔裤', description: '修身显瘦', color: '#7BA7D0', material: '牛仔' },
      { type: 'shoes', name: '米色尖头平底鞋', description: '舒适百搭', color: '#F5E6CA', material: '羊皮' },
      { type: 'accessory', name: '金色锁骨链', description: '点睛之笔', color: '#FFD700', material: '合金' },
    ],
    styleDescription: '这套穿搭用明亮的色彩传递愉悦心情，轻盈的真丝衬衫与牛仔裤相得益彰，适合初夏的通勤和约会。',
    sceneImage: 'https://picsum.photos/seed/outfit-fallback-01/600/800',
    linkedItems: [
      { id: 'fb01', name: '白色真丝衬衫', brand: 'ZARA', price: 299, imageUrl: 'https://picsum.photos/seed/item-fb01/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
      { id: 'fb02', name: '浅蓝牛仔裤', brand: 'UNIQLO', price: 249, imageUrl: 'https://picsum.photos/seed/item-fb02/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
      { id: 'fb03', name: '米色平底鞋', brand: '百丽', price: 399, imageUrl: 'https://picsum.photos/seed/item-fb03/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
    ],
    styleScore: 88, tags: ['通勤', '简约', '初夏'], createdAt: '',
  },
  {
    id: 'fallback-02', date: '', name: '浪漫约会晚装', mood: 'romantic',
    weather: { temperature: 24, condition: 'cloudy', city: '杭州', season: 'spring', humidity: 60 },
    pieces: [
      { type: 'dress', name: '碎花连衣裙', description: '法式优雅', color: '#FFB8C6', material: '雪纺' },
      { type: 'shoes', name: '裸色高跟鞋', description: '拉长腿型', color: '#FDDCB5', material: '漆皮' },
      { type: 'accessory', name: '珍珠耳环', description: '温柔气质', color: '#FFFFF0', material: '珍珠' },
    ],
    styleDescription: '法式碎花裙搭配裸色高跟鞋，温柔浪漫中透着一丝精致。适合约会、下午茶和闺蜜聚会。',
    sceneImage: 'https://picsum.photos/seed/outfit-fallback-02/600/800',
    linkedItems: [
      { id: 'fb04', name: '碎花连衣裙', brand: '伊芙丽', price: 459, imageUrl: 'https://picsum.photos/seed/item-fb04/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
      { id: 'fb05', name: '裸色高跟鞋', brand: 'STACCATO', price: 599, imageUrl: 'https://picsum.photos/seed/item-fb05/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
    ],
    styleScore: 91, tags: ['约会', '甜美', '春日'], createdAt: '',
  },
  {
    id: 'fallback-03', date: '', name: '街头潮人套装', mood: 'confident',
    weather: { temperature: 18, condition: 'windy', city: '杭州', season: 'autumn', humidity: 45 },
    pieces: [
      { type: 'outerwear', name: '黑色皮夹克', description: '帅气有型', color: '#1A1A1A', material: 'PU' },
      { type: 'top', name: '白色字母T恤', description: '休闲百搭', color: '#FFFFFF', material: '纯棉' },
      { type: 'bottom', name: '黑色紧身裤', description: '修身显瘦', color: '#1A1A1A', material: '弹力棉' },
      { type: 'shoes', name: '马丁靴', description: '酷感十足', color: '#2D2D2D', material: '牛皮' },
    ],
    styleDescription: '黑色皮夹克配白色T恤，经典黑白配永远不会出错。马丁靴增添酷感，街头焦点就是你。',
    sceneImage: 'https://picsum.photos/seed/outfit-fallback-03/600/800',
    linkedItems: [
      { id: 'fb06', name: '黑色皮夹克', brand: 'MO&CO', price: 899, imageUrl: 'https://picsum.photos/seed/item-fb06/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
      { id: 'fb07', name: '马丁靴', brand: 'Dr.Martens', price: 1299, imageUrl: 'https://picsum.photos/seed/item-fb07/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
    ],
    styleScore: 85, tags: ['街头', '潮流', '个性'], createdAt: '',
  },
  {
    id: 'fallback-04', date: '', name: '慵懒周末休闲装', mood: 'chill',
    weather: { temperature: 22, condition: 'sunny', city: '杭州', season: 'spring', humidity: 50 },
    pieces: [
      { type: 'top', name: '燕麦色针织开衫', description: '柔软亲肤', color: '#D4C5B9', material: '羊毛混纺' },
      { type: 'bottom', name: '米白阔腿裤', description: '慵懒舒适', color: '#FAF8F5', material: '棉麻' },
      { type: 'shoes', name: '白色帆布鞋', description: '休闲减龄', color: '#FFFFFF', material: '帆布' },
    ],
    styleDescription: '周末就该穿得舒服又好看。燕麦色开衫配阔腿裤，慵懒中透着不经意的时髦感。',
    sceneImage: 'https://picsum.photos/seed/outfit-fallback-04/600/800',
    linkedItems: [
      { id: 'fb08', name: '针织开衫', brand: 'MUJI', price: 299, imageUrl: 'https://picsum.photos/seed/item-fb08/200/250', storeId: 'store-hzxh', storeName: '杭州西湖银泰' },
    ],
    styleScore: 82, tags: ['休闲', '慵懒', '周末'], createdAt: '',
  },
  {
    id: 'fallback-05', date: '', name: '商务通勤精英范', mood: 'calm',
    weather: { temperature: 20, condition: 'cloudy', city: '杭州', season: 'autumn', humidity: 55 },
    pieces: [
      { type: 'outerwear', name: '驼色风衣', description: '经典永不过时', color: '#C4A882', material: '棉质' },
      { type: 'top', name: '黑色高领针织衫', description: '显瘦百搭', color: '#1A1A1A', material: '羊毛' },
      { type: 'bottom', name: '烟灰西裤', description: '干练利落', color: '#6B6B6B', material: '西装面料' },
      { type: 'shoes', name: '黑色尖头高跟鞋', description: '气场全开', color: '#1A1A1A', material: '牛皮' },
    ],
    styleDescription: '驼色风衣是衣橱必备，搭配黑色高领和烟灰西裤，干练又不失温度，会议室里的穿搭范本。',
    sceneImage: 'https://picsum.photos/seed/outfit-fallback-05/600/800',
    linkedItems: [
      { id: 'fb09', name: '驼色风衣', brand: 'ICICLE', price: 1599, imageUrl: 'https://picsum.photos/seed/item-fb09/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
      { id: 'fb10', name: '烟灰西裤', brand: 'Theory', price: 899, imageUrl: 'https://picsum.photos/seed/item-fb10/200/250', storeId: 'store-hzwl', storeName: '杭州武林银泰' },
    ],
    styleScore: 90, tags: ['通勤', '商务', '极简'], createdAt: '',
  },
  {
    id: 'fallback-06', date: '', name: '元气运动套装', mood: 'energetic',
    weather: { temperature: 30, condition: 'sunny', city: '杭州', season: 'summer', humidity: 70 },
    pieces: [
      { type: 'top', name: '荧光绿运动背心', description: '透气速干', color: '#7FFF00', material: '涤纶' },
      { type: 'bottom', name: '黑色高腰瑜伽裤', description: '提臀塑形', color: '#1A1A1A', material: '氨纶' },
      { type: 'shoes', name: '白色气垫跑鞋', description: '缓震舒适', color: '#FFFFFF', material: '网面' },
    ],
    styleDescription: '运动也要时尚！荧光绿背心提亮整体造型，黑色瑜伽裤显瘦百搭，让你在健身房也是焦点。',
    sceneImage: 'https://picsum.photos/seed/outfit-fallback-06/600/800',
    linkedItems: [
      { id: 'fb11', name: '运动背心', brand: 'NIKE', price: 249, imageUrl: 'https://picsum.photos/seed/item-fb11/200/250', storeId: 'store-hzcx', storeName: '杭州城西银泰' },
      { id: 'fb12', name: '气垫跑鞋', brand: 'NIKE', price: 899, imageUrl: 'https://picsum.photos/seed/item-fb12/200/250', storeId: 'store-hzcx', storeName: '杭州城西银泰' },
    ],
    styleScore: 78, tags: ['运动', '活力', '夏日'], createdAt: '',
  },
];

/** 生成今日穿搭 */
export async function generateOutfit(
  mood: Mood,
  _userId: string,
  _regenerate = false
): Promise<GeneratedOutfit> {
  const today = getToday();

  // 优先从 mock JSON 加载
  try {
    const outfits = await getMockOutfits();
    if (outfits.length > 0) {
      const moodMatches = outfits.filter((o) => o.mood === mood);
      const pool = moodMatches.length >= 2 ? moodMatches : outfits;
      const outfit = pickOne(pool);
      if (outfit) {
        return {
          ...outfit,
          id: `${outfit.id}-${Date.now()}`,
          date: today,
          createdAt: new Date().toISOString(),
          styleScore: Math.min(98, Math.max(60, (outfit.styleScore || 80) + Math.floor(Math.random() * 10) - 5)),
        };
      }
    }
  } catch {
    console.warn('Mock outfits failed to load, using fallback');
  }

  // 兜底：使用内置模板
  const moodMatches = FALLBACK_OUTFITS.filter((o) => o.mood === mood);
  const pool = moodMatches.length > 0 ? moodMatches : FALLBACK_OUTFITS;
  const outfit = pickOne(pool)!;
  return {
    ...outfit,
    id: `${outfit.id}-${Date.now()}`,
    date: today,
    createdAt: new Date().toISOString(),
    styleScore: Math.min(98, Math.max(60, outfit.styleScore + Math.floor(Math.random() * 10) - 5)),
  };
}

/** 获取穿搭历史 */
export async function getOutfitHistory(_userId: string): Promise<GeneratedOutfit[]> {
  try {
    const outfits = await getMockOutfits();
    if (outfits.length > 0) {
      const { shuffle } = await import('@/utils/mock');
      return shuffle(outfits).slice(0, 12).map((o, i) => ({
        ...o,
        date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      }));
    }
  } catch { /* fallback below */ }

  return FALLBACK_OUTFITS.map((o, i) => ({
    ...o,
    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}
