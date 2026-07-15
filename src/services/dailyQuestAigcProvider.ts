import { getMockItems } from '@/utils/mock';
import { getToday } from '@/utils/date';
import type { StoreItem } from '@/types/store';
import type {
  DailyQuestAigcProvider,
  DailyQuestContext,
  DailyQuestSelection,
  DailyStyleQuest,
  GeneratedQuestCandidate,
  GeneratedQuestLook,
} from '@/types/dailyQuest';

const ROUND_ITEM_IDS = [
  ['item-004', 'item-011', 'item-022'],
  ['item-003', 'item-012', 'item-029'],
  ['item-005', 'item-010', 'item-018'],
] as const;

const DAILY_EPISODES = [
  {
    title: '周一屋顶复工局',
    scene: '18:30 · 写字楼屋顶晚风',
    story: '白天要利落开会，下班后直接去屋顶小聚。AI 要帮你完成不换衣的角色转场。',
    prompts: ['先选一件撑住会议气场的外层', '下班转场，决定整套造型的主角', '晚风合影前，留下一个记忆点'],
    collectible: '「屋顶重启」数字衣橱卡',
  },
  {
    title: '雨夜画廊开幕局',
    scene: '19:30 · 天目里新展开幕',
    story: '室外闷热有阵雨，室内冷气很足。你只有一套造型，要从合影一路穿到夜宵。',
    prompts: ['雨夜进场，先选一件能撑住气场的外层', '展览开幕，选出你的主视觉', '好友拍照前，留下最容易被记住的细节'],
    collectible: '「雨夜主角」数字衣橱卡',
  },
  {
    title: '午后咖啡快闪局',
    scene: '15:00 · 湖滨咖啡快闪店',
    story: '今天的任务是舒服地逛完街，又要在限定咖啡墙前拍出一张有辨识度的照片。',
    prompts: ['先定一件适合室内外切换的轮廓', '为咖啡墙合影选出主角单品', '最后加一个不费力的抓眼细节'],
    collectible: '「咖啡漫游」数字衣橱卡',
  },
  {
    title: '下班即刻派对局',
    scene: '20:00 · 城市露台生日派对',
    story: '没有回家换装的时间。AI 要把你的通勤选择改写成一套能直接进入派对镜头的造型。',
    prompts: ['从办公室出发，先选可转场的外层', '派对灯亮起，决定今晚的主视觉', '合照倒计时，选最后一个高光细节'],
    collectible: '「即刻派对」数字衣橱卡',
  },
  {
    title: '周五霓虹夜游局',
    scene: '21:00 · 湖滨霓虹夜游',
    story: '今晚会经过街头、餐厅和夜景天台。你的造型要在三种灯光里都站得住。',
    prompts: ['先选一件能接住霓虹的外层', '夜游主角只能有一件，凭直觉选', '让好友一眼记住你的最后一笔'],
    collectible: '「霓虹夜游」数字衣橱卡',
  },
  {
    title: '城市寻宝漫游局',
    scene: '14:00 · 银泰周末城市寻宝',
    story: '今天要边走边解锁门店线索。AI 会同时考虑舒适度、镜头表现和沿途在售库存。',
    prompts: ['漫游第一站，先选轻松但有型的外层', '城市任务中，选出最像你的主角', '终点合照前，补上辨识度细节'],
    collectible: '「城市寻宝」数字衣橱卡',
  },
  {
    title: '好友双人封面局',
    scene: '17:30 · 银泰周末封面棚',
    story: '本周最终章需要一位好友共同完成。你们的 AI 角色卡会拼成一张双人周刊封面。',
    prompts: ['先定下本周最终章的角色轮廓', '选出双人封面的视觉主角', '最后一个细节决定封面标题'],
    collectible: '「双人终章」数字衣橱卡',
  },
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

function getEpisodeIndex(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

function rotateItems<T>(items: T[], offset: number) {
  if (items.length === 0) return items;
  const normalized = offset % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function scoreCandidate(items: StoreItem[], base: number) {
  const matchPoints = items.reduce((sum, item) => sum + calculateMatch(item), 0);
  const stockPoints = items.filter((item) => item.stockStatus === 'in_stock').length;
  return Math.min(98, base + matchPoints * 3 + stockPoints);
}

export class DemoPersonalizedQuestProvider implements DailyQuestAigcProvider {
  async createDailyQuest(context: DailyQuestContext): Promise<DailyStyleQuest> {
    let items: StoreItem[] = [];
    try {
      items = await getMockItems();
    } catch (error) {
      console.warn('[DailyQuest] Product data fallback', error);
    }
    const today = getToday();
    const episodeIndex = getEpisodeIndex(today);
    const episode = DAILY_EPISODES[episodeIndex];
    const nextEpisode = DAILY_EPISODES[(episodeIndex + 1) % DAILY_EPISODES.length];
    const byId = indexItems(items);
    const rounds = ROUND_ITEM_IDS.map((ids, index) => ({
      id: `round-${index + 1}`,
      label: ['定下轮廓', '决定主角', '完成最后一笔'][index],
      prompt: episode.prompts[index],
      candidates: rotateItems(
        ids.map((id) => byId.get(id)).filter((item): item is StoreItem => Boolean(item)),
        episodeIndex + index
      ),
    }));
    return {
      id: `quest-${today}-episode-${episodeIndex + 1}`,
      date: today,
      issue: `ISSUE ${today.slice(5).replace('-', '')}`,
      episodeNumber: episodeIndex + 1,
      weeklyArc: `城市主角周 · EP ${episodeIndex + 1}/7`,
      title: episode.title,
      scene: episode.scene,
      story: episode.story,
      weather: `${context.city} ${context.temperature}°C · ${context.weather}`,
      storeName: context.preferredStore,
      deadline: '今晚 22:00 前',
      timeLimitSeconds: 60,
      reward: {
        inspiration: 120,
        couponLabel: '到店试穿 ¥80 券',
        collectible: episode.collectible,
      },
      nextTeaser: `${nextEpisode.title} · 明早 08:00 更新商品池`,
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
    const strongestSelection = [...selections].sort((a, b) => calculateMatch(b.item) - calculateMatch(a.item))[0];
    const alternativeItems = quest.rounds.map((round) => {
      const selected = selections.find((selection) => selection.roundId === round.id);
      if (selected?.item.id === strongestSelection?.item.id) return selected.item;
      return [...round.candidates]
        .filter((item) => !selectedIds.has(item.id))
        .sort((a, b) => calculateMatch(b) - calculateMatch(a))[0] ?? selected?.item ?? round.candidates[0];
    }).filter((item): item is StoreItem => Boolean(item));
    const names = selections.map((selection) => selection.item.name);
    const candidateA: GeneratedQuestCandidate = {
      id: 'A',
      label: '你的选择 · AI 精修版',
      title: '保留你的直觉',
      strategy: '完整保留三轮选择，AI 只优化组合叙事、场景适配与封面表达。',
      score,
      reason: `保留 ${names.join('、')}，因为这组选择最能体现你的个人风格。`,
      items: selections.map((selection) => selection.item),
    };
    const candidateBScore = Math.max(82, Math.min(98, scoreCandidate(alternativeItems, 79) + (score < 92 ? 2 : -1)));
    const candidateB: GeneratedQuestCandidate = {
      id: 'B',
      label: 'AI 反转 · 情境改写版',
      title: '让场景替你改两件',
      strategy: '保留你最有辨识度的 1 件，AI 根据天气、场景和库存替换另外 2 件。',
      score: candidateBScore,
      reason: `保留 ${strongestSelection?.item.name ?? names[0]} 作为身份锚点，再用两件在售商品强化今日场景。`,
      items: alternativeItems,
    };
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
      candidateLooks: [candidateA, candidateB],
      alternativeItems,
      generationTrace: ['融合天气与今日场景', '读取风格 DNA', '核对银泰在售库存', '生成 A/B 策略与效果示意海报'],
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
