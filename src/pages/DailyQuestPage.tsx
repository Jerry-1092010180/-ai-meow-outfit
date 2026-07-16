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
  ImageIcon,
  Info,
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
  UserRound,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import BottomNav from '@/components/common/BottomNav';
import { ROUTES } from '@/config/routes';
import { dailyQuestAigcProvider } from '@/services/dailyQuestAigcProvider';
import { useDailyQuestStore } from '@/stores/useDailyQuestStore';
import type {
  DailyQuestOutfitSlot,
  DailyQuestSelection,
  DailyQuestStage,
  DailyStyleQuest,
  GeneratedQuestCandidate,
  GeneratedQuestCandidateId,
  GeneratedQuestLook,
} from '@/types/dailyQuest';
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
type StudioTab = 'appearance' | 'pose' | 'background';
type PoseId = 'editorial' | 'confident' | 'street' | 'wave';
type AppearanceCategory = 'all' | DailyQuestOutfitSlot | 'hair';

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
            选完整银泰穿搭，生成同一身份的动漫角色海报，再邀请好友一起决定今日封面。
          </p>
          <div className="mt-5 inline-flex items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold backdrop-blur">
            <Clock3 size={15} className="text-[#dfff3f]" />
            {quest.timeLimitSeconds} 秒 · 5 个穿搭槽位
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
              <p className="text-sm font-black">好友共创不是猜谜</p>
              <p className="mt-1 text-[11px] leading-4 text-black/65">
                A 是你亲手选的完整穿搭；B 是 AI 保留身份和 3 件核心单品后，按天气与场景替换 2 件。好友选择最终分享封面。
              </p>
            </div>
          </div>
        </div>

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
              <span>加入{slotLabel ? `「${slotLabel}」` : '本次穿搭'}</span>
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
  timeLeft,
  onSelect,
  onBack,
}: {
  quest: DailyStyleQuest;
  roundIndex: number;
  selections: DailyQuestSelection[];
  timeLeft: number;
  onSelect: (item: StoreItem) => void;
  onBack: () => void;
}) {
  const [detailItem, setDetailItem] = useState<StoreItem | null>(null);
  const round = quest.rounds[roundIndex];
  const progress = ((roundIndex + 1) / quest.rounds.length) * 100;

  return (
    <>
      <motion.main
        key={`selecting-${round.id}`}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        className="mx-auto min-h-[calc(100dvh-62px)] max-w-[520px] bg-[#f6f4ee] pb-10"
      >
        <div className="border-b border-black bg-black px-4 pb-4 pt-3 text-white">
          <div className="flex items-center justify-between">
            <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center border border-white/40" aria-label="返回副本大厅">
              <ChevronLeft size={20} />
            </button>
            <p className="text-xs font-black tracking-[0.16em]">完整穿搭 {roundIndex + 1} / {quest.rounds.length}</p>
            <div className={`inline-flex h-9 min-w-16 items-center justify-center gap-1 border px-2 text-sm font-black ${timeLeft <= 20 ? 'border-[#ff386d] bg-[#ff386d]' : 'border-white/40'}`}>
              <Clock3 size={15} /> {timeLeft}s
            </div>
          </div>
          <div className="mt-4 h-1 bg-white/20">
            <motion.div className="h-full bg-[#dfff3f]" animate={{ width: `${progress}%` }} />
          </div>
        </div>

        <section className="px-4 pb-4 pt-5">
          <p className="text-xs font-black text-[#2455ff]">{round.label}</p>
          <h1 className="mt-2 text-2xl font-black leading-tight">{round.prompt}</h1>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            先看商品实拍和详情，再确认加入。AI 会把完整商品组合到同一动漫角色中。
          </p>
        </section>

        <section className="flex snap-x gap-3 overflow-x-auto px-4 pb-5 no-scrollbar">
          {round.candidates.map((item, index) => (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => setDetailItem(item)}
              whileTap={{ scale: 0.98 }}
              className="min-w-[76%] snap-center overflow-hidden border border-black bg-white text-left shadow-[4px_4px_0_#111] sm:min-w-[46%]"
            >
              <div className="relative aspect-[4/5] overflow-hidden border-b border-black bg-gray-200">
                <ProductImage item={item} eager={index === 0} />
                <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center border border-black bg-[#dfff3f] text-[10px] font-black">
                  0{index + 1}
                </span>
                <span className="absolute bottom-2 left-2 border border-black bg-white px-2 py-1 text-[9px] font-black">
                  商品实拍示意
                </span>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#2455ff]">{item.brand}</p>
                <h2 className="mt-1 min-h-10 text-base font-black leading-5">{item.name}</h2>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-black">¥{item.price}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-black">
                    查看详情 <Info size={14} />
                  </span>
                </div>
                <p className="mt-2 truncate text-[10px] text-gray-400">{item.storeName} · {item.floorLocation}</p>
              </div>
            </motion.button>
          ))}
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
      </motion.main>

      <AnimatePresence>
        {detailItem && (
          <ProductDetailSheet
            item={detailItem}
            slotLabel={round.label}
            onClose={() => setDetailItem(null)}
            onChoose={(item) => {
              setDetailItem(null);
              onSelect(item);
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

function CandidateToggle({
  candidateId,
  onChange,
}: {
  candidateId: GeneratedQuestCandidateId;
  onChange: (id: GeneratedQuestCandidateId) => void;
}) {
  return (
    <div className="grid grid-cols-2 border border-black bg-white">
      {([
        ['A', '我的完整搭配'],
        ['B', 'AI 场景优化'],
      ] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`min-h-11 border-r border-black px-2 text-xs font-black last:border-r-0 ${candidateId === id ? 'bg-black text-[#dfff3f]' : 'bg-white text-black'}`}
        >
          {id} · {label}
        </button>
      ))}
    </div>
  );
}

function AvatarCanvas({
  candidate,
  identityImage,
  pose,
  background,
}: {
  candidate: GeneratedQuestCandidate;
  identityImage: string | null;
  pose: PoseId;
  background: StudioBackgroundId;
}) {
  const poseConfig = POSES.find((entry) => entry.id === pose) ?? POSES[0];
  const backgroundConfig = STUDIO_BACKGROUNDS[background];

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
        LOOK {candidate.id} · {candidate.score}
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
        src={AVATAR_PREVIEW_URL}
        alt="完整动漫角色效果预览"
        className="absolute inset-x-0 bottom-0 z-10 mx-auto h-[96%] w-auto max-w-none object-contain transition-transform duration-500"
        style={{ transform: poseConfig.transform, transformOrigin: '50% 86%' }}
      />

      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between gap-3">
        <div className="min-w-0 bg-black/78 px-2 py-1.5 text-white backdrop-blur">
          <p className="truncate text-[10px] font-black">{candidate.title}</p>
          <p className="mt-0.5 text-[8px] text-white/60">{poseConfig.label} · {backgroundConfig.label}</p>
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
  candidate,
  activeCategory,
  onCategoryChange,
  onOpenItem,
}: {
  candidate: GeneratedQuestCandidate;
  activeCategory: AppearanceCategory;
  onCategoryChange: (category: AppearanceCategory) => void;
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
    return candidate.items.find((item) => {
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
        <div className="grid grid-cols-3 gap-2">
          {['高马尾', '松弛波浪', '利落短发'].map((hair, index) => (
            <button key={hair} type="button" className={`border border-black bg-white p-3 text-center ${index === 0 ? 'shadow-[3px_3px_0_#2455ff]' : ''}`}>
              <span className={`mx-auto block h-10 w-10 rounded-full border border-black ${['bg-[#38241f]', 'bg-[#5a3024]', 'bg-[#18191d]'][index]}`} />
              <span className="mt-2 block text-[10px] font-black">{hair}</span>
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
          {candidate.items.map((item) => (
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

function QuestResult({
  quest,
  look,
  identityImage,
  shared,
  assisted,
  showStore,
  onShare,
  onCopy,
  onSimulateAssist,
  onOpenStore,
  onReplay,
}: {
  quest: DailyStyleQuest;
  look: GeneratedQuestLook;
  identityImage: string | null;
  shared: boolean;
  assisted: boolean;
  showStore: boolean;
  onShare: () => void;
  onCopy: () => void;
  onSimulateAssist: () => void;
  onOpenStore: () => void;
  onReplay: () => void;
}) {
  const [candidateId, setCandidateId] = useState<GeneratedQuestCandidateId>('A');
  const [tab, setTab] = useState<StudioTab>('appearance');
  const [pose, setPose] = useState<PoseId>('editorial');
  const [background, setBackground] = useState<StudioBackgroundId>('neon');
  const [appearanceCategory, setAppearanceCategory] = useState<AppearanceCategory>('all');
  const [detailItem, setDetailItem] = useState<StoreItem | null>(null);
  const [saved, setSaved] = useState(false);
  const candidate = look.candidateLooks.find((entry) => entry.id === candidateId) ?? look.candidateLooks[0];

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
          <CandidateToggle candidateId={candidateId} onChange={setCandidateId} />
          <div className="mt-3 border border-black bg-white p-3">
            <p className="text-xs font-black">{candidate.label}</p>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">{candidate.strategy}</p>
          </div>

          <div className="mt-4">
            <AvatarCanvas
              candidate={candidate}
              identityImage={identityImage}
              pose={pose}
              background={background}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 border border-black bg-white">
            {([
              ['appearance', Shirt, '形象'],
              ['pose', Move, '动作'],
              ['background', Palette, '背景'],
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
                candidate={candidate}
                activeCategory={appearanceCategory}
                onCategoryChange={setAppearanceCategory}
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
                    <span className={`mt-1 block text-[10px] ${pose === poseOption.id ? 'text-[#dfff3f]' : 'text-gray-400'}`}>{poseOption.hint}动作效果位</span>
                  </button>
                ))}
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
            onClick={onShare}
            className="mt-5 flex h-14 w-full items-center justify-between border border-black bg-[#2455ff] px-4 text-base font-black text-white shadow-[4px_4px_0_#111]"
          >
            <span>{shared ? '好友共创链接已准备好' : '邀请好友共创今日封面'}</span>
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

          {shared && (
            <div className="mt-4 border border-black bg-[#ffebf1] p-3">
              <p className="text-sm font-black">好友看到的内容</p>
              <p className="mt-1 text-[11px] leading-4 text-gray-600">
                A = 你的五件完整选择；B = AI 保留身份和三件核心商品后替换两件。好友投票后，你们共同解锁到店任务。
              </p>
              <button
                type="button"
                onClick={onSimulateAssist}
                className="mt-3 flex h-10 w-full items-center justify-between border border-black bg-black px-3 text-xs font-black text-white"
              >
                <span>{assisted ? '好友 Miya 已选择 LOOK A' : '模拟好友完成裁决'}</span>
                {assisted ? <Check size={16} /> : <ArrowRight size={16} />}
              </button>
            </div>
          )}

          {assisted && (
            <div className="mt-4 border border-black bg-[#dfff3f] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-[#2455ff]">SOCIAL REWARD UNLOCKED</p>
                  <h2 className="mt-1 text-xl font-black">{quest.reward.couponLabel}</h2>
                  <p className="mt-1 text-[11px] text-black/60">好友裁决让线上角色直接连接到线下试穿与复购。</p>
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
                  <p className="mt-1 leading-5 text-gray-600">到任一入选商品专柜试穿并扫码，双方各得 80 元券，再生成一张双人同框海报。</p>
                </div>
              )}
            </div>
          )}

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

function AssistView({ quest }: { quest: DailyStyleQuest }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [choice, setChoice] = useState<GeneratedQuestCandidateId | null>(null);
  const recordAssist = useDailyQuestStore((state) => state.recordAssist);
  const params = new URLSearchParams(location.search);
  const itemIndex = new Map(quest.rounds.flatMap((round) => round.candidates).map((item) => [item.id, item]));

  const resolve = (key: 'a' | 'b', fallbackIndex: number) => {
    const ids = params.get(key)?.split('.').filter(Boolean) ?? [];
    const resolved = ids.map((id) => itemIndex.get(id)).filter((item): item is StoreItem => Boolean(item));
    return resolved.length > 0 ? resolved : quest.rounds.map((round) => round.candidates[fallbackIndex] ?? round.candidates[0]);
  };
  const looks = { A: resolve('a', 0), B: resolve('b', 1) };

  const choose = (id: GeneratedQuestCandidateId) => {
    if (choice) return;
    setChoice(id);
    recordAssist();
    track('daily_quest_friend_verdict', { questId: quest.id, choice: id });
  };

  return (
    <main className="mx-auto min-h-screen max-w-[520px] bg-[#f6f4ee] pb-10">
      <header className="border-b border-black bg-black px-4 pb-5 pt-[calc(14px+env(safe-area-inset-top))] text-white">
        <p className="text-[10px] font-black tracking-[0.16em] text-[#dfff3f]">FRIEND CO-CREATE</p>
        <h1 className="mt-2 text-3xl font-black">帮好友决定<br />今天发哪张封面</h1>
        <p className="mt-3 text-xs leading-5 text-white/65">A 是好友亲手选择的完整穿搭；B 是 AI 根据天气与场景替换两件后的版本。</p>
      </header>

      {!choice ? (
        <section className="grid grid-cols-2 gap-3 px-4 py-5">
          {(['A', 'B'] as const).map((id) => (
            <button key={id} type="button" onClick={() => choose(id)} className="overflow-hidden border border-black bg-white text-left shadow-[4px_4px_0_#111]">
              <div className="relative aspect-[3/4] overflow-hidden border-b border-black bg-[#10131d]">
                <img src={AVATAR_PREVIEW_URL} alt={`LOOK ${id} 动漫角色预览`} className={`absolute inset-0 h-full w-full object-cover object-top ${id === 'B' ? 'hue-rotate-[28deg]' : ''}`} />
                <span className="absolute left-2 top-2 grid h-8 w-8 place-items-center border border-black bg-[#dfff3f] text-sm font-black">{id}</span>
              </div>
              <div className="grid grid-cols-5 border-b border-black">
                {looks[id].map((item) => (
                  <div key={item.id} className="aspect-square overflow-hidden border-r border-black last:border-r-0">
                    <ProductImage item={item} />
                  </div>
                ))}
              </div>
              <div className="p-3">
                <p className="text-sm font-black">{id === 'A' ? '好友原选完整搭配' : 'AI 场景优化版'}</p>
                <span className="mt-3 flex h-10 items-center justify-center gap-1 border border-black bg-black text-xs font-black text-white">
                  选为今日封面 <ArrowRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </section>
      ) : (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-9 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-black bg-[#dfff3f] shadow-[5px_5px_0_#111]">
            <Check size={42} strokeWidth={3} />
          </div>
          <h2 className="mt-6 text-3xl font-black">共创完成</h2>
          <p className="mt-2 text-sm text-gray-600">你选择了 LOOK {choice}，双方的到店试穿任务已解锁。</p>
          <div className="mt-6 border-y border-black bg-white py-4">
            <p className="text-xs font-black text-[#2455ff]">你也获得</p>
            <p className="mt-1 text-xl font-black">+20 灵感值 · 好友共创徽章</p>
          </div>
          <button type="button" onClick={() => navigate(ROUTES.GAME, { replace: true })} className="mt-6 flex h-14 w-full items-center justify-between border border-black bg-black px-4 text-base font-black text-white shadow-[4px_4px_0_#ff386d]">
            <span>我也生成今日角色</span><ArrowRight size={22} />
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
  const [timeLeft, setTimeLeft] = useState(90);
  const [look, setLook] = useState<GeneratedQuestLook | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [identityImage, setIdentityImage] = useState<string | null>(null);
  const identityObjectUrlRef = useRef<string | null>(null);
  const [shared, setShared] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRunning = useRef(false);

  const streak = useDailyQuestStore((state) => state.streak);
  const inspiration = useDailyQuestStore((state) => state.inspiration);
  const completedDate = useDailyQuestStore((state) => state.completedDate);
  const completeQuest = useDailyQuestStore((state) => state.completeQuest);
  const recordShare = useDailyQuestStore((state) => state.recordShare);
  const recordAssist = useDailyQuestStore((state) => state.recordAssist);
  const isAssistMode = new URLSearchParams(location.search).has('assist');

  useEffect(() => {
    let active = true;
    dailyQuestAigcProvider.createDailyQuest(QUEST_CONTEXT).then((dailyQuest) => {
      if (!active) return;
      setQuest(dailyQuest);
      setTimeLeft(dailyQuest.timeLimitSeconds);
      track('daily_quest_view', { questId: dailyQuest.id, assistMode: isAssistMode });
    }).catch(() => active && setError('今日副本加载失败，请稍后重试'));
    return () => {
      active = false;
    };
  }, [isAssistMode]);

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
      const generatedLook = await dailyQuestAigcProvider.generateLook(quest, finalSelections);
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

  const completeMissingSelections = useCallback(() => {
    if (!quest || stage !== 'selecting' || generationRunning.current) return;
    const completed = quest.rounds.map((round) => (
      selections.find((entry) => entry.roundId === round.id) ?? { roundId: round.id, item: round.candidates[0] }
    ));
    setSelections(completed);
    void runGeneration(completed);
  }, [quest, runGeneration, selections, stage]);

  useEffect(() => {
    if (stage !== 'selecting') return;
    if (timeLeft <= 0) {
      completeMissingSelections();
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [completeMissingSelections, stage, timeLeft]);

  const startQuest = () => {
    if (!quest) return;
    setSelections([]);
    setLook(null);
    setRoundIndex(0);
    setTimeLeft(quest.timeLimitSeconds);
    setShared(false);
    setAssisted(false);
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
    setAssisted(false);
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
    const params = new URLSearchParams({ assist: look?.id ?? 'preview' });
    const [candidateA, candidateB] = look?.candidateLooks ?? [];
    if (candidateA) params.set('a', candidateA.items.map((item) => item.id).join('.'));
    if (candidateB) params.set('b', candidateB.items.map((item) => item.id).join('.'));
    return `${window.location.origin}${window.location.pathname}#${ROUTES.GAME}?${params.toString()}`;
  }, [look]);

  const markShared = () => {
    if (!shared) recordShare();
    if (!shared && quest) track('daily_quest_share', { questId: quest.id, lookId: look?.id ?? 'preview' });
    setShared(true);
  };

  const shareInvite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: '帮我共创今天的动漫角色封面',
          text: 'A 是我亲手选的完整穿搭，B 是 AI 根据今天场景替换两件后的版本。你选哪张？',
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
    markShared();
    await navigator.clipboard?.writeText(inviteUrl).catch(() => undefined);
  };

  const simulateAssist = () => {
    if (!assisted) recordAssist();
    setAssisted(true);
  };

  const replay = () => {
    setStage('lobby');
    setLook(null);
    setSelections([]);
    setRoundIndex(0);
    setShared(false);
    setAssisted(false);
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

  if (isAssistMode) return <AssistView quest={quest} />;

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
            timeLeft={timeLeft}
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
            assisted={assisted}
            showStore={showStore}
            onShare={() => void shareInvite()}
            onCopy={() => void copyInvite()}
            onSimulateAssist={simulateAssist}
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
