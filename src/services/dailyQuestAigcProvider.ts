import { getMockItems } from '@/utils/mock';
import { getToday } from '@/utils/date';
import type { StoreItem } from '@/types/store';
import type {
  DailyQuestAigcProvider,
  DailyQuestContext,
  DailyQuestSelection,
  DailyStyleQuest,
  GeneratedQuestLook,
} from '@/types/dailyQuest';

const ROUND_ITEM_IDS = [
  ['item-004', 'item-011', 'item-022'],
  ['item-003', 'item-012', 'item-029'],
  ['item-005', 'item-010', 'item-018'],
] as const;

const FALLBACK_ITEMS: StoreItem[] = [
  {
    id: 'item-004', name: '经典款风衣', brand: 'Burberry', category: 'outerwear', price: 2599,
    imageUrl: 'https://picsum.photos/seed/trench-coat/400/500', storeId: 'store-hzwl',
    storeName: '杭州武林银泰', floorLocation: '3F 时尚女装', stockStatus: 'in_stock',
    skuId: 'SKU-BB-004', tags: ['经典', '英伦', '百搭'], colors: ['卡其'], sizes: ['S', 'M', 'L'],
    description: '防风防泼水的经典廓形',
  },
  {
    id: 'item-011', name: '亚麻西装外套', brand: 'ZARA', category: 'outerwear', price: 699,
    imageUrl: 'https://picsum.photos/seed/linen-blazer/400/500', storeId: 'store-hzcx',
    storeName: '杭州城西银泰', floorLocation: '3F 设计师品牌', stockStatus: 'in_stock',
    skuId: 'SKU-ZR-011', tags: ['通勤', '春夏', '轻薄'], colors: ['米白'], sizes: ['S', 'M', 'L'],
    description: '轻薄松弛的亚麻廓形',
  },
  {
    id: 'item-022', name: '牛仔夹克', brand: 'Lee', category: 'outerwear', price: 799,
    imageUrl: 'https://picsum.photos/seed/denim-jacket/400/500', storeId: 'store-nbdm',
    storeName: '宁波东门银泰', floorLocation: '3F 成熟女装', stockStatus: 'in_stock',
    skuId: 'SKU-LE-022', tags: ['复古', '街头', '春秋'], colors: ['浅蓝'], sizes: ['S', 'M', 'L'],
    description: '做旧水洗的复古短夹克',
  },
  {
    id: 'item-003', name: '复古碎花连衣裙', brand: 'Maje', category: 'dress', price: 2399,
    imageUrl: 'https://picsum.photos/seed/floral-dress/400/500', storeId: 'store-hzxh',
    storeName: '杭州西湖银泰', floorLocation: '2F 设计师女装', stockStatus: 'in_stock',
    skuId: 'SKU-MJ-003', tags: ['复古', '约会', '法式'], colors: ['碎花蓝'], sizes: ['XS', 'S', 'M'],
    description: '收腰轻盈的法式碎花裙',
  },
  {
    id: 'item-012', name: '缎面吊带裙', brand: 'Sandro', category: 'dress', price: 1899,
    imageUrl: 'https://picsum.photos/seed/satin-slip-dress/400/500', storeId: 'store-hzxh',
    storeName: '杭州西湖银泰', floorLocation: '2F 设计师女装', stockStatus: 'in_stock',
    skuId: 'SKU-SD-012', tags: ['派对', '法式', '光泽'], colors: ['香槟金'], sizes: ['XS', 'S', 'M'],
    description: '画廊灯光下自带光泽的缎面裙',
  },
  {
    id: 'item-029', name: '垂感阔腿裤', brand: '歌力思', category: 'bottom', price: 1099,
    imageUrl: 'https://picsum.photos/seed/wide-leg-pants/400/500', storeId: 'store-hzwl',
    storeName: '杭州武林银泰', floorLocation: '2F 精品女装', stockStatus: 'in_stock',
    skuId: 'SKU-GLS-029', tags: ['通勤', '显瘦', '气质'], colors: ['藏青'], sizes: ['S', 'M', 'L'],
    description: '高腰垂感，走路带风',
  },
  {
    id: 'item-005', name: '尖头细跟高跟鞋', brand: 'Jimmy Choo', category: 'shoes', price: 2699,
    imageUrl: 'https://picsum.photos/seed/stiletto-heels/400/500', storeId: 'store-hzwl',
    storeName: '杭州武林银泰', floorLocation: 'B1 鞋履配饰馆', stockStatus: 'in_stock',
    skuId: 'SKU-JC-005', tags: ['约会', '派对', '优雅'], colors: ['裸色'], sizes: ['35', '36', '37'],
    description: '利落尖头与轻盈细跟',
  },
  {
    id: 'item-010', name: '珍珠吊坠项链', brand: '周大福', category: 'accessory', price: 1299,
    imageUrl: 'https://picsum.photos/seed/pearl-necklace/400/500', storeId: 'store-hzwl',
    storeName: '杭州武林银泰', floorLocation: '1F 国际美妆', stockStatus: 'in_stock',
    skuId: 'SKU-ZDF-010', tags: ['优雅', '礼物', '精致'], colors: ['珍珠白'], sizes: ['均码'],
    description: '把画廊灯光带到脸侧的珍珠光泽',
  },
  {
    id: 'item-018', name: '玛丽珍平底鞋', brand: 'Charles & Keith', category: 'shoes', price: 459,
    imageUrl: 'https://picsum.photos/seed/mary-jane/400/500', storeId: 'store-nbdm',
    storeName: '宁波东门银泰', floorLocation: 'B1 潮流鞋包', stockStatus: 'in_stock',
    skuId: 'SKU-CK-018', tags: ['复古', '甜美', '舒适'], colors: ['酒红'], sizes: ['35', '36', '37'],
    description: '复古但适合长时间行走',
  },
];

function indexItems(items: StoreItem[]) {
  return new Map([...FALLBACK_ITEMS, ...items].map((item) => [item.id, item]));
}

function calculateMatch(item: StoreItem) {
  const desired = new Set(['经典', '复古', '法式', '派对', '优雅', '精致', '气质']);
  return item.tags.reduce((score, tag) => score + (desired.has(tag) ? 1 : 0), 0);
}

export class DemoPersonalizedQuestProvider implements DailyQuestAigcProvider {
  async createDailyQuest(context: DailyQuestContext): Promise<DailyStyleQuest> {
    let items: StoreItem[] = [];
    try {
      items = await getMockItems();
    } catch (error) {
      console.warn('[DailyQuest] Product data fallback', error);
    }
    const byId = indexItems(items);
    const rounds = ROUND_ITEM_IDS.map((ids, index) => ({
      id: `round-${index + 1}`,
      label: ['定下轮廓', '决定主角', '完成最后一笔'][index],
      prompt: ['雨夜进场，先选一件能撑住气场的外层', '展览开幕，选出你的主视觉', '好友拍照前，留下最容易被记住的细节'][index],
      candidates: ids.map((id) => byId.get(id)).filter((item): item is StoreItem => Boolean(item)),
    }));
    return {
      id: `quest-${getToday()}-gallery`,
      date: getToday(),
      issue: 'ISSUE 0715',
      title: '雨夜画廊开幕局',
      scene: '19:30 · 天目里新展开幕',
      story: '室外闷热有阵雨，室内冷气很足。你只有一套造型，要从合影一路穿到夜宵。',
      weather: `${context.city} ${context.temperature}°C · ${context.weather}`,
      storeName: context.preferredStore,
      deadline: '今晚 22:00 前',
      timeLimitSeconds: 60,
      reward: {
        inspiration: 120,
        couponLabel: '到店试穿 ¥80 券',
        collectible: '「雨夜主角」数字衣橱卡',
      },
      aigcInputs: [context.weather, context.styleTags.join('×'), '门店实时库存', '今日社交场景'],
      rounds,
      providerStage: 'demo-personalized-provider',
    };
  }

  async generateLook(
    quest: DailyStyleQuest,
    selections: DailyQuestSelection[]
  ): Promise<GeneratedQuestLook> {
    await new Promise((resolve) => window.setTimeout(resolve, 2200));
    const matchPoints = selections.reduce((sum, selection) => sum + calculateMatch(selection.item), 0);
    const stockPoints = selections.filter((selection) => selection.item.stockStatus === 'in_stock').length;
    const score = Math.min(97, 78 + matchPoints * 3 + stockPoints);
    const selectedIds = new Set(selections.map((selection) => selection.item.id));
    const alternativeItems = quest.rounds
      .map((round) => [...round.candidates].sort((a, b) => calculateMatch(b) - calculateMatch(a))[0])
      .filter((item) => item && !selectedIds.has(item.id));
    const names = selections.map((selection) => selection.item.name);
    return {
      id: `look-${Date.now().toString(36)}`,
      title: score >= 90 ? '雨幕里的开场人物' : '展厅外的松弛主角',
      score,
      verdict: score >= 90 ? 'AI 判定：今晚最容易被记住的不是盛装，而是你对光泽与轮廓的克制。' : 'AI 判定：气质成立，再加一个有光泽的细节会更抓镜头。',
      storyCaption: `${names[0]}稳住雨夜轮廓，${names[1]}接住展厅灯光，${names[2]}把视线留在合影里。`,
      tags: ['雨夜电影感', '不费力精致', '合影高识别'],
      dimensions: [
        { label: '场景适配', score: Math.min(98, 84 + matchPoints * 2) },
        { label: '个人风格', score: Math.min(96, 80 + matchPoints * 3) },
        { label: '天气舒适', score: selections.some((item) => item.item.category === 'outerwear') ? 92 : 78 },
        { label: '门店可得', score: 82 + stockPoints * 5 },
      ],
      selections,
      alternativeItems,
      generationTrace: ['融合天气与今日场景', '读取风格 DNA', '核对银泰在售库存', '生成动漫分身大片与文案'],
      providerStage: quest.providerStage,
    };
  }
}

export class GatewayDailyQuestAigcProvider implements DailyQuestAigcProvider {
  constructor(private readonly endpoint: string) {}

  async createDailyQuest(context: DailyQuestContext): Promise<DailyStyleQuest> {
    const response = await fetch(`${this.endpoint}/daily-quest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, date: getToday() }),
    });
    if (!response.ok) throw new Error(`Daily quest provider failed: ${response.status}`);
    return response.json() as Promise<DailyStyleQuest>;
  }

  async generateLook(quest: DailyStyleQuest, selections: DailyQuestSelection[]): Promise<GeneratedQuestLook> {
    const response = await fetch(`${this.endpoint}/daily-quest/${encodeURIComponent(quest.id)}/look`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections }),
    });
    if (!response.ok) throw new Error(`Daily look provider failed: ${response.status}`);
    return response.json() as Promise<GeneratedQuestLook>;
  }
}

export const dailyQuestAigcProvider: DailyQuestAigcProvider = new DemoPersonalizedQuestProvider();
