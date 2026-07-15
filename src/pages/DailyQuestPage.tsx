import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleHelp,
  Clock3,
  CloudRain,
  Copy,
  Flame,
  Gift,
  LockKeyhole,
  MapPin,
  RotateCcw,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Trophy,
  UserRoundCheck,
  Users,
  WandSparkles,
  Zap,
} from 'lucide-react';
import BottomNav from '@/components/common/BottomNav';
import { ROUTES } from '@/config/routes';
import { dailyQuestAigcProvider } from '@/services/dailyQuestAigcProvider';
import { useDailyQuestStore } from '@/stores/useDailyQuestStore';
import type {
  DailyQuestSelection,
  DailyQuestStage,
  DailyStyleQuest,
  GeneratedQuestLook,
} from '@/types/dailyQuest';
import type { StoreItem } from '@/types/store';

const QUEST_CONTEXT = {
  city: '杭州',
  temperature: 29,
  weather: '阵雨转多云',
  preferredStore: '杭州武林银泰',
  styleTags: ['电影感', '利落', '复古'],
};

const GENERATION_STEPS = [
  '融合天气与今晚场景',
  '读取你的风格 DNA',
  '核对银泰门店库存',
  '生成个性化大片与文案',
];

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '今'];

const PRODUCT_PALETTE: Record<string, { main: string; detail: string; backdrop: string }> = {
  'item-004': { main: '#c5a06a', detail: '#242018', backdrop: '#c8dcff' },
  'item-011': { main: '#f1eadc', detail: '#262626', backdrop: '#ffb5cb' },
  'item-022': { main: '#5d91c7', detail: '#f3d45b', backdrop: '#d6ff67' },
  'item-003': { main: '#315fa9', detail: '#f7c9d8', backdrop: '#ffd8e4' },
  'item-012': { main: '#d6b58c', detail: '#fff0cf', backdrop: '#b9d0ff' },
  'item-029': { main: '#202d55', detail: '#f2eee4', backdrop: '#d6ff67' },
  'item-005': { main: '#d7a68d', detail: '#5f273d', backdrop: '#c8dcff' },
  'item-010': { main: '#f6f0da', detail: '#d3aa54', backdrop: '#ffb5cb' },
  'item-018': { main: '#762b3c', detail: '#f4d8d9', backdrop: '#d6ff67' },
};

function ProductImage({ item, className }: { item: StoreItem; className?: string }) {
  const palette = PRODUCT_PALETTE[item.id] ?? { main: '#f1eadc', detail: '#202020', backdrop: '#c8dcff' };
  const style = {
    '--product-main': palette.main,
    '--product-detail': palette.detail,
    '--product-backdrop': palette.backdrop,
  } as CSSProperties;

  let artwork: React.ReactNode;
  if (item.category === 'outerwear' || item.category === 'top') {
    artwork = <div className={`quest-garment-coat ${item.id === 'item-022' ? 'quest-garment-cropped' : ''}`}><span /><i /><b /></div>;
  } else if (item.category === 'dress') {
    artwork = <div className="quest-garment-dress"><span /><i /><b /></div>;
  } else if (item.category === 'bottom') {
    artwork = <div className="quest-garment-pants"><span /><i /></div>;
  } else if (item.category === 'accessory') {
    artwork = <div className="quest-garment-necklace"><span /><i /></div>;
  } else {
    artwork = <div className={`quest-garment-shoe ${item.id === 'item-018' ? 'quest-garment-flat' : ''}`}><span /><i /></div>;
  }

  return (
    <div
      className={`${className ?? 'h-full w-full'} quest-product-art`}
      style={style}
      role="img"
      aria-label={item.name}
    >
      <span className="quest-product-edition">YINTAI EDIT</span>
      <span className="quest-product-color">{item.colors[0]}</span>
      {artwork}
    </div>
  );
}

function QuestHeader({ streak, inspiration }: { streak: number; inspiration: number }) {
  return (
    <header className="sticky top-0 z-40 border-b border-black bg-[#f6f4ee]/95 px-4 py-3 backdrop-blur safe-top">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center bg-black text-xs font-black text-[#dfff3f]">IN</span>
          <div>
            <p className="text-[10px] font-black leading-none tracking-[0.18em] text-black">MIAOJIE PLAY</p>
            <p className="mt-1 text-[10px] leading-none text-gray-500">银泰会员每日时尚副本</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 items-center gap-1 border border-black bg-[#ff5b88] px-2 text-xs font-black text-white">
            <Flame size={14} fill="currentColor" /> {streak} 天
          </span>
          <span className="inline-flex h-8 items-center gap-1 border border-black bg-[#dfff3f] px-2 text-xs font-black text-black">
            <Zap size={14} fill="currentColor" /> {inspiration}
          </span>
        </div>
      </div>
    </header>
  );
}

function QuestLobby({
  quest,
  streak,
  completedToday,
  onStart,
}: {
  quest: DailyStyleQuest;
  streak: number;
  completedToday: boolean;
  onStart: () => void;
}) {
  return (
    <motion.main
      key="lobby"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-28"
    >
      <section className="relative overflow-hidden border-b border-black bg-[#2455ff] px-4 pb-5 pt-5 text-white quest-halftone-blue">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="inline-flex items-center gap-1 border border-white bg-black px-2 py-1 text-[10px] font-black tracking-[0.16em]">
              <Sparkles size={12} /> {quest.issue}
            </p>
            <h1 className="mt-4 max-w-[290px] text-[34px] font-black leading-[1.02]">今日 AI<br />变装副本</h1>
          </div>
          <div className="grid h-[74px] w-[74px] rotate-6 place-items-center border-2 border-black bg-[#dfff3f] text-center text-black shadow-[5px_5px_0_#111]">
            <span className="text-[11px] font-black leading-tight">限时<br /><b className="text-2xl">60</b><br />秒</span>
          </div>
        </div>
        <div className="relative z-10 mt-7 border border-white/60 bg-black/80 p-3">
          <p className="text-[11px] font-bold text-[#dfff3f]">今晚的角色</p>
          <h2 className="mt-1 text-xl font-black">{quest.title}</h2>
          <p className="mt-2 text-xs leading-5 text-white/75">{quest.story}</p>
        </div>
      </section>

      <section className="border-b border-black bg-[#f6f4ee] px-4 py-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex min-h-14 items-center gap-2 border border-black bg-white p-2">
            <CalendarDays size={18} className="shrink-0 text-[#2455ff]" />
            <span><b className="block">{quest.scene}</b><span className="text-[10px] text-gray-500">AI 场景输入</span></span>
          </div>
          <div className="flex min-h-14 items-center gap-2 border border-black bg-white p-2">
            <CloudRain size={18} className="shrink-0 text-[#2455ff]" />
            <span><b className="block">{quest.weather}</b><span className="text-[10px] text-gray-500">实时天气输入</span></span>
          </div>
          <div className="flex min-h-14 items-center gap-2 border border-black bg-white p-2">
            <MapPin size={18} className="shrink-0 text-[#ff386d]" />
            <span><b className="block">{quest.storeName}</b><span className="text-[10px] text-gray-500">在售库存匹配</span></span>
          </div>
          <div className="flex min-h-14 items-center gap-2 border border-black bg-white p-2">
            <Users size={18} className="shrink-0 text-[#ff386d]" />
            <span><b className="block">好友最终裁决</b><span className="text-[10px] text-gray-500">分享后解锁奖励</span></span>
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-white px-4 py-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-[#ff386d]">7 DAY STREAK</p>
            <h2 className="mt-1 text-xl font-black">{completedToday ? '连续 7 天达成，限定卡已入库' : '还差今天，拿限定衣橱卡'}</h2>
          </div>
          <span className="text-sm font-black">{Math.min(streak, 7)}/7</span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((day, index) => {
            const done = index < Math.min(streak, 6) || completedToday;
            const today = index === 6;
            return (
              <div key={day} className="text-center">
                <div
                  className={`mx-auto grid h-9 w-full place-items-center border text-xs font-black ${
                    done
                      ? 'border-black bg-black text-[#dfff3f]'
                      : today
                        ? 'border-black bg-[#dfff3f] text-black shadow-[2px_2px_0_#111]'
                        : 'border-gray-300 bg-gray-100 text-gray-400'
                  }`}
                >
                  {done ? <Check size={15} strokeWidth={3} /> : today ? <Flame size={15} /> : index + 1}
                </div>
                <p className="mt-1 text-[9px] text-gray-500">周{day}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-[#dfff3f] px-4 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black">{completedToday ? '今日奖励已领取' : '今日通关奖励'}</p>
            <p className="mt-1 text-2xl font-black">{completedToday ? '可重玩刷新大片' : `+${quest.reward.inspiration} 灵感值`}</p>
            <p className="mt-1 text-xs text-black/70">好友完成裁决，再解锁 {quest.reward.couponLabel}</p>
          </div>
          <Gift size={38} strokeWidth={1.8} />
        </div>
        <button
          type="button"
          onClick={onStart}
          className="mt-5 flex h-14 w-full items-center justify-between border border-black bg-black px-4 text-base font-black text-white shadow-[4px_4px_0_#ff386d] active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          <span>{completedToday ? '再玩一次 · 刷新大片' : '60 秒开局'}</span>
          <ArrowRight size={22} />
        </button>
        <p className="mt-3 text-center text-[10px] font-bold text-black/55">明日预告：天台落日音乐局 · 完成今日后开启</p>
      </section>
    </motion.main>
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
  const round = quest.rounds[roundIndex];
  const progress = ((roundIndex + 1) / quest.rounds.length) * 100;
  return (
    <motion.main key="selecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100dvh-62px)] bg-[#f6f4ee] pb-8">
      <div className="border-b border-black bg-black px-4 pb-4 pt-3 text-white">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center border border-white/40" aria-label="返回副本大厅">
            <ChevronLeft size={20} />
          </button>
          <p className="text-xs font-black tracking-[0.18em]">ROUND {roundIndex + 1} / {quest.rounds.length}</p>
          <div className={`inline-flex h-9 min-w-16 items-center justify-center gap-1 border px-2 text-sm font-black ${timeLeft <= 15 ? 'border-[#ff386d] bg-[#ff386d]' : 'border-white/40'}`}>
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
        <p className="mt-2 text-xs text-gray-500">凭第一眼选。AI 会综合天气、风格 DNA 和门店库存完成最终搭配。</p>
      </section>

      <section className="grid grid-cols-3 gap-2 px-4">
        {round.candidates.map((item, index) => (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            whileTap={{ scale: 0.97 }}
            className="overflow-hidden border border-black bg-white text-left shadow-[3px_3px_0_#111] focus:outline-none focus:ring-2 focus:ring-[#2455ff]"
          >
            <div className="relative aspect-[3/4] overflow-hidden border-b border-black bg-gray-200">
              <ProductImage item={item} />
              <span className="absolute left-1 top-1 grid h-6 w-6 place-items-center border border-black bg-[#dfff3f] text-[10px] font-black">0{index + 1}</span>
              <span className="absolute bottom-1 right-1 border border-black bg-white px-1 py-0.5 text-[9px] font-black">
                {item.stockStatus === 'in_stock' ? '有货' : '少量'}
              </span>
            </div>
            <div className="min-h-[94px] p-2">
              <p className="truncate text-[10px] font-black uppercase text-[#2455ff]">{item.brand}</p>
              <p className="mt-1 line-clamp-2 min-h-8 text-xs font-bold leading-4">{item.name}</p>
              <p className="mt-1 text-xs font-black">¥{item.price}</p>
              <p className="mt-1 truncate text-[9px] text-gray-400">{item.floorLocation}</p>
            </div>
          </motion.button>
        ))}
      </section>

      <section className="mt-6 border-y border-black bg-white px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {quest.rounds.map((questRound, index) => {
            const selected = selections.find((entry) => entry.roundId === questRound.id);
            return (
              <div key={questRound.id} className={`flex min-w-0 flex-1 items-center gap-2 ${index > roundIndex ? 'opacity-35' : ''}`}>
                <div className={`grid h-7 w-7 shrink-0 place-items-center border border-black text-[10px] font-black ${selected ? 'bg-black text-[#dfff3f]' : index === roundIndex ? 'bg-[#ff5b88] text-white' : 'bg-white'}`}>
                  {selected ? <Check size={13} /> : index + 1}
                </div>
                <span className="truncate text-[10px] font-bold">{selected?.item.name ?? questRound.label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </motion.main>
  );
}

function GeneratingView({ activeStep }: { activeStep: number }) {
  return (
    <motion.main key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid min-h-[calc(100dvh-62px)] place-items-center bg-black px-6 text-white quest-halftone-dark">
      <div className="w-full">
        <div className="mx-auto grid h-24 w-24 place-items-center border-2 border-white bg-[#2455ff] shadow-[8px_8px_0_#dfff3f]">
          <WandSparkles size={44} className="animate-pulse" />
        </div>
        <p className="mt-9 text-center text-xs font-black tracking-[0.2em] text-[#dfff3f]">AI STYLE AGENT</p>
        <h1 className="mt-2 text-center text-3xl font-black">正在生成你的<br />雨夜主角大片</h1>
        <div className="mt-8 border-y border-white/30">
          {GENERATION_STEPS.map((step, index) => (
            <div key={step} className="flex h-12 items-center gap-3 border-b border-white/15 last:border-b-0">
              <span className={`grid h-6 w-6 place-items-center border text-[10px] font-black ${index < activeStep ? 'border-[#dfff3f] bg-[#dfff3f] text-black' : index === activeStep ? 'border-[#ff5b88] bg-[#ff5b88]' : 'border-white/30 text-white/40'}`}>
                {index < activeStep ? <Check size={13} /> : index + 1}
              </span>
              <span className={`text-sm font-bold ${index <= activeStep ? 'text-white' : 'text-white/35'}`}>{step}</span>
              {index === activeStep && <span className="ml-auto text-[10px] font-bold text-[#ff5b88]">处理中</span>}
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-[10px] text-white/45">本轮会生成专属评分、社交海报文案与可购同款，不是固定模板抽签。</p>
      </div>
    </motion.main>
  );
}

function LookPoster({ look }: { look: GeneratedQuestLook }) {
  const [first, second, third] = look.selections.map((selection) => selection.item);
  return (
    <div id="daily-look-poster" className="relative aspect-[4/5] overflow-hidden border-2 border-black bg-[#ff5b88] shadow-[6px_6px_0_#111]">
      <div className="absolute inset-0 quest-poster-grid opacity-35" />
      <div className="absolute left-3 top-3 z-20 border border-black bg-[#dfff3f] px-2 py-1 text-[10px] font-black">AI LOOK · 0715</div>
      <div className="absolute right-3 top-3 z-20 grid h-16 w-16 rotate-6 place-items-center border-2 border-black bg-white text-center shadow-[3px_3px_0_#111]">
        <span className="text-[9px] font-black leading-none">STYLE<br /><b className="text-2xl leading-none">{look.score}</b></span>
      </div>
      <div className="absolute left-4 top-16 h-[55%] w-[64%] -rotate-2 overflow-hidden border-2 border-black bg-gray-200 shadow-[5px_5px_0_#2455ff]">
        {first && <ProductImage item={first} />}
      </div>
      <div className="absolute right-3 top-[39%] h-[29%] w-[38%] rotate-3 overflow-hidden border-2 border-black bg-gray-200 shadow-[4px_4px_0_#dfff3f]">
        {second && <ProductImage item={second} />}
      </div>
      <div className="absolute bottom-[17%] left-5 h-[25%] w-[34%] -rotate-3 overflow-hidden border-2 border-black bg-gray-200 shadow-[4px_4px_0_#111]">
        {third && <ProductImage item={third} />}
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 border-t-2 border-black bg-black p-3 text-white">
        <p className="text-[10px] font-black tracking-[0.16em] text-[#dfff3f]">YOUR NIGHT, YOUR FRAME</p>
        <h2 className="mt-1 text-xl font-black leading-tight">{look.title}</h2>
        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/65">{look.storyCaption}</p>
      </div>
    </div>
  );
}

function QuestResult({
  quest,
  look,
  shared,
  assisted,
  onShare,
  onCopy,
  onSimulateAssist,
  onOpenStore,
  onReplay,
  showStore,
}: {
  quest: DailyStyleQuest;
  look: GeneratedQuestLook;
  shared: boolean;
  assisted: boolean;
  onShare: () => void;
  onCopy: () => void;
  onSimulateAssist: () => void;
  onOpenStore: () => void;
  onReplay: () => void;
  showStore: boolean;
}) {
  return (
    <motion.main key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#f6f4ee] pb-28">
      <section className="border-b border-black bg-white px-4 pb-5 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.14em] text-[#2455ff]">MISSION COMPLETE</p>
            <h1 className="mt-1 text-3xl font-black">今晚你是主角</h1>
          </div>
          <Trophy size={38} className="text-[#ff386d]" />
        </div>
        <div className="mt-4">
          <LookPoster look={look} />
        </div>
        <div className="mt-5 border-l-4 border-[#2455ff] pl-3">
          <p className="text-sm font-black">{look.verdict}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {look.tags.map((tag) => <span key={tag} className="border border-black bg-[#dfff3f] px-2 py-1 text-[10px] font-black">#{tag}</span>)}
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-[#2455ff] px-4 py-5 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">AI 搭配诊断</h2>
          <span className="text-[10px] font-bold text-white/55">{look.providerStage}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
          {look.dimensions.map((dimension) => (
            <div key={dimension.label}>
              <div className="flex items-center justify-between text-xs font-bold"><span>{dimension.label}</span><span>{dimension.score}</span></div>
              <div className="mt-1 h-1.5 border border-white/50 bg-black/30"><div className="h-full bg-[#dfff3f]" style={{ width: `${dimension.score}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-white/30 pt-3">
          <p className="text-[10px] font-black tracking-[0.14em] text-[#dfff3f]">AI 本轮实际完成</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {look.generationTrace.map((trace) => <p key={trace} className="flex items-center gap-1.5 text-[10px] text-white/80"><Check size={12} className="text-[#dfff3f]" />{trace}</p>)}
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-[#ff5b88] px-4 py-5 text-black">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center border border-black bg-white"><UserRoundCheck size={24} /></div>
          <div>
            <p className="text-xs font-black tracking-[0.12em]">FINAL JUDGE</p>
            <h2 className="mt-1 text-xl font-black">差一位好友，完成最终裁决</h2>
            <p className="mt-1 text-xs leading-5 text-black/65">好友不是只看广告：TA 必须在 A/B 造型中投票，你才能解锁到店券和限定卡。</p>
          </div>
        </div>

        {!shared ? (
          <div className="mt-4 grid grid-cols-[1fr_48px] gap-2">
            <button type="button" onClick={onShare} className="flex h-12 items-center justify-center gap-2 border border-black bg-black text-sm font-black text-white shadow-[3px_3px_0_#dfff3f]"><Share2 size={18} /> 邀请好友当裁判</button>
            <button type="button" onClick={onCopy} className="grid h-12 place-items-center border border-black bg-white" aria-label="复制邀请链接"><Copy size={18} /></button>
          </div>
        ) : !assisted ? (
          <div className="mt-4 border border-black bg-white p-3">
            <p className="flex items-center gap-2 text-sm font-black"><Clock3 size={17} /> 邀请已发出，等待好友裁决</p>
            <button type="button" onClick={onSimulateAssist} className="mt-3 flex h-10 w-full items-center justify-center gap-2 border border-black bg-[#dfff3f] text-xs font-black"><CircleHelp size={16} /> Demo：模拟好友完成投票</button>
          </div>
        ) : (
          <div className="mt-4 border-2 border-black bg-[#dfff3f] p-3 shadow-[4px_4px_0_#111]">
            <p className="flex items-center gap-2 text-base font-black"><Check size={20} strokeWidth={3} /> 好友选择了 A：雨幕主角</p>
            <p className="mt-1 text-xs">奖励已解锁：{quest.reward.couponLabel} + {quest.reward.collectible}</p>
          </div>
        )}
      </section>

      <section className="border-b border-black bg-white px-4 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-[#ff386d]">BUY THE LOOK</p>
            <h2 className="mt-1 text-xl font-black">同款在武林银泰可试</h2>
          </div>
          <Store size={28} />
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {look.selections.map(({ item }) => (
            <div key={item.id} className="w-[132px] shrink-0 border border-black bg-[#f6f4ee]">
              <div className="aspect-[4/3] overflow-hidden border-b border-black"><ProductImage item={item} /></div>
              <div className="p-2"><p className="text-[9px] font-black text-[#2455ff]">{item.brand}</p><p className="truncate text-xs font-bold">{item.name}</p><p className="mt-1 text-xs font-black">¥{item.price}</p></div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onOpenStore} className={`mt-4 flex h-12 w-full items-center justify-between border border-black px-3 text-sm font-black ${assisted ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}>
          <span className="inline-flex items-center gap-2">{assisted ? <ShoppingBag size={18} /> : <LockKeyhole size={18} />} 锁定同款 · 到店试穿</span>
          <ArrowRight size={18} />
        </button>

        <AnimatePresence>
          {showStore && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 border-2 border-black bg-[#dfff3f] p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-16 w-16 shrink-0 grid-cols-4 gap-0.5 border border-black bg-white p-1 quest-qr" aria-hidden="true" />
                  <div><p className="text-sm font-black">武林银泰到店任务</p><p className="mt-1 text-xs leading-5">3F 时尚女装集合点<br />出示任务码试穿，核销 ¥80 券</p></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="bg-black px-4 py-5 text-white">
        <div className="flex items-center gap-3 border border-white/25 p-3">
          <LockKeyhole size={22} className="text-[#dfff3f]" />
          <div className="min-w-0 flex-1"><p className="text-xs font-black text-[#dfff3f]">明日副本预告</p><p className="truncate text-sm font-bold">天台落日音乐局 · 新商品池 08:00 更新</p></div>
        </div>
        <button type="button" onClick={onReplay} className="mt-4 flex h-10 w-full items-center justify-center gap-2 border border-white/40 text-xs font-bold text-white/70"><RotateCcw size={15} /> 重玩今日副本</button>
      </section>
    </motion.main>
  );
}

function AssistView({ quest }: { quest: DailyStyleQuest }) {
  const navigate = useNavigate();
  const recordAssist = useDailyQuestStore((state) => state.recordAssist);
  const [choice, setChoice] = useState<'A' | 'B' | null>(null);
  const looks = useMemo(() => {
    const a = quest.rounds.map((round) => round.candidates[0]).filter(Boolean);
    const b = quest.rounds.map((round) => round.candidates[1]).filter(Boolean);
    return { A: a, B: b };
  }, [quest]);

  const vote = (value: 'A' | 'B') => {
    if (!choice) recordAssist();
    setChoice(value);
  };

  return (
    <main className="min-h-screen bg-[#f6f4ee] pb-8">
      <section className="border-b border-black bg-black px-4 pb-5 pt-5 text-white safe-top quest-halftone-dark">
        <p className="inline-flex items-center gap-1 border border-white/50 px-2 py-1 text-[10px] font-black"><Users size={12} /> 好友最终裁决</p>
        <h1 className="mt-4 text-3xl font-black leading-tight">Miya 的雨夜造型<br />由你拍板</h1>
        <p className="mt-2 text-xs text-white/60">选出更像今晚主角的一套。你的选择会直接为好友解锁到店奖励。</p>
      </section>

      {!choice ? (
        <section className="grid grid-cols-2 gap-3 px-4 py-5">
          {(['A', 'B'] as const).map((label) => (
            <button key={label} type="button" onClick={() => vote(label)} className="overflow-hidden border-2 border-black bg-white text-left shadow-[4px_4px_0_#111] active:translate-x-1 active:translate-y-1 active:shadow-none">
              <div className={`border-b-2 border-black p-2 text-xl font-black ${label === 'A' ? 'bg-[#dfff3f]' : 'bg-[#ff5b88]'}`}>LOOK {label}</div>
              <div className="grid h-60 grid-rows-3">
                {looks[label].map((item) => <div key={item.id} className="min-h-0 overflow-hidden border-b border-black last:border-b-0"><ProductImage item={item} /></div>)}
              </div>
              <div className="p-3"><p className="text-sm font-black">{label === 'A' ? '雨幕主角' : '展厅焦点'}</p><p className="mt-1 text-[10px] text-gray-500">AI 匹配：{label === 'A' ? 94 : 89} 分</p><span className="mt-3 flex h-10 items-center justify-center gap-1 border border-black bg-black text-xs font-black text-white">投这一套 <ArrowRight size={14} /></span></div>
            </button>
          ))}
        </section>
      ) : (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-8 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center border-2 border-black bg-[#dfff3f] shadow-[5px_5px_0_#111]"><Check size={42} strokeWidth={3} /></div>
          <h2 className="mt-6 text-3xl font-black">裁决完成</h2>
          <p className="mt-2 text-sm text-gray-600">你选择了 LOOK {choice}，Miya 的到店券已解锁。</p>
          <div className="mt-6 border-y border-black bg-white py-4"><p className="text-xs font-black text-[#2455ff]">你也获得</p><p className="mt-1 text-xl font-black">+20 灵感值 · 好友裁判徽章</p></div>
          <button type="button" onClick={() => navigate(ROUTES.GAME, { replace: true })} className="mt-6 flex h-14 w-full items-center justify-between border border-black bg-black px-4 text-base font-black text-white shadow-[4px_4px_0_#ff386d]"><span>我也开一局</span><ArrowRight size={22} /></button>
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
  const [timeLeft, setTimeLeft] = useState(60);
  const [look, setLook] = useState<GeneratedQuestLook | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
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
      if (active) {
        setQuest(dailyQuest);
        setTimeLeft(dailyQuest.timeLimitSeconds);
      }
    }).catch(() => active && setError('今日副本加载失败，请稍后重试'));
    return () => { active = false; };
  }, []);

  const runGeneration = useCallback(async (finalSelections: DailyQuestSelection[]) => {
    if (!quest || generationRunning.current) return;
    generationRunning.current = true;
    setStage('generating');
    setGenerationStep(0);
    setError(null);
    const stepTimer = window.setInterval(() => setGenerationStep((step) => Math.min(3, step + 1)), 520);
    try {
      const generatedLook = await dailyQuestAigcProvider.generateLook(quest, finalSelections);
      setLook(generatedLook);
      completeQuest(generatedLook.score, quest.reward.inspiration);
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
  }, [completeQuest, quest]);

  const completeMissingSelections = useCallback(() => {
    if (!quest || stage !== 'selecting' || generationRunning.current) return;
    const completed = quest.rounds.map((round) => selections.find((entry) => entry.roundId === round.id) ?? { roundId: round.id, item: round.candidates[0] });
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
    setStage('selecting');
  };

  const selectItem = (item: StoreItem) => {
    if (!quest || generationRunning.current) return;
    const round = quest.rounds[roundIndex];
    const nextSelections = [...selections.filter((entry) => entry.roundId !== round.id), { roundId: round.id, item }];
    setSelections(nextSelections);
    if (roundIndex < quest.rounds.length - 1) {
      setRoundIndex((index) => index + 1);
    } else {
      void runGeneration(nextSelections);
    }
  };

  const inviteUrl = useMemo(() => `${window.location.origin}${window.location.pathname}#${ROUTES.GAME}?assist=rain-night-${look?.id ?? 'preview'}`, [look?.id]);

  const markShared = () => {
    if (!shared) recordShare();
    setShared(true);
  };

  const shareInvite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: '帮我裁决今晚的 AI 造型', text: 'A/B 两套只能留一套，你来拍板，我才能解锁银泰到店券。', url: inviteUrl });
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
    await navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
    markShared();
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
    return <main className="grid min-h-screen place-items-center bg-[#f6f4ee] p-6 text-center"><div><Zap className="mx-auto text-[#ff386d]" size={40} /><p className="mt-4 text-lg font-black">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 border border-black bg-black px-5 py-3 text-sm font-black text-white">重新加载</button></div></main>;
  }

  if (!quest) {
    return <main className="grid min-h-screen place-items-center bg-black text-white"><div className="text-center"><Sparkles className="mx-auto animate-pulse text-[#dfff3f]" size={38} /><p className="mt-4 text-xs font-black tracking-[0.18em]">LOADING TODAY'S QUEST</p></div></main>;
  }

  if (isAssistMode) return <AssistView quest={quest} />;

  return (
    <div className="min-h-screen bg-[#f6f4ee]">
      <QuestHeader streak={streak} inspiration={inspiration} />
      <AnimatePresence mode="wait">
        {stage === 'lobby' && <QuestLobby quest={quest} streak={streak} completedToday={completedDate === quest.date} onStart={startQuest} />}
        {stage === 'selecting' && <QuestSelector quest={quest} roundIndex={roundIndex} selections={selections} timeLeft={timeLeft} onSelect={selectItem} onBack={() => setStage('lobby')} />}
        {stage === 'generating' && <GeneratingView activeStep={generationStep} />}
        {stage === 'result' && look && <QuestResult quest={quest} look={look} shared={shared} assisted={assisted} onShare={() => void shareInvite()} onCopy={() => void copyInvite()} onSimulateAssist={simulateAssist} onOpenStore={() => assisted ? setShowStore((value) => !value) : void shareInvite()} onReplay={replay} showStore={showStore} />}
      </AnimatePresence>
      {error && <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 border border-black bg-[#ff5b88] px-3 py-2 text-center text-xs font-black">{error}</div>}
      {(stage === 'lobby' || stage === 'result') && <BottomNav />}
    </div>
  );
}
