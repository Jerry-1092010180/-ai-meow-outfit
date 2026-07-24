import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudRain,
  Copy,
  Footprints,
  Gift,
  Glasses,
  Heart,
  ImageIcon,
  Info,
  LayoutGrid,
  MapPin,
  Move,
  Palette,
  RotateCcw,
  Share2,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  Upload,
  UserPlus,
  UserRound,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import BottomNav from '@/components/common/BottomNav';
import { ROUTES } from '@/config/routes';
import { dailyQuestAigcProvider } from '@/services/dailyQuestAigcProvider';
import { socialAvatarImageProvider } from '@/services/socialAvatarImageProvider';
import { socialScenePlatformProvider } from '@/services/socialScenePlatformProvider';
import { useDailyQuestStore } from '@/stores/useDailyQuestStore';
import type {
  DailyQuestOutfitSlot,
  DailyQuestSelection,
  DailyQuestStage,
  DailyStyleQuest,
  GeneratedQuestLook,
} from '@/types/dailyQuest';
import type {
  AvatarExpressionId,
  AvatarHairStyleId,
  AvatarPoseId,
  SocialAvatarMember,
  SocialSceneInteractionId,
} from '@/types/socialAvatar';
import type { StoreItem } from '@/types/store';
import { track } from '@/utils/analytics';

const QUEST_CONTEXT = {
  city: '杭州',
  temperature: 29,
  weather: '阵雨转多云',
  preferredStore: '杭州武林银泰',
  styleTags: ['电影感', '利落', '复古'],
};

const AVATAR_PREVIEW_URL = `${import.meta.env.BASE_URL}avatar-demo/stylized-avatar-v1-small.png`;

const GENERATION_STEPS = [
  '提取照片中的身份特征',
  '统一为漫画动画角色风格',
  '合成五层银泰商品穿搭',
  '生成动作、背景与分享海报',
];

const SLOT_META: Record<DailyQuestOutfitSlot, { short: string; icon: typeof Shirt }> = {
  inner: { short: '内搭', icon: Shirt },
  outerwear: { short: '外套', icon: UserRound },
  base: { short: '下装', icon: Move },
  shoes: { short: '鞋履', icon: Footprints },
  accessory: { short: '配饰', icon: Glasses },
};

const STUDIO_BACKGROUNDS = {
  neon: {
    label: '湖滨霓虹',
    style: 'linear-gradient(145deg, #090c16 0%, #142c8f 54%, #0a0c15 100%)',
    accent: '#5dff73',
  },
  gallery: {
    label: '新展画廊',
    style: 'linear-gradient(145deg, #f1eee5 0%, #c9d7ff 52%, #ffffff 100%)',
    accent: '#2455ff',
  },
  rooftop: {
    label: '城市天台',
    style: 'linear-gradient(145deg, #13152b 0%, #e65380 56%, #ffca70 100%)',
    accent: '#dfff3f',
  },
  mint: {
    label: '春日橱窗',
    style: 'linear-gradient(145deg, #ccffd6 0%, #d8ebff 48%, #fff5b8 100%)',
    accent: '#ff386d',
  },
} as const;

type StudioBackgroundId = keyof typeof STUDIO_BACKGROUNDS;
type StudioTab = 'appearance' | 'pose' | 'background' | 'social';
type PoseId = Extract<AvatarPoseId, 'editorial' | 'confident' | 'street' | 'wave'>;
type AppearanceCategory = 'all' | DailyQuestOutfitSlot | 'hair';

const HAIR_STYLES: { id: AvatarHairStyleId; label: string; color: string }[] = [
  { id: 'high-ponytail', label: '高马尾', color: '#38241f' },
  { id: 'soft-wave', label: '松弛波浪', color: '#5a3024' },
  { id: 'short-bob', label: '利落短发', color: '#18191d' },
  { id: 'long-straight', label: '柔顺长发', color: '#2c2020' },
];

const EXPRESSIONS: { id: AvatarExpressionId; label: string }[] = [
  { id: 'natural', label: '自然' },
  { id: 'smile', label: '微笑' },
  { id: 'cool', label: '酷感' },
  { id: 'surprised', label: '惊喜' },
];

const SOCIAL_INTERACTIONS: {
  id: SocialSceneInteractionId;
  label: string;
  hint: string;
}[] = [
  { id: 'side-by-side', label: '并肩逛街', hint: '稳定双人/多人构图' },
  { id: 'high-five', label: '碰拳击掌', hint: '好友互动动作' },
  { id: 'shopping-walk', label: '一起走秀', hint: '完整穿搭展示' },
  { id: 'group-selfie', label: '合照自拍', hint: '适合 3—4 人分享' },
];

const POSES: { id: PoseId; label: string; hint: string; transform: string }[] = [
  { id: 'editorial', label: '杂志站姿', hint: '默认', transform: 'translate3d(0,0,0) scale(1)' },
  { id: 'confident', label: '自信主角', hint: '封面', transform: 'translate3d(6px,-2px,0) rotate(0.8deg) scale(1.025)' },
  { id: 'street', label: '街头漫游', hint: '动态', transform: 'translate3d(-5px,-5px,0) rotate(-0.8deg) scale(1.035)' },
  { id: 'wave', label: '好友招呼', hint: '社交', transform: 'translate3d(3px,-3px,0) rotate(0.4deg) scale(1.02)' },
];

function ProductImage({
  item,
  className = 'h-full w-full',
  eager = false,
}: {
  item: StoreItem;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${className} grid place-items-center bg-[#ece9e1] text-center text-gray-500`}>
        <span>
          <ShoppingBag className="mx-auto" size={26} />
          <span className="mt-2 block text-[10px] font-bold">商品图片待同步</span>
        </span>
      </div>
    );
  }

  return (
    <img
      src={item.imageUrl}
      alt={`${item.brand} ${item.name}`}
      className={`${className} object-cover`}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  );
}

function QuestHeader({ streak, inspiration }: { streak: number; inspiration: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black bg-[#f6f4ee]/95 px-4 py-3 backdrop-blur safe-top">
      <div className="mx-auto flex max-w-[520px] items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center bg-black text-xs font-black text-[#dfff3f]">IN</span>
          <div>
            <p className="text-[10px] font-black leading-none tracking-[0.16em]">MIAOJIE PLAY</p>
            <p className="mt-1 text-[10px] leading-none text-gray-500">银泰会员每日 AI 角色副本</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 items-center gap-1 border border-black bg-[#ff5b88] px-2 text-xs font-black text-white">
            <Zap size={14} fill="currentColor" /> {streak} 天
          </span>
          <span className="inline-flex h-8 items-center gap-1 border border-black bg-[#dfff3f] px-2 text-xs font-black">
            <Sparkles size={14} fill="currentColor" /> {inspiration}
          </span>
        </div>
      </div>
    </header>
  );
}

function IdentityPicker({
  identityImage,
  onPick,
}: {
  identityImage: string | null;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-black bg-white p-3 shadow-[4px_4px_0_#111]">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.currentTarget.value = '';
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden border border-black bg-[#e8edff]"
          aria-label="上传正面照片"
        >
          {identityImage ? (
            <img src={identityImage} alt="用户上传的身份照片" className="h-full w-full object-cover" />
          ) : (
            <Camera size={30} className="text-[#2455ff]" />
          )}
          <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center bg-black text-white">
            <Upload size={14} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black tracking-[0.16em] text-[#2455ff]">IDENTITY INPUT</p>
          <h3 className="mt-1 text-base font-black">{identityImage ? '身份照片已加入' : '先用一张正面照建立身份'}</h3>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            AI 提取脸型、五官和发型特征，再统一成漫画角色。照片只用于本次 Demo 预览。
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#2455ff]"
          >
            {identityImage ? '更换照片' : '上传照片'} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PublicLookGallery({ quest }: { quest: DailyStyleQuest }) {
  const previewItems = quest.rounds.flatMap((round) => round.candidates).slice(0, 9);
  const publicLooks = [
    {
      user: 'Miya',
      title: '雨夜画廊漫游',
      tag: '法式复古',
      likes: 328,
      background: STUDIO_BACKGROUNDS.neon.style,
      filter: 'hue-rotate(12deg) saturate(1.05)',
      itemOffset: 0,
    },
    {
      user: 'Leo',
      title: '武林夜游搭子装',
      tag: '城市机能',
      likes: 216,
      background: STUDIO_BACKGROUNDS.rooftop.style,
      filter: 'hue-rotate(185deg) saturate(.82) brightness(1.03)',
      itemOffset: 3,
    },
    {
      user: 'Yuki',
      title: '周末新品开箱',
      tag: '轻甜漫画',
      likes: 451,
      background: STUDIO_BACKGROUNDS.mint.style,
      filter: 'hue-rotate(295deg) saturate(.88)',
      itemOffset: 6,
    },
  ];

  return (
    <section className="mt-6 -mx-4 border-y border-black bg-[#10131d] py-5 text-white">
      <div className="flex items-end justify-between px-4">
        <div>
          <p className="text-[10px] font-black tracking-[0.16em] text-[#dfff3f]">YINTAI LOOK PLAZA</p>
          <h2 className="mt-1 text-xl font-black">银泰穿搭广场</h2>
          <p className="mt-1 text-[10px] text-white/55">看看其他用户主动公开的动漫穿搭海报</p>
        </div>
        <Users size={25} className="text-[#ff5b88]" />
      </div>

      <div className="mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
        {publicLooks.map((entry) => {
          const outfitItems = previewItems.slice(entry.itemOffset, entry.itemOffset + 3);
          return (
            <article
              key={entry.user}
              className="min-w-[72%] snap-center overflow-hidden border border-white/40 bg-white text-black"
            >
              <div className="relative aspect-[4/5] overflow-hidden" style={{ background: entry.background }}>
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.9) 1px, transparent 1px)',
                    backgroundSize: '9px 9px',
                  }}
                />
                <span className="absolute left-2 top-2 z-20 border border-black bg-white px-2 py-1 text-[9px] font-black">
                  用户公开作品
                </span>
                <img
                  src={AVATAR_PREVIEW_URL}
                  alt={`${entry.user} 公开的穿搭海报效果示意`}
                  className="absolute inset-x-0 bottom-0 mx-auto h-[92%] w-auto max-w-none object-contain"
                  style={{ filter: entry.filter }}
                />
                <div className="absolute bottom-2 left-2 right-2 z-20 grid grid-cols-3 gap-1 bg-black/70 p-1.5 backdrop-blur">
                  {outfitItems.map((item) => (
                    <div key={item.id} className="aspect-square overflow-hidden border border-white/50">
                      <ProductImage item={item} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-[#2455ff]">@{entry.user}</p>
                    <p className="mt-1 truncate text-sm font-black">{entry.title}</p>
                    <p className="mt-1 text-[10px] text-gray-500">#{entry.tag} · 同款商品可回到银泰详情</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black">
                    <Heart size={13} fill="#ff5b88" className="text-[#ff5b88]" /> {entry.likes}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mx-4 mt-3 flex items-center justify-between border-t border-white/25 pt-3">
        <p className="text-[9px] leading-4 text-white/45">仅展示用户主动选择公开的作品，身份照片默认不公开。</p>
        <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#dfff3f]">
          发现更多 <ChevronRight size={13} />
        </span>
      </div>
    </section>
  );
}

function QuestLobby({
  quest,
  streak,
  completedToday,
  identityImage,
  onPickIdentity,
  onStart,
  onPreview,
}: {
  quest: DailyStyleQuest;
  streak: number;
  completedToday: boolean;
  identityImage: string | null;
  onPickIdentity: (file: File) => void;
  onStart: () => void;
  onPreview: () => void;
}) {
  return (
    <motion.main
      key="lobby"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-[520px] pb-28"
    >
      <section className="relative min-h-[390px] overflow-hidden border-b border-black bg-[#10131d] text-white">
        <img
          src={AVATAR_PREVIEW_URL}
          alt="漫画角色效果预览"
          className="absolute bottom-0 right-[-72px] h-[360px] w-auto max-w-none object-contain opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#10131d] via-[#10131d]/90 to-transparent" />
        <div className="relative z-10 px-4 pb-6 pt-5">
          <span className="inline-flex items-center gap-1 border border-white/60 bg-black/65 px-2 py-1 text-[10px] font-black tracking-[0.14em]">
            <Sparkles size={12} /> {quest.weeklyArc}
          </span>
          <p className="mt-5 text-[11px] font-black text-[#dfff3f]">{quest.issue} · 今日更新</p>
          <h1 className="mt-2 max-w-[260px] text-[34px] font-black leading-[1.02]">
            今天穿什么，
            <br />
            让 AI 画成你
          </h1>
          <p className="mt-4 max-w-[235px] text-xs leading-5 text-white/70">
            选完整银泰穿搭，生成保留本人特征的动漫角色，再邀请好友带着自己的角色加入同框。
          </p>
          <div className="mt-5 inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold backdrop-blur">
            <Clock3 size={15} className="text-[#dfff3f]" />
            约 {quest.estimatedCompletionSeconds} 秒完成 · 不限时
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-[#2455ff] px-4 py-4 text-white">
        <p className="text-[10px] font-black tracking-[0.16em] text-[#dfff3f]">TODAY'S STORY</p>
        <h2 className="mt-1 text-xl font-black">{quest.title}</h2>
        <p className="mt-2 text-xs leading-5 text-white/75">{quest.story}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex min-h-12 items-center gap-2 border border-white/40 bg-black/25 p-2">
            <CalendarDays size={17} /> <span>{quest.scene}</span>
          </div>
          <div className="flex min-h-12 items-center gap-2 border border-white/40 bg-black/25 p-2">
            <CloudRain size={17} /> <span>{quest.weather}</span>
          </div>
          <div className="col-span-2 flex min-h-12 items-center gap-2 border border-white/40 bg-black/25 p-2">
            <MapPin size={17} /> <span>{quest.storeName} · 商品池每日刷新</span>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f4ee] px-4 py-5">
        <IdentityPicker identityImage={identityImage} onPick={onPickIdentity} />

        <div className="mt-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black tracking-[0.16em] text-[#ff386d]">FULL LOOK</p>
              <h2 className="mt-1 text-xl font-black">不是三件，是一套完整穿搭</h2>
            </div>
            <span className="text-xs font-black">5 步</span>
          </div>
          <div className="mt-3 grid grid-cols-5 border border-black bg-white">
            {quest.rounds.map((round, index) => {
              const Icon = SLOT_META[round.slot].icon;
              return (
                <div key={round.id} className="min-w-0 border-r border-black p-2 text-center last:border-r-0">
                  <Icon className="mx-auto text-[#2455ff]" size={18} />
                  <p className="mt-1 truncate text-[9px] font-black">{index + 1}. {SLOT_META[round.slot].short}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 border border-black bg-[#dfff3f] p-3">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 shrink-0" size={22} />
            <div>
              <p className="text-sm font-black">好友共创是角色同框</p>
              <p className="mt-1 text-[11px] leading-4 text-black/65">
                好友打开邀请后，也要上传自己的照片、独立挑一套完整穿搭并生成角色。双方角色资产再进入双人或多人互动海报。
              </p>
            </div>
          </div>
        </div>

        <PublicLookGallery quest={quest} />

        <button
          type="button"
          onClick={onStart}
          className="mt-5 flex h-14 w-full items-center justify-between border border-black bg-black px-4 text-base font-black text-white shadow-[4px_4px_0_#ff386d] active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          <span>{completedToday ? '再生成一张今日角色' : '开始今日 AI 角色副本'}</span>
          <ArrowRight size={22} />
        </button>
        <button
          type="button"
          onClick={onPreview}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 border border-black bg-white text-xs font-black"
        >
          <ImageIcon size={16} /> 直接预览完整生成效果
        </button>

        <div className="mt-5 flex items-center justify-between border-t border-black pt-4">
          <div>
            <p className="text-xs font-black">连续打开 {Math.min(streak, 7)}/7 天</p>
            <p className="mt-1 text-[10px] text-gray-500">完成今日角色，领取 {quest.reward.collectible}</p>
          </div>
          <Gift size={30} className="text-[#ff386d]" />
        </div>
      </section>
    </motion.main>
  );
}

function ProductDetailSheet({
  item,
  slotLabel,
  onClose,
  onChoose,
}: {
  item: StoreItem;
  slotLabel?: string;
  onClose: () => void;
  onChoose?: (item: StoreItem) => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[91dvh] w-full max-w-[520px] overflow-y-auto border-t-2 border-black bg-[#f6f4ee] pb-[calc(18px+env(safe-area-inset-bottom))]"
      >
        <div className="sticky top-0 z-10 flex h-13 items-center justify-between border-b border-black bg-[#f6f4ee] px-4">
          <span className="text-xs font-black tracking-[0.14em]">商品详情</span>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center bg-black text-white" aria-label="关闭商品详情">
            <X size={20} />
          </button>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden border-b border-black bg-white">
          <ProductImage item={item} eager />
          <span className="absolute bottom-2 left-2 border border-black bg-white px-2 py-1 text-[9px] font-black">
            商品实拍示意 · 正式版接银泰 PIM
          </span>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2455ff]">{item.brand}</p>
          <h2 className="mt-1 text-2xl font-black">{item.name}</h2>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl font-black">¥{item.price}</span>
            {item.originalPrice && <span className="pb-1 text-xs text-gray-400 line-through">¥{item.originalPrice}</span>}
            <span className="ml-auto border border-black bg-[#dfff3f] px-2 py-1 text-[10px] font-black">
              {item.stockStatus === 'in_stock' ? '门店有货' : '仅剩少量'}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-gray-600">{item.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="border border-black bg-white p-3">
              <p className="text-[10px] text-gray-400">颜色</p>
              <p className="mt-1 font-black">{item.colors.join(' / ')}</p>
            </div>
            <div className="border border-black bg-white p-3">
              <p className="text-[10px] text-gray-400">尺码</p>
              <p className="mt-1 font-black">{item.sizes.join(' / ')}</p>
            </div>
            <div className="col-span-2 flex items-center gap-2 border border-black bg-white p-3">
              <Store size={17} className="text-[#ff386d]" />
              <span><b>{item.storeName}</b><span className="ml-2 text-gray-400">{item.floorLocation}</span></span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span key={tag} className="border border-black bg-white px-2 py-1 text-[10px] font-bold">#{tag}</span>
            ))}
          </div>

          {onChoose && (
            <button
              type="button"
              onClick={() => onChoose(item)}
              className="mt-5 flex h-14 w-full items-center justify-between border border-black bg-black px-4 text-base font-black text-white shadow-[4px_4px_0_#2455ff]"
            >
              <span>{slotLabel ? `选中这件「${slotLabel}」并返回` : '选中这件商品'}</span>
              <Check size={21} />
            </button>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

function QuestSelector({
  quest,
  roundIndex,
  selections,
  onSelect,
  onBack,
}: {
  quest: DailyStyleQuest;
  roundIndex: number;
  selections: DailyQuestSelection[];
  onSelect: (item: StoreItem) => void;
  onBack: () => void;
}) {
  const [detailItem, setDetailItem] = useState<StoreItem | null>(null);
  const round = quest.rounds[roundIndex];
  const selectedForRound = selections.find((entry) => entry.roundId === round.id)?.item ?? null;
  const [pendingItem, setPendingItem] = useState<StoreItem | null>(selectedForRound);
  const progress = ((roundIndex + 1) / quest.rounds.length) * 100;

  useEffect(() => {
    setPendingItem(selectedForRound);
    setDetailItem(null);
  }, [round.id, selectedForRound]);

  return (
    <>
      <motion.main
        key={`selecting-${round.id}`}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        className="mx-auto min-h-[calc(100dvh-62px)] max-w-[520px] bg-[#f6f4ee] pb-28"
      >
        <div className="border-b border-black bg-black px-4 pb-4 pt-3 text-white">
          <div className="flex items-center justify-between">
            <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center border border-white/40" aria-label="返回副本大厅">
              <ChevronLeft size={20} />
            </button>
            <p className="text-xs font-black tracking-[0.16em]">完整穿搭 {roundIndex + 1} / {quest.rounds.length}</p>
            <span className="inline-flex h-9 items-center justify-center gap-1 border border-white/40 px-2 text-[10px] font-black">
              <Clock3 size={14} /> 不限时
            </span>
          </div>
          <div className="mt-4 h-1 bg-white/20">
            <motion.div className="h-full bg-[#dfff3f]" animate={{ width: `${progress}%` }} />
          </div>
        </div>

        <section className="px-4 pb-4 pt-5">
          <p className="text-xs font-black text-[#2455ff]">{round.label}</p>
          <h1 className="mt-2 text-2xl font-black leading-tight">{round.prompt}</h1>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            先凭直觉点选喜欢的实拍图，选中的卡片会下沉。需要了解价格、尺码和门店时，再点卡片下方的“查看详情”。
          </p>
        </section>

        <section className="flex snap-x gap-4 overflow-x-auto px-4 pb-6 pr-8 no-scrollbar">
          {round.candidates.map((item, index) => {
            const selected = pendingItem?.id === item.id;
            return (
              <motion.article
                key={item.id}
                animate={{ x: selected ? 4 : 0, y: selected ? 4 : 0 }}
                transition={{ duration: 0.14 }}
                className={`min-w-[82%] snap-center overflow-hidden border border-black bg-white sm:min-w-[48%] ${
                  selected ? 'shadow-none' : 'shadow-[5px_5px_0_#111]'
                }`}
              >
                <motion.button
                  type="button"
                  onClick={() => setPendingItem(item)}
                  whileTap={{ scale: 0.99, y: 2 }}
                  className="block w-full text-left"
                  aria-pressed={selected}
                >
                  <div className="relative aspect-[3/4] overflow-hidden border-b border-black bg-gray-200">
                    <ProductImage item={item} eager={index === 0} />
                    <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center border border-black bg-white text-[10px] font-black">
                      0{index + 1}
                    </span>
                    {selected && (
                      <span className="absolute right-2 top-2 inline-flex h-8 items-center gap-1 border border-black bg-[#dfff3f] px-2 text-[10px] font-black shadow-[2px_2px_0_#111]">
                        <Check size={14} /> 已选中
                      </span>
                    )}
                    <span className="absolute bottom-2 left-2 border border-black bg-white px-2 py-1 text-[9px] font-black">
                      商品实拍示意
                    </span>
                  </div>
                  <div className={selected ? 'bg-[#f5ffd0] p-3' : 'p-3'}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#2455ff]">{item.brand}</p>
                        <h2 className="mt-1 truncate text-base font-black">{item.name}</h2>
                      </div>
                      <span className="shrink-0 text-lg font-black">¥{item.price}</span>
                    </div>
                  </div>
                </motion.button>
                <div className={`border-t border-black p-2 ${selected ? 'bg-[#f5ffd0]' : 'bg-white'}`}>
                  <button
                    type="button"
                    onClick={() => setDetailItem(item)}
                    className="flex h-9 w-full items-center justify-between px-2 text-xs font-black"
                  >
                    <span>查看详情</span>
                    <Info size={15} />
                  </button>
                </div>
              </motion.article>
            );
          })}
          <div className="w-1 shrink-0" />
        </section>

        <section className="border-y border-black bg-white px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {quest.rounds.map((questRound, index) => {
              const selected = selections.find((entry) => entry.roundId === questRound.id);
              const Icon = SLOT_META[questRound.slot].icon;
              return (
                <div
                  key={questRound.id}
                  className={`flex min-w-[92px] items-center gap-2 border border-black px-2 py-2 ${selected ? 'bg-black text-white' : index === roundIndex ? 'bg-[#ff5b88] text-white' : 'bg-[#f6f4ee] text-gray-400'}`}
                >
                  {selected ? <Check size={14} className="shrink-0 text-[#dfff3f]" /> : <Icon size={14} className="shrink-0" />}
                  <span className="truncate text-[10px] font-black">{selected?.item.name ?? questRound.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sticky bottom-0 z-30 border-t border-black bg-[#f6f4ee]/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black tracking-[0.12em] text-gray-400">当前选择</p>
              <p className="mt-1 truncate text-sm font-black">{pendingItem?.name ?? '先点选一件喜欢的商品'}</p>
            </div>
            <button
              type="button"
              disabled={!pendingItem}
              onClick={() => pendingItem && onSelect(pendingItem)}
              className="flex h-12 min-w-32 items-center justify-between gap-3 border border-black bg-black px-3 text-sm font-black text-white shadow-[3px_3px_0_#ff386d] disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
            >
              <span>{roundIndex === quest.rounds.length - 1 ? '确认并生成' : '确认这件'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </motion.main>

      <AnimatePresence>
        {detailItem && (
          <ProductDetailSheet
            item={detailItem}
            slotLabel={round.label}
            onClose={() => setDetailItem(null)}
            onChoose={(item) => {
              setDetailItem(null);
              setPendingItem(item);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function GeneratingView({
  activeStep,
  questTitle,
  identityImage,
}: {
  activeStep: number;
  questTitle: string;
  identityImage: string | null;
}) {
  return (
    <motion.main
      key="generating"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto grid min-h-[calc(100dvh-62px)] max-w-[520px] place-items-center overflow-hidden bg-[#11131a] px-5 text-white"
    >
      <div className="w-full">
        <div className="relative mx-auto h-44 w-36">
          <img
            src={AVATAR_PREVIEW_URL}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top opacity-35"
          />
          <div className="absolute inset-0 border-2 border-white shadow-[8px_8px_0_#2455ff]" />
          <div className="absolute -bottom-3 -right-4 grid h-14 w-14 place-items-center border-2 border-black bg-[#dfff3f] text-black">
            <WandSparkles size={27} className="animate-pulse" />
          </div>
          {identityImage && (
            <img
              src={identityImage}
              alt="用户身份输入"
              className="absolute -left-5 -top-5 h-16 w-16 rotate-[-5deg] border-2 border-black object-cover shadow-[3px_3px_0_#ff386d]"
            />
          )}
        </div>
        <p className="mt-9 text-center text-xs font-black tracking-[0.18em] text-[#dfff3f]">AIGC CONTENT PIPELINE</p>
        <h1 className="mt-2 text-center text-3xl font-black">正在生成你的<br />{questTitle}</h1>
        <div className="mt-7 border-y border-white/30">
          {GENERATION_STEPS.map((step, index) => (
            <div key={step} className="flex min-h-12 items-center gap-3 border-b border-white/15 py-2 last:border-b-0">
              <span className={`grid h-6 w-6 shrink-0 place-items-center border text-[10px] font-black ${index < activeStep ? 'border-[#dfff3f] bg-[#dfff3f] text-black' : index === activeStep ? 'border-[#ff5b88] bg-[#ff5b88]' : 'border-white/30 text-white/40'}`}>
                {index < activeStep ? <Check size={13} /> : index + 1}
              </span>
              <span className={`text-sm font-bold ${index <= activeStep ? 'text-white' : 'text-white/35'}`}>{step}</span>
              {index === activeStep && <span className="ml-auto text-[10px] font-bold text-[#ff5b88]">处理中</span>}
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-[10px] leading-4 text-white/45">
          当前 Demo 使用高质量效果图验证产品闭环；正式版由身份保持模型与商品图像生成服务替换。
        </p>
      </div>
    </motion.main>
  );
}

function AvatarCanvas({
  look,
  identityImage,
  pose,
  background,
  hairStyle,
  expression,
}: {
  look: GeneratedQuestLook;
  identityImage: string | null;
  pose: PoseId;
  background: StudioBackgroundId;
  hairStyle: AvatarHairStyleId;
  expression: AvatarExpressionId;
}) {
  const poseConfig = POSES.find((entry) => entry.id === pose) ?? POSES[0];
  const backgroundConfig = STUDIO_BACKGROUNDS[background];
  const hairLabel = HAIR_STYLES.find((entry) => entry.id === hairStyle)?.label ?? '高马尾';
  const expressionLabel = EXPRESSIONS.find((entry) => entry.id === expression)?.label ?? '自然';
  const avatarFilter = hairStyle === 'short-bob'
    ? 'saturate(.88) contrast(1.04)'
    : hairStyle === 'soft-wave'
      ? 'sepia(.08) saturate(1.08)'
      : hairStyle === 'long-straight'
        ? 'saturate(.94) brightness(.98)'
        : 'none';

  return (
    <div
      id="daily-avatar-poster"
      className="relative aspect-[4/5] overflow-hidden border-2 border-black shadow-[6px_6px_0_#111]"
      style={{ background: backgroundConfig.style }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.8) 1px, transparent 1px)',
          backgroundSize: '9px 9px',
        }}
      />
      <div className="absolute left-3 top-3 z-20 border border-black bg-[#dfff3f] px-2 py-1 text-[9px] font-black">
        AIGC 漫画角色效果预览
      </div>
      <div className="absolute right-3 top-3 z-20 border border-white/50 bg-black/65 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
        IDENTITY LOOK · {look.score}
      </div>

      {identityImage ? (
        <div className="absolute left-3 top-12 z-20">
          <img src={identityImage} alt="用户身份照片" className="h-14 w-14 border-2 border-white object-cover shadow-[3px_3px_0_#111]" />
          <span className="mt-1 block bg-black px-1 py-0.5 text-center text-[8px] font-black text-white">IDENTITY</span>
        </div>
      ) : (
        <div className="absolute left-3 top-12 z-20 grid h-14 w-14 place-items-center border-2 border-white bg-black/55 text-white">
          <UserRound size={22} />
        </div>
      )}

      <img
        src={look.avatar.imageUrl}
        alt="完整动漫角色效果预览"
        className="absolute inset-x-0 bottom-0 z-10 mx-auto h-[96%] w-auto max-w-none object-contain transition-transform duration-500"
        style={{ transform: poseConfig.transform, transformOrigin: '50% 86%', filter: avatarFilter }}
      />

      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between gap-3">
        <div className="min-w-0 bg-black/78 px-2 py-1.5 text-white backdrop-blur">
          <p className="truncate text-[10px] font-black">{look.title}</p>
          <p className="mt-0.5 text-[8px] text-white/60">
            {poseConfig.label} · {hairLabel} · {expressionLabel} · {backgroundConfig.label}
          </p>
        </div>
        <span
          className="h-3 w-10 border border-black"
          style={{ backgroundColor: backgroundConfig.accent }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function AppearancePanel({
  items,
  activeCategory,
  hairStyle,
  onCategoryChange,
  onHairStyleChange,
  onOpenItem,
}: {
  items: StoreItem[];
  activeCategory: AppearanceCategory;
  hairStyle: AvatarHairStyleId;
  onCategoryChange: (category: AppearanceCategory) => void;
  onHairStyleChange: (hairStyle: AvatarHairStyleId) => void;
  onOpenItem: (item: StoreItem) => void;
}) {
  const categories: { id: AppearanceCategory; label: string }[] = [
    { id: 'all', label: '套装' },
    { id: 'inner', label: '内搭' },
    { id: 'outerwear', label: '外套' },
    { id: 'base', label: '下装' },
    { id: 'shoes', label: '鞋子' },
    { id: 'accessory', label: '配饰' },
    { id: 'hair', label: '发型' },
  ];

  const itemForCategory = (category: AppearanceCategory) => {
    if (category === 'all' || category === 'hair') return null;
    return items.find((item) => {
      if (category === 'inner') return item.category === 'top';
      if (category === 'base') return item.category === 'bottom' || item.category === 'dress';
      return item.category === category;
    }) ?? null;
  };
  const focusedItem = itemForCategory(activeCategory);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            className={`h-9 shrink-0 border border-black px-3 text-xs font-black ${activeCategory === category.id ? 'bg-black text-white' : 'bg-white'}`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {activeCategory === 'hair' ? (
        <div className="grid grid-cols-2 gap-2">
          {HAIR_STYLES.map((hair) => (
            <button
              key={hair.id}
              type="button"
              onClick={() => onHairStyleChange(hair.id)}
              className={`border border-black bg-white p-3 text-center ${hairStyle === hair.id ? 'shadow-[3px_3px_0_#2455ff]' : ''}`}
            >
              <span className="mx-auto block h-10 w-10 rounded-full border border-black" style={{ backgroundColor: hair.color }} />
              <span className="mt-2 block text-[10px] font-black">{hair.label}</span>
              <span className="mt-1 block text-[8px] text-gray-400">重新生成发型</span>
            </button>
          ))}
        </div>
      ) : focusedItem ? (
        <button
          type="button"
          onClick={() => onOpenItem(focusedItem)}
          className="flex w-full items-center gap-3 border border-black bg-white p-2 text-left shadow-[3px_3px_0_#111]"
        >
          <div className="h-24 w-20 shrink-0 overflow-hidden border border-black">
            <ProductImage item={focusedItem} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-[#2455ff]">{focusedItem.brand}</p>
            <p className="mt-1 font-black">{focusedItem.name}</p>
            <p className="mt-1 text-xs text-gray-500">¥{focusedItem.price} · {focusedItem.storeName}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black">查看商品详情 <ChevronRight size={13} /></span>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onOpenItem(item)} className="min-w-0">
              <div className="aspect-[3/4] overflow-hidden border border-black bg-white">
                <ProductImage item={item} />
              </div>
              <p className="mt-1 truncate text-[9px] font-black">{item.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SocialScenePoster({
  hostAvatarUrl,
  hostItems,
  background,
  memberCount = 1,
  interactionId = 'side-by-side',
}: {
  hostAvatarUrl: string;
  hostItems: StoreItem[];
  background: StudioBackgroundId;
  memberCount?: number;
  interactionId?: SocialSceneInteractionId;
}) {
  const backgroundConfig = STUDIO_BACKGROUNDS[background];
  const safeMemberCount = Math.min(4, Math.max(1, memberCount));
  const memberNames = ['我', 'Miya', 'Leo', 'Nono'];
  const layouts: Record<number, { left: string; height: string; bottom: string; filter: string; flip?: boolean }[]> = {
    1: [
      { left: '10%', height: '91%', bottom: '4%', filter: 'none' },
    ],
    2: [
      { left: '-14%', height: '87%', bottom: '5%', filter: 'none' },
      { left: '43%', height: '84%', bottom: '5%', filter: 'hue-rotate(145deg) saturate(.82) brightness(1.04)', flip: true },
    ],
    3: [
      { left: '-25%', height: '78%', bottom: '5%', filter: 'none' },
      { left: '17%', height: '86%', bottom: '5%', filter: 'hue-rotate(145deg) saturate(.82) brightness(1.04)', flip: true },
      { left: '52%', height: '75%', bottom: '5%', filter: 'hue-rotate(255deg) saturate(.9) brightness(.98)' },
    ],
    4: [
      { left: '-30%', height: '69%', bottom: '5%', filter: 'none' },
      { left: '2%', height: '79%', bottom: '5%', filter: 'hue-rotate(145deg) saturate(.82) brightness(1.04)', flip: true },
      { left: '35%', height: '76%', bottom: '5%', filter: 'hue-rotate(255deg) saturate(.9) brightness(.98)' },
      { left: '65%', height: '67%', bottom: '5%', filter: 'hue-rotate(55deg) saturate(.78) brightness(1.08)', flip: true },
    ],
  };
  const interactionTransforms: Record<SocialSceneInteractionId, string[]> = {
    'side-by-side': ['rotate(-1deg)', 'rotate(1deg)', 'rotate(-.5deg)', 'rotate(.5deg)'],
    'high-five': ['translateX(7px) rotate(2deg)', 'translateX(-7px) rotate(-2deg)', 'rotate(1deg)', 'rotate(-1deg)'],
    'shopping-walk': ['translateY(-2px) rotate(-2deg)', 'translateY(3px) rotate(2deg)', 'translateY(-4px) rotate(-1deg)', 'translateY(2px) rotate(1deg)'],
    'group-selfie': ['translateY(4px) rotate(2deg)', 'translateY(-5px) rotate(-2deg)', 'translateY(1px) rotate(2deg)', 'translateY(5px) rotate(-2deg)'],
  };
  const interaction = SOCIAL_INTERACTIONS.find((entry) => entry.id === interactionId)
    ?? SOCIAL_INTERACTIONS[0];
  const members = layouts[safeMemberCount];
  return (
    <div
      className="relative aspect-[4/5] overflow-hidden border-2 border-black shadow-[6px_6px_0_#111]"
      style={{ background: backgroundConfig.style }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.85) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
        }}
      />
      <span className="absolute left-3 top-3 z-30 border border-black bg-[#dfff3f] px-2 py-1 text-[9px] font-black">
        好友共创场景 · {safeMemberCount}/4
      </span>
      {members.map((member, index) => (
        <div
          key={memberNames[index]}
          className="absolute z-10"
          style={{
            left: member.left,
            height: member.height,
            bottom: member.bottom,
            transform: interactionTransforms[interactionId][index],
            transformOrigin: '50% 86%',
          }}
        >
          <img
            src={hostAvatarUrl}
            alt={`${memberNames[index]}的动漫角色效果占位`}
            className={`h-full w-auto max-w-none object-contain ${member.flip ? 'scale-x-[-1]' : ''}`}
            style={{ filter: member.filter }}
          />
          <span className="absolute bottom-16 left-1/2 -translate-x-1/2 border border-white bg-black/75 px-2 py-1 text-[8px] font-black text-white">
            {memberNames[index]}
          </span>
        </div>
      ))}
      <div className="absolute bottom-3 left-3 right-3 z-30 grid grid-cols-5 gap-1 bg-black/72 p-2 backdrop-blur">
        {hostItems.slice(0, 5).map((item) => (
          <div key={item.id} className="aspect-square overflow-hidden border border-white/50">
            <ProductImage item={item} />
          </div>
        ))}
      </div>
      <p className="absolute right-3 top-3 z-30 bg-black/70 px-2 py-1 text-[8px] font-black text-white">
        {interaction.label} · 构图预览
      </p>
    </div>
  );
}

function SocialScenePanel({
  sceneId,
  inviteUrl,
  memberCount,
  interactionId,
  shared,
  onInteractionChange,
  onShare,
  onCopy,
  onPreviewNextFriendJoin,
}: {
  sceneId: string;
  inviteUrl: string;
  memberCount: number;
  interactionId: SocialSceneInteractionId;
  shared: boolean;
  onInteractionChange: (interactionId: SocialSceneInteractionId) => void;
  onShare: () => void;
  onCopy: () => void;
  onPreviewNextFriendJoin: () => void;
}) {
  const memberNames = ['我', 'Miya', 'Leo', 'Nono'];
  const isFull = memberCount >= 4;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black tracking-[0.14em] text-[#2455ff]">SOCIAL ROOM</p>
          <h3 className="mt-1 text-lg font-black">我的多人共创房间</h3>
          <p className="mt-1 text-[10px] text-gray-500">房间 {sceneId.slice(-8).toUpperCase()} · 同一链接最多连续加入 3 位好友</p>
        </div>
        <span className="shrink-0 border border-black bg-[#dfff3f] px-2 py-1 text-xs font-black">
          {memberCount}/4
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {memberNames.map((member, index) => {
          const joined = index < memberCount;
          return (
            <div
              key={member}
              className={`grid aspect-square place-items-center border border-black text-[10px] font-black ${
                joined
                  ? index === 0
                    ? 'bg-black text-[#dfff3f]'
                    : 'bg-[#2455ff] text-white'
                  : 'bg-white text-gray-400'
              }`}
            >
              {joined ? member : <UserPlus size={17} />}
            </div>
          );
        })}
      </div>

      <p className="mb-2 mt-4 text-[10px] font-black tracking-[0.12em] text-gray-500">同框互动模板</p>
      <div className="grid grid-cols-2 gap-2">
        {SOCIAL_INTERACTIONS.map((interaction) => (
          <button
            key={interaction.id}
            type="button"
            onClick={() => onInteractionChange(interaction.id)}
            className={`min-h-14 border border-black p-2 text-left ${
              interactionId === interaction.id
                ? 'bg-black text-white shadow-[3px_3px_0_#ff386d]'
                : 'bg-white'
            }`}
          >
            <span className="block text-xs font-black">{interaction.label}</span>
            <span className={`mt-1 block text-[9px] ${interactionId === interaction.id ? 'text-[#dfff3f]' : 'text-gray-400'}`}>
              {interaction.hint}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 border border-black bg-white p-2">
        <p className="truncate text-[9px] text-gray-500">{inviteUrl}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onShare}
            className="flex h-10 items-center justify-center gap-2 border border-black bg-[#2455ff] text-xs font-black text-white"
          >
            <Share2 size={15} /> {shared ? '继续邀请' : '发给好友'}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="flex h-10 items-center justify-center gap-2 border border-black bg-white text-xs font-black"
          >
            <Copy size={15} /> 复制链接
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onPreviewNextFriendJoin}
        disabled={isFull}
        className="mt-3 flex h-10 w-full items-center justify-between border border-black bg-[#dfff3f] px-3 text-xs font-black disabled:bg-gray-200 disabled:text-gray-400"
      >
        <span>{isFull ? '4 人场景已集齐' : `演示第 ${memberCount + 1} 位角色加入`}</span>
        {isFull ? <Check size={16} /> : <ArrowRight size={16} />}
      </button>
      <p className="mt-2 text-[9px] leading-4 text-gray-400">
        演示版用效果角色展示席位与构图；正式版每位成员都会保存独立身份、穿搭和动作资产。
      </p>
    </div>
  );
}

function SocialShowcaseBoard({
  quest,
  look,
  memberCount,
  interactionId,
  onOpenSocial,
}: {
  quest: DailyStyleQuest;
  look: GeneratedQuestLook;
  memberCount: number;
  interactionId: SocialSceneInteractionId;
  onOpenSocial: () => void;
}) {
  const interactionLabel = SOCIAL_INTERACTIONS.find((entry) => entry.id === interactionId)?.label
    ?? SOCIAL_INTERACTIONS[0].label;
  const scenes = [
    {
      title: '今日湖滨共创',
      subtitle: `${memberCount}/4 人 · ${interactionLabel}`,
      accent: 'bg-[#2455ff] text-white',
      members: memberCount,
      status: memberCount > 1 ? '进行中' : '待好友加入',
    },
    {
      title: '武林夜游搭子局',
      subtitle: '3 人 · 一起走秀',
      accent: 'bg-[#ff5b88] text-white',
      members: 3,
      status: '场景模板',
    },
    {
      title: '周末新品开箱',
      subtitle: '2 人 · 合照自拍',
      accent: 'bg-[#dfff3f] text-black',
      members: 2,
      status: '场景模板',
    },
  ];

  return (
    <section className="mt-6 border-y border-black bg-[#10131d] px-3 py-4 text-white">
      <div className="flex items-center gap-3">
        <div className="h-16 w-14 shrink-0 overflow-hidden border border-white/45 bg-black">
          <img src={look.avatar.imageUrl} alt="我的角色主页" className="h-full w-full object-cover object-top" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black tracking-[0.14em] text-[#dfff3f]">MY AVATAR STAGE</p>
          <h2 className="mt-1 text-xl font-black">我的角色社交展示板</h2>
          <p className="mt-1 truncate text-[10px] text-white/55">{quest.storeName} · {look.title}</p>
        </div>
        <LayoutGrid size={24} className="text-[#ff5b88]" />
      </div>

      <div className="mt-4 grid grid-cols-3 border-y border-white/25 py-3 text-center">
        <div>
          <p className="text-lg font-black">1</p>
          <p className="text-[9px] text-white/45">个人角色</p>
        </div>
        <div className="border-x border-white/25">
          <p className="text-lg font-black">{Math.max(0, memberCount - 1)}</p>
          <p className="text-[9px] text-white/45">共创好友</p>
        </div>
        <div>
          <p className="text-lg font-black">3</p>
          <p className="text-[9px] text-white/45">可用场景</p>
        </div>
      </div>

      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 no-scrollbar">
        {scenes.map((scene, sceneIndex) => (
          <button
            key={scene.title}
            type="button"
            onClick={sceneIndex === 0 ? onOpenSocial : undefined}
            className="min-w-[72%] snap-center border border-white/35 bg-white text-left text-black"
          >
            <div className={`flex h-9 items-center justify-between px-3 ${scene.accent}`}>
              <span className="text-[10px] font-black">{scene.status}</span>
              <span className="text-[10px] font-black">{scene.members}/4</span>
            </div>
            <div className="relative h-28 overflow-hidden bg-[#ece9e1]">
              {Array.from({ length: scene.members }).map((_, index) => (
                <img
                  key={`${scene.title}-${index}`}
                  src={look.avatar.imageUrl}
                  alt=""
                  className="absolute bottom-0 h-[105%] w-auto max-w-none object-contain"
                  style={{
                    left: `${-10 + index * (scene.members === 2 ? 42 : 27)}%`,
                    filter: index === 0 ? 'none' : `hue-rotate(${index * 115}deg) saturate(.82)`,
                    transform: index % 2 === 1 ? 'scaleX(-1)' : undefined,
                  }}
                />
              ))}
            </div>
            <div className="p-3">
              <p className="text-sm font-black">{scene.title}</p>
              <p className="mt-1 text-[10px] text-gray-500">{scene.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenSocial}
        className="mt-3 flex h-11 w-full items-center justify-between border border-white bg-white px-3 text-xs font-black text-black"
      >
        <span>打开多人共创台</span>
        <Users size={16} />
      </button>
    </section>
  );
}

function QuestResult({
  quest,
  look,
  identityImage,
  shared,
  joinedFriendCount,
  inviteUrl,
  showStore,
  onShare,
  onCopy,
  onPreviewFriendJoin,
  onOpenStore,
  onReplay,
}: {
  quest: DailyStyleQuest;
  look: GeneratedQuestLook;
  identityImage: string | null;
  shared: boolean;
  joinedFriendCount: number;
  inviteUrl: string;
  showStore: boolean;
  onShare: () => void;
  onCopy: () => void;
  onPreviewFriendJoin: () => void;
  onOpenStore: () => void;
  onReplay: () => void;
}) {
  const [tab, setTab] = useState<StudioTab>('appearance');
  const [pose, setPose] = useState<PoseId>('editorial');
  const [background, setBackground] = useState<StudioBackgroundId>('neon');
  const [hairStyle, setHairStyle] = useState<AvatarHairStyleId>('high-ponytail');
  const [expression, setExpression] = useState<AvatarExpressionId>('smile');
  const [appearanceCategory, setAppearanceCategory] = useState<AppearanceCategory>('all');
  const [interactionId, setInteractionId] = useState<SocialSceneInteractionId>('side-by-side');
  const [detailItem, setDetailItem] = useState<StoreItem | null>(null);
  const [saved, setSaved] = useState(false);
  const [publishedToPlaza, setPublishedToPlaza] = useState(false);
  const memberCount = 1 + joinedFriendCount;
  const openSocialStudio = () => {
    setTab('social');
    window.setTimeout(() => {
      document.getElementById('avatar-studio-controls')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 0);
  };

  return (
    <>
      <motion.main key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[520px] pb-32">
        <section className="border-b border-black bg-[#dfff3f] px-4 py-4">
          <p className="text-[10px] font-black tracking-[0.16em] text-[#2455ff]">TODAY'S AVATAR STUDIO</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">你的今日动漫角色已生成</h1>
              <p className="mt-1 text-xs text-black/65">同一身份，不重建角色；切换商品、动作和背景即可继续出片。</p>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center border border-black bg-black text-lg font-black text-[#dfff3f]">
              {look.score}
            </span>
          </div>
        </section>

        <section className="bg-[#f6f4ee] px-4 py-4">
          <div className="border border-black bg-white p-3">
            <p className="text-xs font-black">这是一份可持续编辑的个人角色资产</p>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              当前穿搭由 5 件商品实拍、用户身份、发型、表情、姿势和场景共同定义。好友会创建自己的独立角色，再与你进入同一个场景。
            </p>
          </div>

          <div className="mt-4">
            {tab === 'social' ? (
              <SocialScenePoster
                hostAvatarUrl={look.avatar.imageUrl}
                hostItems={look.items}
                background={background}
                memberCount={memberCount}
                interactionId={interactionId}
              />
            ) : (
              <AvatarCanvas
                look={look}
                identityImage={identityImage}
                pose={pose}
                background={background}
                hairStyle={hairStyle}
                expression={expression}
              />
            )}
          </div>

          <div id="avatar-studio-controls" className="mt-5 grid grid-cols-4 border border-black bg-white">
            {([
              ['appearance', Shirt, '形象'],
              ['pose', Move, '动作'],
              ['background', Palette, '背景'],
              ['social', Users, '共创'],
            ] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex h-12 items-center justify-center gap-1 border-r border-black text-sm font-black last:border-r-0 ${tab === id ? 'bg-black text-[#dfff3f]' : 'bg-white'}`}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-[160px] border border-black bg-[#ece9e1] p-3">
            {tab === 'appearance' && (
              <AppearancePanel
                items={look.items}
                activeCategory={appearanceCategory}
                hairStyle={hairStyle}
                onCategoryChange={setAppearanceCategory}
                onHairStyleChange={setHairStyle}
                onOpenItem={setDetailItem}
              />
            )}

            {tab === 'pose' && (
              <div className="grid grid-cols-2 gap-2">
                {POSES.map((poseOption) => (
                  <button
                    key={poseOption.id}
                    type="button"
                    onClick={() => setPose(poseOption.id)}
                    className={`min-h-16 border border-black p-3 text-left ${pose === poseOption.id ? 'bg-black text-white shadow-[3px_3px_0_#ff386d]' : 'bg-white'}`}
                  >
                    <span className="block text-sm font-black">{poseOption.label}</span>
                    <span className={`mt-1 block text-[10px] ${pose === poseOption.id ? 'text-[#dfff3f]' : 'text-gray-400'}`}>{poseOption.hint} · 重新生成动作画面</span>
                  </button>
                ))}
                <div className="col-span-2 mt-1 border-t border-black pt-3">
                  <p className="mb-2 text-[10px] font-black tracking-[0.12em] text-gray-500">脸部表情</p>
                  <div className="grid grid-cols-4 gap-2">
                    {EXPRESSIONS.map((expressionOption) => (
                      <button
                        key={expressionOption.id}
                        type="button"
                        onClick={() => setExpression(expressionOption.id)}
                        className={`h-9 border border-black text-[10px] font-black ${expression === expressionOption.id ? 'bg-[#dfff3f]' : 'bg-white'}`}
                      >
                        {expressionOption.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'background' && (
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STUDIO_BACKGROUNDS) as [StudioBackgroundId, (typeof STUDIO_BACKGROUNDS)[StudioBackgroundId]][]).map(([id, entry]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBackground(id)}
                    className={`overflow-hidden border border-black bg-white text-left ${background === id ? 'shadow-[3px_3px_0_#2455ff]' : ''}`}
                  >
                    <span className="block h-16" style={{ background: entry.style }} />
                    <span className="block px-2 py-2 text-xs font-black">{entry.label}</span>
                  </button>
                ))}
              </div>
            )}

            {tab === 'social' && (
              <SocialScenePanel
                sceneId={look.id}
                inviteUrl={inviteUrl}
                memberCount={memberCount}
                interactionId={interactionId}
                shared={shared}
                onInteractionChange={setInteractionId}
                onShare={onShare}
                onCopy={onCopy}
                onPreviewNextFriendJoin={onPreviewFriendJoin}
              />
            )}
          </div>

          <div className="mt-5 border border-black bg-white p-3">
            <div className="flex items-start gap-2">
              <WandSparkles size={20} className="mt-0.5 shrink-0 text-[#2455ff]" />
              <div>
                <p className="text-sm font-black">AIGC 在这里是内容生产者</p>
                <p className="mt-1 text-[11px] leading-4 text-gray-500">
                  它读取用户身份、完整商品选择、天气和场景，产出可持续编辑的个人角色、动作版本和社交海报，而不是只给一句推荐。
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              openSocialStudio();
              onShare();
            }}
            className="mt-5 flex h-14 w-full items-center justify-between border border-black bg-[#2455ff] px-4 text-base font-black text-white shadow-[4px_4px_0_#111]"
          >
            <span>{shared ? `继续邀请好友 · 当前 ${memberCount}/4` : '创建多人房间并邀请好友'}</span>
            <Share2 size={21} />
          </button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" onClick={onCopy} className="flex h-11 items-center justify-center gap-2 border border-black bg-white text-xs font-black">
              <Copy size={16} /> 复制共创链接
            </button>
            <button
              type="button"
              onClick={() => setSaved(true)}
              className="flex h-11 items-center justify-center gap-2 border border-black bg-white text-xs font-black"
            >
              <ImageIcon size={16} /> {saved ? '已存数字衣橱' : '保存效果图'}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 border border-black bg-white p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">发布到银泰穿搭广场</p>
              <p className="mt-1 text-[10px] leading-4 text-gray-500">
                默认仅自己可见。开启后公开动漫海报、商品清单和昵称，不公开原始身份照片。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={publishedToPlaza}
              onClick={() => {
                setPublishedToPlaza((published) => {
                  const next = !published;
                  track('daily_quest_publication_toggle', {
                    questId: quest.id,
                    lookId: look.id,
                    published: next,
                  });
                  return next;
                });
              }}
              className={`relative h-8 w-14 shrink-0 rounded-full border border-black transition-colors ${
                publishedToPlaza ? 'bg-[#dfff3f]' : 'bg-gray-200'
              }`}
              aria-label="切换是否公开到银泰穿搭广场"
            >
              <span
                className={`absolute top-1 grid h-5 w-5 place-items-center rounded-full border border-black bg-white transition-transform ${
                  publishedToPlaza ? 'translate-x-7' : 'translate-x-1'
                }`}
              >
                {publishedToPlaza && <Check size={12} />}
              </span>
            </button>
          </div>
          {publishedToPlaza && (
            <div className="border-x border-b border-black bg-[#dfff3f] px-3 py-2 text-[10px] font-black">
              已公开到穿搭广场，其他用户可以查看海报并进入同款商品详情。
            </div>
          )}

          {shared && (
            <div className="mt-4 border border-black bg-[#ffebf1] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black">多人房间链接已生效</p>
                <span className="border border-black bg-white px-2 py-1 text-[10px] font-black">{memberCount}/4</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-gray-600">
                同一个链接可以连续邀请 3 位好友。每位好友上传自己的照片、挑选自己的完整银泰穿搭，生成独立角色后加入当前场景。
              </p>
              <button
                type="button"
                onClick={openSocialStudio}
                className="mt-3 flex h-10 w-full items-center justify-between border border-black bg-black px-3 text-xs font-black text-white"
              >
                <span>查看席位、互动动作与多人构图</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {memberCount > 1 && (
            <div className="mt-4 border border-black bg-[#dfff3f] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-[#2455ff]">SOCIAL SCENE UNLOCKED</p>
                  <h2 className="mt-1 text-xl font-black">{memberCount} 人海报 + {quest.reward.couponLabel}</h2>
                  <p className="mt-1 text-[11px] text-black/60">
                    每位成员保留自己的脸、穿搭与角色资产，场景只负责组合站位、互动动作和分享画面。
                  </p>
                </div>
                <Gift size={30} />
              </div>
              <button
                type="button"
                onClick={onOpenStore}
                className="mt-3 flex h-11 w-full items-center justify-between border border-black bg-black px-3 text-xs font-black text-white"
              >
                <span>{showStore ? '收起到店任务' : '查看杭州武林银泰到店任务'}</span>
                <Store size={16} />
              </button>
              {showStore && (
                <div className="mt-3 border border-black bg-white p-3 text-xs">
                  <p className="font-black">今日线下任务</p>
                  <p className="mt-1 leading-5 text-gray-600">
                    房间成员各到任一入选商品专柜试穿并扫码，解锁“商场碰面”互动动作与多人到店纪念海报。
                  </p>
                </div>
              )}
            </div>
          )}

          <SocialShowcaseBoard
            quest={quest}
            look={look}
            memberCount={memberCount}
            interactionId={interactionId}
            onOpenSocial={openSocialStudio}
          />

          <button type="button" onClick={onReplay} className="mt-5 flex h-11 w-full items-center justify-center gap-2 text-xs font-black text-gray-500">
            <RotateCcw size={16} /> 重新选择一套穿搭
          </button>
        </section>
      </motion.main>

      <AnimatePresence>
        {detailItem && <ProductDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />}
      </AnimatePresence>
    </>
  );
}

function JoinSceneView({ quest }: { quest: DailyStyleQuest }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [identityImage, setIdentityImage] = useState<string | null>(null);
  const identityObjectUrlRef = useRef<string | null>(null);
  const [selectedLookIndex, setSelectedLookIndex] = useState(0);
  const [joinStage, setJoinStage] = useState<'pick' | 'generating' | 'joined'>('pick');
  const [joinedMemberCount, setJoinedMemberCount] = useState(2);
  const [joinError, setJoinError] = useState<string | null>(null);
  const recordCollaboration = useDailyQuestStore((state) => state.recordCollaboration);
  const params = new URLSearchParams(location.search);
  const sceneId = params.get('join') ?? 'preview-scene';
  const itemIndex = new Map(quest.rounds.flatMap((round) => round.candidates).map((item) => [item.id, item]));
  const hostItemIds = params.get('host')?.split('.').filter(Boolean) ?? [];
  const hostItems = hostItemIds
    .map((id) => itemIndex.get(id))
    .filter((item): item is StoreItem => Boolean(item));
  const resolvedHostItems = hostItems.length > 0 ? hostItems : quest.rounds.map((round) => round.candidates[0]);
  const outfitSets = [0, 1, 2].map((candidateIndex) => (
    quest.rounds.map((round) => round.candidates[candidateIndex] ?? round.candidates[0])
  ));
  const selectedItems = outfitSets[selectedLookIndex];

  useEffect(() => () => {
    if (identityObjectUrlRef.current) URL.revokeObjectURL(identityObjectUrlRef.current);
  }, []);

  const pickIdentity = (file: File) => {
    if (identityObjectUrlRef.current) URL.revokeObjectURL(identityObjectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    identityObjectUrlRef.current = objectUrl;
    setIdentityImage(objectUrl);
  };

  const shareRoom = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: '加入我们的动漫角色同框',
          text: '上传你的照片并挑一套银泰穿搭，生成自己的角色后加入这个多人场景。',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch (shareError) {
      if ((shareError as DOMException).name !== 'AbortError') {
        await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
      }
    }
  };

  const joinScene = async () => {
    if (joinStage !== 'pick') return;
    setJoinStage('generating');
    setJoinError(null);
    try {
      const friendAsset = await socialAvatarImageProvider.generateAvatar({
        requestId: `friend-avatar-${Date.now().toString(36)}`,
        identity: {
          primaryPhotoUrl: identityImage,
          additionalPhotoUrls: [],
          preserveFeatures: ['face-shape', 'eyes', 'nose', 'mouth', 'eyebrows', 'hairline', 'skin-tone'],
          beautification: {
            skinSmoothing: 'light',
            removeTemporaryBlemishes: true,
            eyeEnhancement: 'subtle',
            preserveRecognition: true,
          },
        },
        garments: selectedItems.map((item, index) => ({
          slot: quest.rounds[index].id as DailyQuestOutfitSlot,
          layerOrder: index,
          productId: item.id,
          skuId: item.skuId,
          name: item.name,
          brand: item.brand,
          category: item.category,
          sourceImageUrl: item.imageUrl,
          sourceImageRole: item.imageUrl.startsWith('/product-shots/')
            ? 'demo-licensed-placeholder'
            : 'yintai-pim-primary',
          colors: item.colors,
          fittingInstruction: 'preserve-design-and-color',
        })),
        controls: {
          poseId: 'wave',
          expressionId: 'smile',
          hairStyleId: 'soft-wave',
          backgroundId: 'neon',
        },
        renderPolicy: {
          style: 'premium-comic-animation',
          preserveIdentity: true,
          preserveGarmentDesign: true,
          coherentLayering: true,
          fullBody: true,
          fixedPoseForbidden: true,
        },
      });
      const hostMember: SocialAvatarMember = {
        memberId: `host-${sceneId}`,
        displayName: '好友',
        avatarAssetId: 'host-shared-avatar',
        avatarImageUrl: AVATAR_PREVIEW_URL,
        outfitProductIds: resolvedHostItems.map((item) => item.id),
        poseId: 'confident',
        joinedAt: new Date().toISOString(),
        role: 'host',
      };
      const friendMember: SocialAvatarMember = {
        memberId: `friend-${Date.now().toString(36)}`,
        displayName: '我',
        avatarAssetId: friendAsset.assetId,
        avatarImageUrl: friendAsset.imageUrl,
        outfitProductIds: selectedItems.map((item) => item.id),
        poseId: 'wave',
        joinedAt: new Date().toISOString(),
        role: 'friend',
      };

      const invite = await socialScenePlatformProvider.createInvite({
        sceneId,
        inviteUrl: window.location.href,
        host: hostMember,
        maxMembers: 4,
        backgroundId: 'neon',
        interactionId: 'high-five',
      });
      const session = await socialScenePlatformProvider.joinInvite(invite.inviteId, friendMember);
      const layout = session.members.length >= 4
        ? 'group-four'
        : session.members.length === 3
          ? 'trio'
          : 'duo';
      const poster = await socialAvatarImageProvider.composeSocialScene({
        sceneId,
        layout,
        backgroundId: session.backgroundId,
        interactionId: session.interactionId,
        members: session.members,
        output: { poster: true, storyImage: true, shortVideoExtension: true },
      });
      await socialScenePlatformProvider.updateScene(sceneId, {
        backgroundId: poster.request.backgroundId,
        interactionId: poster.request.interactionId,
      });
      setJoinedMemberCount(session.members.length);
      recordCollaboration();
      track('daily_quest_friend_join', {
        questId: quest.id,
        productCount: selectedItems.length,
        memberCount: session.members.length,
      });
      setJoinStage('joined');
    } catch (sceneError) {
      console.error('[DailyQuest] Join social scene failed', sceneError);
      setJoinError(sceneError instanceof Error ? sceneError.message : '加入房间失败，请稍后重试');
      setJoinStage('pick');
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-[520px] bg-[#f6f4ee] pb-10">
      <header className="border-b border-black bg-black px-4 pb-5 pt-[calc(14px+env(safe-area-inset-top))] text-white">
        <p className="text-[10px] font-black tracking-[0.16em] text-[#dfff3f]">JOIN FRIEND'S AVATAR SCENE</p>
        <h1 className="mt-2 text-3xl font-black">好友邀请你<br />带自己的角色入镜</h1>
        <p className="mt-3 text-xs leading-5 text-white/65">先建立你的身份、挑自己的银泰穿搭，再与好友生成双人互动海报。你们的角色互不覆盖。</p>
      </header>

      {joinStage === 'pick' && (
        <section className="px-4 py-5">
          <div className="border border-black bg-white p-3">
            <p className="text-xs font-black text-[#2455ff]">好友的角色已在场景中等待</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-24 w-20 shrink-0 overflow-hidden border border-black bg-[#10131d]">
                <img src={AVATAR_PREVIEW_URL} alt="好友角色预览" className="h-full w-full object-cover object-top" />
              </div>
              <div>
                <p className="text-base font-black">今晚一起拍「湖滨霓虹」</p>
                <p className="mt-1 text-[11px] leading-4 text-gray-500">互动动作：碰拳 / 并肩走 / 合照。场景最多可加入 4 位好友。</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {['好友', '我', '好友 3', '好友 4'].map((member, index) => (
                <div
                  key={member}
                  className={`grid aspect-square place-items-center border border-black text-[9px] font-black ${
                    index === 0 ? 'bg-black text-[#dfff3f]' : 'bg-white text-gray-400'
                  }`}
                >
                  {index === 0 ? member : <UserPlus size={16} />}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-gray-400">房间号 {sceneId.slice(-8).toUpperCase()} · 该链接可重复分享</p>
          </div>

          <div className="mt-4">
            <IdentityPicker identityImage={identityImage} onPick={pickIdentity} />
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-black tracking-[0.14em] text-[#ff386d]">PICK MY FULL LOOK</p>
            <h2 className="mt-1 text-xl font-black">选择我的完整穿搭</h2>
            <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-4 no-scrollbar">
              {outfitSets.map((items, index) => (
                <button
                  key={items.map((item) => item.id).join('-')}
                  type="button"
                  onClick={() => setSelectedLookIndex(index)}
                  className={`min-w-[76%] snap-center overflow-hidden border border-black bg-white text-left ${selectedLookIndex === index ? 'shadow-[5px_5px_0_#2455ff]' : 'shadow-[3px_3px_0_#111]'}`}
                >
                  <div className="grid grid-cols-5 border-b border-black">
                    {items.map((item) => (
                      <div key={item.id} className="aspect-[3/4] overflow-hidden border-r border-black last:border-r-0">
                        <ProductImage item={item} />
                      </div>
                    ))}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-black">完整穿搭 {index + 1}</p>
                    <p className="mt-1 text-[10px] text-gray-500">{items.map((item) => item.brand).join(' × ')}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-black">
                      {selectedLookIndex === index ? <Check size={14} /> : <ChevronRight size={14} />}
                      {selectedLookIndex === index ? '已选择' : '选择这套'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void joinScene()}
            className="mt-2 flex h-14 w-full items-center justify-between border border-black bg-black px-4 text-base font-black text-white shadow-[4px_4px_0_#ff386d]"
          >
            <span>生成我的角色并加入同框</span>
            <Users size={21} />
          </button>
          {joinError && (
            <p className="mt-3 border border-black bg-[#ffebf1] p-2 text-xs font-bold text-[#b1184c]">
              {joinError}
            </p>
          )}
        </section>
      )}

      {joinStage === 'generating' && (
        <section className="grid min-h-[70dvh] place-items-center px-5 text-center">
          <div>
            <WandSparkles className="mx-auto animate-pulse text-[#2455ff]" size={48} />
            <h2 className="mt-5 text-2xl font-black">正在生成你的角色</h2>
            <p className="mt-2 text-xs leading-5 text-gray-500">保留你的脸部特征，合成所选 5 件商品，再计算双人互动姿势。</p>
          </div>
        </section>
      )}

      {joinStage === 'joined' && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-6">
          <SocialScenePoster
            hostAvatarUrl={AVATAR_PREVIEW_URL}
            hostItems={resolvedHostItems}
            background="neon"
            memberCount={joinedMemberCount}
            interactionId="high-five"
          />
          <h2 className="mt-6 text-2xl font-black">你已加入 {joinedMemberCount}/4 人角色场景</h2>
          <p className="mt-2 text-sm leading-5 text-gray-600">每位成员都保留自己的身份和商品穿搭。同一个邀请链接还能继续加入新角色，并重新生成多人互动海报。</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {['房主', '我', '好友 3', '好友 4'].map((member, index) => (
              <div
                key={member}
                className={`grid aspect-square place-items-center border border-black text-[9px] font-black ${
                  index < joinedMemberCount
                    ? index === 0
                      ? 'bg-black text-[#dfff3f]'
                      : 'bg-[#2455ff] text-white'
                    : 'bg-white text-gray-400'
                }`}
              >
                {index < joinedMemberCount ? member : <UserPlus size={16} />}
              </div>
            ))}
          </div>
          <div className="mt-6 border-y border-black bg-white py-4">
            <p className="text-center text-xs font-black text-[#2455ff]">SOCIAL SCENE REWARD</p>
            <p className="mt-1 text-center text-xl font-black">+20 灵感值 · {joinedMemberCount} 人同框卡</p>
          </div>
          {joinedMemberCount < 4 && (
            <button
              type="button"
              onClick={() => void shareRoom()}
              className="mt-6 flex h-12 w-full items-center justify-between border border-black bg-[#2455ff] px-4 text-sm font-black text-white"
            >
              <span>继续分享同一链接邀请好友</span>
              <Share2 size={18} />
            </button>
          )}
          <button type="button" onClick={() => navigate(ROUTES.GAME, { replace: true })} className="mt-6 flex h-14 w-full items-center justify-between border border-black bg-black px-4 text-base font-black text-white shadow-[4px_4px_0_#ff386d]">
            <span>保存角色并进入我的工作台</span><ArrowRight size={22} />
          </button>
        </motion.section>
      )}
    </main>
  );
}

export default function DailyQuestPage() {
  const location = useLocation();
  const [quest, setQuest] = useState<DailyStyleQuest | null>(null);
  const [stage, setStage] = useState<DailyQuestStage>('lobby');
  const [roundIndex, setRoundIndex] = useState(0);
  const [selections, setSelections] = useState<DailyQuestSelection[]>([]);
  const [look, setLook] = useState<GeneratedQuestLook | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [identityImage, setIdentityImage] = useState<string | null>(null);
  const identityObjectUrlRef = useRef<string | null>(null);
  const [shared, setShared] = useState(false);
  const [joinedFriendCount, setJoinedFriendCount] = useState(0);
  const [showStore, setShowStore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRunning = useRef(false);

  const streak = useDailyQuestStore((state) => state.streak);
  const inspiration = useDailyQuestStore((state) => state.inspiration);
  const completedDate = useDailyQuestStore((state) => state.completedDate);
  const completeQuest = useDailyQuestStore((state) => state.completeQuest);
  const recordShare = useDailyQuestStore((state) => state.recordShare);
  const recordCollaboration = useDailyQuestStore((state) => state.recordCollaboration);
  const isJoinMode = new URLSearchParams(location.search).has('join');

  useEffect(() => {
    let active = true;
    dailyQuestAigcProvider.createDailyQuest(QUEST_CONTEXT).then((dailyQuest) => {
      if (!active) return;
      setQuest(dailyQuest);
      track('daily_quest_view', { questId: dailyQuest.id, joinMode: isJoinMode });
    }).catch(() => active && setError('今日副本加载失败，请稍后重试'));
    return () => {
      active = false;
    };
  }, [isJoinMode]);

  useEffect(() => () => {
    if (identityObjectUrlRef.current) URL.revokeObjectURL(identityObjectUrlRef.current);
  }, []);

  const pickIdentity = (file: File) => {
    if (identityObjectUrlRef.current) URL.revokeObjectURL(identityObjectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    identityObjectUrlRef.current = objectUrl;
    setIdentityImage(objectUrl);
    track('daily_quest_identity_upload', { size: file.size, type: file.type });
  };

  const runGeneration = useCallback(async (finalSelections: DailyQuestSelection[]) => {
    if (!quest || generationRunning.current) return;
    generationRunning.current = true;
    setStage('generating');
    setGenerationStep(0);
    setError(null);
    const stepTimer = window.setInterval(() => setGenerationStep((step) => Math.min(3, step + 1)), 540);
    try {
      const generatedLook = await dailyQuestAigcProvider.generateLook(quest, finalSelections, {
        identityImageUrl: identityImage,
        poseId: 'editorial',
        expressionId: 'smile',
        hairStyleId: 'high-ponytail',
        backgroundId: 'neon',
      });
      setLook(generatedLook);
      completeQuest(generatedLook.score, quest.reward.inspiration);
      track('daily_quest_complete', {
        questId: quest.id,
        score: generatedLook.score,
        providerStage: generatedLook.providerStage,
        identityProvided: Boolean(identityImage),
      });
      setGenerationStep(3);
      window.setTimeout(() => setStage('result'), 320);
    } catch (generationError) {
      console.error('[DailyQuest] Generation failed', generationError);
      setError('AI 生成暂时中断，请重新选择');
      setStage('selecting');
    } finally {
      window.clearInterval(stepTimer);
      generationRunning.current = false;
    }
  }, [completeQuest, identityImage, quest]);

  const startQuest = () => {
    if (!quest) return;
    setSelections([]);
    setLook(null);
    setRoundIndex(0);
    setShared(false);
    setJoinedFriendCount(0);
    setShowStore(false);
    setError(null);
    track('daily_quest_start', { questId: quest.id, replay: completedDate === quest.date });
    setStage('selecting');
  };

  const previewCompleteFlow = () => {
    if (!quest || generationRunning.current) return;
    const demoSelections = quest.rounds.map((round) => ({ roundId: round.id, item: round.candidates[0] }));
    setSelections(demoSelections);
    setRoundIndex(quest.rounds.length - 1);
    setShared(false);
    setJoinedFriendCount(0);
    setShowStore(false);
    void runGeneration(demoSelections);
  };

  const selectItem = (item: StoreItem) => {
    if (!quest || generationRunning.current) return;
    const round = quest.rounds[roundIndex];
    const nextSelections = [...selections.filter((entry) => entry.roundId !== round.id), { roundId: round.id, item }];
    setSelections(nextSelections);
    track('daily_quest_select', { questId: quest.id, roundId: round.id, productId: item.id });
    if (roundIndex < quest.rounds.length - 1) {
      setRoundIndex((index) => index + 1);
    } else {
      void runGeneration(nextSelections);
    }
  };

  const inviteUrl = useMemo(() => {
    const params = new URLSearchParams({
      join: look?.id ?? 'preview-scene',
      max: '4',
    });
    if (look) params.set('host', look.items.map((item) => item.id).join('.'));
    return `${window.location.origin}${window.location.pathname}#${ROUTES.GAME}?${params.toString()}`;
  }, [look]);

  const ensureSocialInvite = useCallback(async () => {
    if (!look) return;
    await socialScenePlatformProvider.createInvite({
      sceneId: look.id,
      inviteUrl,
      maxMembers: 4,
      backgroundId: 'neon',
      interactionId: 'side-by-side',
      host: {
        memberId: `host-${look.id}`,
        displayName: '我',
        avatarAssetId: look.avatar.assetId,
        avatarImageUrl: look.avatar.imageUrl,
        outfitProductIds: look.items.map((item) => item.id),
        poseId: 'confident',
        joinedAt: new Date().toISOString(),
        role: 'host',
      },
    });
  }, [inviteUrl, look]);

  const markShared = () => {
    if (!shared) recordShare();
    if (!shared && quest) track('daily_quest_share', { questId: quest.id, lookId: look?.id ?? 'preview' });
    setShared(true);
  };

  const shareInvite = async () => {
    try {
      await ensureSocialInvite();
      if (navigator.share) {
        await navigator.share({
          title: '带你的动漫角色来和我同框',
          text: '上传你的照片、挑一套银泰穿搭，生成自己的角色后加入我的互动海报。',
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
      }
      markShared();
    } catch (shareError) {
      if ((shareError as DOMException).name !== 'AbortError') {
        await navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
        markShared();
      }
    }
  };

  const copyInvite = async () => {
    await ensureSocialInvite().catch((inviteError) => {
      console.warn('[DailyQuest] Social invite session was not persisted', inviteError);
    });
    markShared();
    await navigator.clipboard?.writeText(inviteUrl).catch(() => undefined);
  };

  const previewFriendJoin = () => {
    setJoinedFriendCount((count) => {
      if (count >= 3) return count;
      recordCollaboration();
      if (quest) {
        track('daily_quest_friend_join', {
          questId: quest.id,
          memberCount: count + 2,
          preview: true,
        });
      }
      return count + 1;
    });
  };

  const replay = () => {
    setStage('lobby');
    setLook(null);
    setSelections([]);
    setRoundIndex(0);
    setShared(false);
    setJoinedFriendCount(0);
    setShowStore(false);
  };

  if (error && !quest) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f4ee] p-6 text-center">
        <div>
          <Zap className="mx-auto text-[#ff386d]" size={40} />
          <p className="mt-4 text-lg font-black">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 border border-black bg-black px-5 py-3 text-sm font-black text-white">
            重新加载
          </button>
        </div>
      </main>
    );
  }

  if (!quest) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        <div className="text-center">
          <Sparkles className="mx-auto animate-pulse text-[#dfff3f]" size={38} />
          <p className="mt-4 text-xs font-black tracking-[0.18em]">LOADING TODAY'S QUEST</p>
        </div>
      </main>
    );
  }

  if (isJoinMode) return <JoinSceneView quest={quest} />;

  return (
    <div className="min-h-screen bg-[#f6f4ee]">
      <QuestHeader streak={streak} inspiration={inspiration} />
      <AnimatePresence mode="wait">
        {stage === 'lobby' && (
          <QuestLobby
            quest={quest}
            streak={streak}
            completedToday={completedDate === quest.date}
            identityImage={identityImage}
            onPickIdentity={pickIdentity}
            onStart={startQuest}
            onPreview={previewCompleteFlow}
          />
        )}
        {stage === 'selecting' && (
          <QuestSelector
            quest={quest}
            roundIndex={roundIndex}
            selections={selections}
            onSelect={selectItem}
            onBack={() => setStage('lobby')}
          />
        )}
        {stage === 'generating' && (
          <GeneratingView activeStep={generationStep} questTitle={quest.title} identityImage={identityImage} />
        )}
        {stage === 'result' && look && (
          <QuestResult
            quest={quest}
            look={look}
            identityImage={identityImage}
            shared={shared}
            joinedFriendCount={joinedFriendCount}
            inviteUrl={inviteUrl}
            showStore={showStore}
            onShare={() => void shareInvite()}
            onCopy={() => void copyInvite()}
            onPreviewFriendJoin={previewFriendJoin}
            onOpenStore={() => setShowStore((value) => !value)}
            onReplay={replay}
          />
        )}
      </AnimatePresence>
      {error && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-[488px] -translate-x-1/2 border border-black bg-[#ff5b88] px-3 py-2 text-center text-xs font-black">
          {error}
        </div>
      )}
      {(stage === 'lobby' || stage === 'result') && <BottomNav />}
    </div>
  );
}
