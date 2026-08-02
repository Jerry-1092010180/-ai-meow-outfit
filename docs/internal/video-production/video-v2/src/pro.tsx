import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  Sequence,
  interpolate,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import captionData from "./timeline-v3.json";

const FPS = 30;
const DURATION = 132 * FPS;
const FONT = '"PingFang SC","HarmonyOS Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
const C = {
  black: "#07090f",
  panel: "#10141f",
  white: "#f7f8fb",
  gray: "#9097a6",
  lime: "#d8ff48",
  blue: "#5e7cff",
  cyan: "#46dcff",
  pink: "#ff4f7b",
  orange: "#ff9d48",
};
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
const captions = captionData as Array<{
  id: number;
  scene: number;
  start: number;
  end: number;
  text: string;
  display: string;
  highlight: string;
  words: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}>;

const Backdrop: React.FC<{tone?: "blue" | "pink" | "lime"}> = ({tone = "blue"}) => {
  const frame = useCurrentFrame();
  const color = tone === "pink" ? C.pink : tone === "lime" ? C.lime : C.blue;
  const particles = Array.from({length: 22}, (_, i) => {
    const x = (i * 157 + frame * (0.16 + (i % 4) * 0.035)) % 2080 - 80;
    const y = (i * 83 + Math.sin(frame / 35 + i) * 36) % 1160 - 40;
    return {x, y, size: 2 + (i % 4)};
  });
  return (
    <AbsoluteFill style={{background: C.black, overflow: "hidden"}}>
      <div style={{position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)", backgroundSize: "72px 72px", transform: `translate(${-(frame % 72)}px,${-(frame % 72)}px)`}} />
      <div style={{position: "absolute", width: 1000, height: 1000, left: -260 + Math.sin(frame / 80) * 70, top: -420, borderRadius: "50%", background: `radial-gradient(circle,${color}45 0%,${color}10 42%,transparent 70%)`, filter: "blur(20px)"}} />
      <div style={{position: "absolute", width: 850, height: 850, right: -280, bottom: -390 + Math.cos(frame / 66) * 65, borderRadius: "50%", background: `radial-gradient(circle,${C.cyan}30 0%,transparent 68%)`, filter: "blur(16px)"}} />
      {particles.map((p, i) => <div key={i} style={{position: "absolute", left: p.x, top: p.y, width: p.size, height: p.size, borderRadius: "50%", background: i % 5 === 0 ? color : "#fff", opacity: 0.2 + (i % 4) * 0.12, boxShadow: `0 0 ${8 + p.size * 2}px ${color}`}} />)}
    </AbsoluteFill>
  );
};

const SceneShell: React.FC<{duration: number; tone?: "blue" | "pink" | "lime"; children: React.ReactNode}> = ({duration, tone, children}) => {
  const frame = useCurrentFrame();
  const inP = spring({frame, fps: FPS, config: {damping: 20, mass: 0.7}});
  const outP = interpolate(frame, [duration - 16, duration], [1, 0], clamp);
  const edge = Math.min(inP, outP);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: C.white, overflow: "hidden"}}>
      <Backdrop tone={tone} />
      <AbsoluteFill style={{opacity: edge, transform: `translateX(${(1 - inP) * 70}px) scale(${0.975 + edge * 0.025})`, filter: `blur(${(1 - edge) * 8}px)`}}>
        {children}
      </AbsoluteFill>
      <div style={{position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 180px rgba(0,0,0,.52)"}} />
    </AbsoluteFill>
  );
};

const TopLine: React.FC<{index: string; label: string}> = ({index, label}) => (
  <div style={{position: "absolute", left: 82, top: 52, right: 82, display: "flex", alignItems: "center", gap: 18, zIndex: 20}}>
    <span style={{fontSize: 20, fontWeight: 900, color: C.lime, border: `1px solid ${C.lime}88`, padding: "7px 11px", letterSpacing: 2}}>{index}</span>
    <span style={{fontSize: 20, fontWeight: 800, letterSpacing: 2, color: "#cbd0dd"}}>{label}</span>
    <span style={{height: 1, flex: 1, background: "linear-gradient(90deg,rgba(255,255,255,.35),transparent)"}} />
    <span style={{fontSize: 18, color: C.gray}}>AI 喵搭 · OPC 商业挑战赛</span>
  </div>
);

const Headline: React.FC<{kicker?: string; children: React.ReactNode; width?: number; size?: number}> = ({kicker, children, width = 980, size = 74}) => {
  const frame = useCurrentFrame();
  const p = spring({frame: frame - 5, fps: FPS, config: {damping: 16}});
  return (
    <div style={{width}}>
      {kicker && <div style={{fontSize: 22, color: C.cyan, fontWeight: 900, letterSpacing: 3, marginBottom: 22, opacity: p}}>— {kicker}</div>}
      <div style={{fontSize: size, lineHeight: 1.08, letterSpacing: -2, fontWeight: 950, transform: `translateY(${(1 - p) * 36}px)`, opacity: p}}>
        {children}
      </div>
    </div>
  );
};

const Phone: React.FC<{src: string; width?: number; rotate?: number; delay?: number; crop?: boolean}> = ({src, width = 390, rotate = 0, delay = 0, crop = false}) => {
  const frame = useCurrentFrame();
  const p = spring({frame: frame - delay, fps: FPS, config: {damping: 18, mass: 0.75}});
  const drift = Math.sin((frame + delay * 3) / 42) * 8;
  const push = 1 + Math.sin((frame + delay) / 95) * 0.018;
  return (
    <div style={{width, height: width * 2.05, padding: width * 0.022, borderRadius: width * 0.11, background: "linear-gradient(145deg,#303744,#050609 45%)", border: "2px solid rgba(255,255,255,.2)", boxShadow: "0 40px 110px rgba(0,0,0,.65),0 0 60px rgba(94,124,255,.19)", transform: `translateY(${(1 - p) * 110 + drift}px) rotate(${rotate}deg) scale(${p * push})`, opacity: p, position: "relative", overflow: "hidden"}}>
      <div style={{position: "absolute", top: width * 0.035, left: "50%", transform: "translateX(-50%)", width: width * 0.28, height: width * 0.07, borderRadius: 99, background: "#050609", zIndex: 3}} />
      <div style={{position: "absolute", inset: width * 0.022, borderRadius: width * 0.09, overflow: "hidden", background: "#111"}}>
        <Img src={staticFile(src)} style={{width: "100%", height: "100%", objectFit: crop ? "cover" : "fill", transform: `scale(${1.005 + Math.sin(frame / 110) * 0.012})`}} />
        <div style={{position: "absolute", left: 0, right: 0, height: 80, top: (frame * 3.1) % (width * 2.1) - 80, background: "linear-gradient(transparent,rgba(70,220,255,.11),transparent)", mixBlendMode: "screen"}} />
      </div>
    </div>
  );
};

const Pill: React.FC<{children: React.ReactNode; color?: string; delay?: number}> = ({children, color = C.lime, delay = 0}) => {
  const frame = useCurrentFrame();
  const p = spring({frame: frame - delay, fps: FPS, config: {damping: 15}});
  return <div style={{padding: "13px 18px", borderRadius: 999, border: `1px solid ${color}99`, background: `${color}18`, color, fontSize: 23, fontWeight: 850, transform: `scale(${0.72 + p * 0.28})`, opacity: p, boxShadow: `0 0 26px ${color}16`}}>{children}</div>;
};

const Stat: React.FC<{value: string; label: string; color?: string; delay?: number}> = ({value, label, color = C.lime, delay = 0}) => {
  const frame = useCurrentFrame();
  const p = spring({frame: frame - delay, fps: FPS, config: {damping: 14}});
  return (
    <div style={{minWidth: 190, padding: "25px 28px", background: "rgba(11,14,22,.74)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 22, backdropFilter: "blur(14px)", transform: `translateY(${(1 - p) * 26}px)`, opacity: p}}>
      <div style={{fontSize: 58, fontWeight: 950, color, lineHeight: 1}}>{value}</div>
      <div style={{fontSize: 20, color: "#c7cbd5", marginTop: 12}}>{label}</div>
    </div>
  );
};

const Hook: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const titleP = spring({frame: frame - 6, fps: FPS, config: {damping: 13, mass: 0.8}});
  const cut = interpolate(frame, [70, 130], [0, 1], clamp);
  return (
    <SceneShell duration={duration}>
      <div style={{position: "absolute", inset: 0, padding: "72px 88px"}}>
        <div style={{display: "inline-flex", gap: 14, alignItems: "center", padding: "10px 16px", background: C.lime, color: C.black, fontSize: 21, fontWeight: 950, letterSpacing: 1}}>高校创新创业比赛 · 决赛路演</div>
        <div style={{position: "absolute", left: 88, top: 205, zIndex: 4, transform: `scale(${0.9 + titleP * 0.1})`, transformOrigin: "left center"}}>
          <div style={{fontSize: 34, color: C.cyan, fontWeight: 900, letterSpacing: 7, marginBottom: 22}}>AI 喵搭 / AI MEOW OUTFIT</div>
          <div style={{fontSize: 108, lineHeight: 0.98, letterSpacing: -5, fontWeight: 950}}>
            把逛商品<br /><span style={{color: C.lime}}>变成角色故事</span>
          </div>
          <div style={{marginTop: 34, fontSize: 29, color: "#c4cad7", width: 900, lineHeight: 1.5}}>每日内容 × AIGC 角色 × 好友共创 × 商品经营闭环</div>
        </div>
        <div style={{position: "absolute", right: 30, top: 70, opacity: 0.35 + cut * 0.65, transform: `translateX(${(1 - cut) * 90}px)`}}><Phone src="ui/01-daily-lobby.png" width={375} rotate={3} /></div>
        <div style={{position: "absolute", right: 350, top: 190, opacity: cut * 0.34, transform: `scale(.84) rotate(-8deg)`}}><Phone src="ui/05-avatar-result.png" width={310} rotate={-5} delay={45} /></div>
        <div style={{position: "absolute", left: 88, bottom: 70, display: "flex", gap: 16}}>
          <Pill delay={40}>可运行 H5</Pill><Pill color={C.blue} delay={52}>现场可验证</Pill><Pill color={C.pink} delay={64}>不是 PPT 概念</Pill>
        </div>
      </div>
    </SceneShell>
  );
};

const Daily: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const stage = Math.min(2, Math.floor(frame / 110));
  return (
    <SceneShell duration={duration} tone="lime">
      <TopLine index="01" label="DAILY OPEN HOOK" />
      <div style={{position: "absolute", left: 88, top: 170}}>
        <Headline kicker="从签到，升级成日更内容" size={78}>连续 7 天，<br />每天都有“今天的我”</Headline>
        <div style={{display: "flex", gap: 16, marginTop: 46}}>
          <Stat value="7 天" label="连续城市角色章节" delay={20} />
          <Stat value="≈1′" label="轻量完成体验" color={C.cyan} delay={30} />
          <Stat value="0" label="倒计时压力" color={C.pink} delay={40} />
        </div>
        <div style={{display: "flex", gap: 14, marginTop: 30, opacity: stage >= 1 ? 1 : 0.25, transform: `translateX(${stage >= 1 ? 0 : -24}px)`}}>
          <Pill>天气变化</Pill><Pill color={C.blue}>商圈变化</Pill><Pill color={C.orange}>商品池变化</Pill>
        </div>
      </div>
      <div style={{position: "absolute", right: 135, top: 120}}><Phone src="ui/01-daily-lobby.png" width={420} rotate={1.4} /></div>
      <div style={{position: "absolute", right: 62, top: 560, width: 330, padding: 22, borderRadius: 18, background: "rgba(16,20,31,.92)", border: `1px solid ${C.lime}66`, opacity: stage >= 2 ? 1 : 0, transform: `translateY(${stage >= 2 ? 0 : 30}px)`}}>
        <div style={{color: C.lime, fontWeight: 900, fontSize: 19}}>DAY 03 / 城市夜游</div>
        <div style={{fontSize: 26, fontWeight: 850, marginTop: 9}}>今天的角色剧情已更新</div>
      </div>
    </SceneShell>
  );
};

const Products: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const active = Math.floor(frame / 45) % 5;
  const layers = ["内搭", "外套", "下装", "鞋履", "配饰"];
  return (
    <SceneShell duration={duration}>
      <TopLine index="02" label="PRODUCT IMAGE FIRST" />
      <div style={{position: "absolute", left: 82, top: 150}}>
        <Headline kicker="图片先决策，详情按需打开" size={72}>先选喜欢，<br /><span style={{color: C.lime}}>再看商品信息</span></Headline>
        <div style={{display: "flex", gap: 11, marginTop: 40}}>
          {layers.map((item, i) => <div key={item} style={{width: 112, height: 112, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 23, fontWeight: 900, background: active === i ? C.blue : "rgba(255,255,255,.06)", border: `1px solid ${active === i ? C.cyan : "rgba(255,255,255,.14)"}`, transform: `translateY(${active === i ? -10 : 0}px)`, boxShadow: active === i ? `0 18px 45px ${C.blue}55` : "none"}}>{item}</div>)}
        </div>
        <div style={{marginTop: 36, display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 850}}>
          <span style={{color: C.gray}}>点卡片</span><span style={{color: C.lime}}>只选中</span><span>→</span><span style={{color: C.gray}}>查看详情</span><span style={{color: C.cyan}}>价格 · 尺码 · 门店</span>
        </div>
      </div>
      <div style={{position: "absolute", right: 420, top: 135}}><Phone src="ui/02-product-selection.png" width={350} rotate={-4} /></div>
      <div style={{position: "absolute", right: 70, top: 155}}><Phone src="ui/03-product-detail.png" width={350} rotate={3.5} delay={35} /></div>
      <div style={{position: "absolute", right: 295, top: 230, width: 170, height: 170, borderRadius: "50%", background: C.lime, color: C.black, display: "grid", placeItems: "center", textAlign: "center", fontWeight: 950, fontSize: 30, transform: `rotate(${Math.sin(frame / 34) * 5}deg)`, boxShadow: `0 0 60px ${C.lime}55`}}>5 层<br />完整 Look</div>
    </SceneShell>
  );
};

const Engine: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const inputs = [
    {x: 270, y: 230, text: "用户身份"},
    {x: 260, y: 480, text: "五层商品"},
    {x: 310, y: 740, text: "当天故事"},
    {x: 1600, y: 300, text: "动作表情"},
    {x: 1570, y: 650, text: "社交场景"},
  ];
  const pulse = 0.72 + Math.sin(frame / 10) * 0.18;
  return (
    <SceneShell duration={duration}>
      <TopLine index="03" label="AIGC CONTENT ENGINE" />
      <div style={{position: "absolute", left: 500, right: 500, top: 135, textAlign: "center"}}>
        <div style={{fontSize: 64, fontWeight: 950}}>AI 不是一句建议</div>
        <div style={{fontSize: 28, color: "#b8bfce", marginTop: 15}}>它是一台持续生产角色内容的引擎</div>
      </div>
      <svg width="1920" height="1080" style={{position: "absolute", inset: 0}}>
        {inputs.map((n, i) => (
          <g key={n.text}>
            <line x1={n.x} y1={n.y} x2={960} y2={560} stroke={i % 2 ? C.cyan : C.blue} strokeWidth={2.5} strokeDasharray="12 14" strokeDashoffset={-(frame * (1.4 + i * 0.1))} opacity={0.65} />
            <circle cx={interpolate((frame * 0.012 + i * 0.14) % 1, [0, 1], [n.x, 960])} cy={interpolate((frame * 0.012 + i * 0.14) % 1, [0, 1], [n.y, 560])} r="6" fill={C.lime} />
          </g>
        ))}
      </svg>
      <div style={{position: "absolute", left: 760, top: 360, width: 400, height: 400, borderRadius: "50%", display: "grid", placeItems: "center", background: `radial-gradient(circle,${C.blue}aa 0%,${C.blue}45 36%,transparent 69%)`, border: `2px solid ${C.cyan}88`, boxShadow: `0 0 ${80 * pulse}px ${C.blue}`, transform: `scale(${pulse})`}}>
        <div style={{textAlign: "center"}}><div style={{fontSize: 72, fontWeight: 950}}>AIGC</div><div style={{fontSize: 22, color: "#dce1ef"}}>GENERATION ORCHESTRATOR</div></div>
      </div>
      {inputs.map((n, i) => <div key={n.text} style={{position: "absolute", left: n.x - 105, top: n.y - 42, width: 210, padding: "19px 10px", borderRadius: 18, textAlign: "center", background: "rgba(15,19,30,.92)", border: `1px solid ${i % 2 ? C.cyan : C.blue}88`, fontSize: 24, fontWeight: 900, boxShadow: "0 18px 50px rgba(0,0,0,.4)"}}>{n.text}</div>)}
      <div style={{position: "absolute", left: 650, bottom: 86, right: 650, display: "flex", justifyContent: "center", gap: 16}}><Pill color={C.lime} delay={35}>个人角色</Pill><Pill color={C.cyan} delay={50}>动作变体</Pill><Pill color={C.pink} delay={65}>多人海报</Pill></div>
    </SceneShell>
  );
};

const Identity: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const stage = Math.floor(frame / 78) % 4;
  const edits = ["商品", "发型", "动作", "背景"];
  return (
    <SceneShell duration={duration} tone="pink">
      <TopLine index="04" label="IDENTITY-PRESERVING STYLIZATION" />
      <div style={{position: "absolute", left: 100, top: 160}}><Phone src="ui/05-avatar-result.png" width={405} rotate={-2} /></div>
      <div style={{position: "absolute", left: 650, top: 175}}>
        <Headline kicker="像自己，但更有角色感" width={1120} size={76}>不是模板人，<br />是可持续更新的<span style={{color: C.pink}}>身份资产</span></Headline>
        <div style={{fontSize: 28, color: "#b9bfcc", marginTop: 32, maxWidth: 1000, lineHeight: 1.55}}>身份特征保持稳定；商品与表达层继续变化。一次生成，沉淀成长期内容资产。</div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(4,180px)", gap: 15, marginTop: 48}}>
          {edits.map((e, i) => <div key={e} style={{height: 130, borderRadius: 20, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 900, background: stage === i ? C.pink : "rgba(255,255,255,.055)", color: stage === i ? "white" : "#c8cdd8", border: `1px solid ${stage === i ? "#ff9ab3" : "rgba(255,255,255,.12)"}`, boxShadow: stage === i ? `0 18px 55px ${C.pink}55` : "none", transform: `scale(${stage === i ? 1.06 : 1})`}}>{e}<span style={{display: "block", fontSize: 16, color: stage === i ? "white" : C.gray}}>{stage === i ? "正在生成新版本" : "可继续编辑"}</span></div>)}
        </div>
        <div style={{marginTop: 38, display: "flex", gap: 16}}><Pill color={C.lime}>IDENTITY LOCK</Pill><Pill color={C.blue}>VISUAL CONSISTENCY</Pill></div>
      </div>
    </SceneShell>
  );
};

const Variations: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const options = ["杂志站姿", "自信主角", "街头漫游", "好友招呼", "自然", "微笑", "酷感", "惊喜"];
  const active = Math.floor(frame / 34) % options.length;
  return (
    <SceneShell duration={duration}>
      <TopLine index="05" label="CONTENT VARIATIONS" />
      <div style={{position: "absolute", left: 85, top: 165}}>
        <Headline kicker="一个身份，持续产生新表达" size={75}>每一次选择，<br />都是一条<span style={{color: C.cyan}}>新内容</span></Headline>
        <div style={{display: "grid", gridTemplateColumns: "repeat(4,190px)", gap: 14, marginTop: 45}}>
          {options.map((o, i) => <div key={o} style={{height: 90, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 23, fontWeight: 900, color: active === i ? C.black : "#d4d8e2", background: active === i ? C.lime : "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", transform: `scale(${active === i ? 1.08 : 1}) rotate(${active === i ? -2 : 0}deg)`, boxShadow: active === i ? `0 20px 48px ${C.lime}35` : "none"}}>{o}</div>)}
        </div>
        <div style={{marginTop: 35, color: C.gray, fontSize: 24}}>动作 × 表情 × 发型 × 背景 = 可持续的内容组合</div>
      </div>
      <div style={{position: "absolute", right: 145, top: 120}}><Phone src="ui/06-pose-expression.png" width={420} rotate={2.5} /></div>
    </SceneShell>
  );
};

const Share: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const flow = interpolate(frame % 120, [0, 120], [0, 1], clamp);
  return (
    <SceneShell duration={duration} tone="pink">
      <TopLine index="06" label="FRIEND CO-CREATION" />
      <div style={{position: "absolute", left: 70, top: 145}}><Phone src="ui/07-friend-cocreate.png" width={345} rotate={-5} /></div>
      <div style={{position: "absolute", right: 75, top: 145}}><Phone src="ui/08-friend-joined.png" width={345} rotate={5} delay={32} /></div>
      <svg width="1920" height="1080" style={{position: "absolute", inset: 0}}>
        <path d="M410 520 C650 390, 1260 390, 1510 520" fill="none" stroke={C.pink} strokeWidth="4" strokeDasharray="12 13" strokeDashoffset={-frame * 2} opacity=".75" />
        <circle cx={interpolate(flow, [0, 1], [410, 1510])} cy={520 - Math.sin(flow * Math.PI) * 130} r="12" fill={C.lime} style={{filter: `drop-shadow(0 0 15px ${C.lime})`}} />
      </svg>
      <div style={{position: "absolute", left: 500, right: 500, top: 195, textAlign: "center"}}>
        <div style={{fontSize: 70, lineHeight: 1.1, fontWeight: 950}}>分享不是投票<br /><span style={{color: C.pink}}>是“等你入镜”</span></div>
        <div style={{display: "flex", justifyContent: "center", gap: 16, marginTop: 50}}><Stat value="2–4 人" label="同场景角色共创" color={C.pink} /><Stat value="100%" label="身份与商品独立" color={C.cyan} delay={25} /></div>
        <div style={{display: "flex", justifyContent: "center", gap: 10, marginTop: 30}}><Pill>各自建角色</Pill><Pill color={C.blue}>各自选 Look</Pill><Pill color={C.pink}>一起入镜</Pill></div>
      </div>
    </SceneShell>
  );
};

const Journey: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const active = Math.min(3, Math.floor(frame / 80));
  const steps = [
    ["01", "上传身份"],
    ["02", "选择 Look"],
    ["03", "生成角色"],
    ["04", "加入同框"],
  ];
  return (
    <SceneShell duration={duration}>
      <TopLine index="07" label="INVITED USER JOURNEY" />
      <div style={{position: "absolute", left: 90, top: 150}}>
        <Headline kicker="被邀请者也拥有完整体验" size={72}>一次分享，<br />带来三重增长</Headline>
        <div style={{display: "flex", gap: 12, marginTop: 38}}><Pill color={C.lime}>新创作</Pill><Pill color={C.cyan}>新用户</Pill><Pill color={C.orange}>新商品浏览</Pill></div>
        <div style={{display: "flex", gap: 12, marginTop: 60}}>
          {steps.map(([n, text], i) => <div key={n} style={{width: 225, padding: "24px 20px", borderRadius: 20, background: i <= active ? `${C.blue}55` : "rgba(255,255,255,.045)", border: `1px solid ${i <= active ? C.cyan : "rgba(255,255,255,.13)"}`, transform: `translateY(${i === active ? -13 : 0}px)`}}><div style={{fontSize: 18, color: i <= active ? C.lime : C.gray, fontWeight: 900}}>{n}</div><div style={{fontSize: 27, fontWeight: 900, marginTop: 12}}>{text}</div></div>)}
        </div>
      </div>
      <div style={{position: "absolute", right: 120, top: 120}}><Phone src="ui/10-friend-invite-entry.png" width={430} rotate={2} /></div>
      <div style={{position: "absolute", left: 110, right: 650, top: 706, height: 4, background: "rgba(255,255,255,.1)"}}><div style={{height: "100%", width: `${(active + 1) * 25}%`, background: `linear-gradient(90deg,${C.blue},${C.cyan})`, boxShadow: `0 0 18px ${C.cyan}`}} /></div>
    </SceneShell>
  );
};

const Plaza: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const cards = [
    {title: "发现同款", color: C.lime},
    {title: "返回详情", color: C.cyan},
    {title: "再次共创", color: C.pink},
  ];
  return (
    <SceneShell duration={duration} tone="lime">
      <TopLine index="08" label="PUBLIC OUTFIT PLAZA" />
      <div style={{position: "absolute", left: 100, top: 125}}><Phone src="ui/09-outfit-plaza.png" width={430} rotate={-2} /></div>
      <div style={{position: "absolute", left: 650, top: 160}}>
        <Headline kicker="从好友关系，扩展到社区发现" width={1100} size={74}>每一张角色海报，<br />都是新的<span style={{color: C.lime}}>商品入口</span></Headline>
        <div style={{display: "flex", gap: 18, marginTop: 45}}>
          {cards.map((card, i) => <div key={card.title} style={{width: 270, height: 190, padding: 24, borderRadius: 24, background: "linear-gradient(150deg,rgba(255,255,255,.1),rgba(255,255,255,.03))", border: `1px solid ${card.color}77`, transform: `translateY(${Math.sin(frame / 34 + i * 1.5) * 10}px)`, boxShadow: `0 28px 80px ${card.color}18`}}><div style={{width: 45, height: 45, borderRadius: 12, background: card.color, color: C.black, display: "grid", placeItems: "center", fontWeight: 950}}>0{i + 1}</div><div style={{fontSize: 31, fontWeight: 900, marginTop: 32}}>{card.title}</div></div>)}
        </div>
        <div style={{marginTop: 42, padding: "22px 26px", borderRadius: 18, background: "rgba(10,13,20,.72)", border: "1px solid rgba(255,255,255,.13)", display: "flex", alignItems: "center", gap: 20, width: 830}}>
          <div style={{width: 56, height: 56, borderRadius: "50%", background: C.blue, display: "grid", placeItems: "center", fontSize: 28}}>🔒</div>
          <div><div style={{fontSize: 26, fontWeight: 900}}>隐私默认保护</div><div style={{fontSize: 21, color: C.gray, marginTop: 5}}>仅主动公开动漫海报与商品清单；原始身份照片不公开</div></div>
        </div>
      </div>
    </SceneShell>
  );
};

const Business: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const closingAt = Math.max(0, duration - 300);
  const closing = frame >= closingAt;
  const nodes = [
    {x: 560, y: 320, title: "每日故事", sub: "负责打开", color: C.lime},
    {x: 1110, y: 320, title: "AIGC", sub: "负责生产", color: C.blue},
    {x: 1110, y: 655, title: "好友角色", sub: "负责传播", color: C.pink},
    {x: 560, y: 655, title: "商品 / 门店", sub: "负责转化", color: C.orange},
  ];
  return (
    <SceneShell duration={duration}>
      <TopLine index="09" label="BUSINESS GROWTH LOOP" />
      <div style={{opacity: closing ? 0.13 : 1, transform: `scale(${closing ? .93 : 1})`, transition: "none"}}>
        <div style={{position: "absolute", left: 80, top: 145, width: 400}}>
          <div style={{fontSize: 68, lineHeight: 1.08, fontWeight: 950}}>不是套一层 AI<br /><span style={{color: C.lime}}>是完整经营闭环</span></div>
          <div style={{fontSize: 25, color: "#b8becb", lineHeight: 1.55, marginTop: 28}}>从一次商品浏览，成长为可打开、可生产、可传播、可回流的内容系统。</div>
          <div style={{marginTop: 35}}><Pill color={C.cyan}>现场可验证 H5</Pill></div>
        </div>
        <svg width="1920" height="1080" style={{position: "absolute", inset: 0}}>
          <path d="M765 320 L1110 320 Q1260 320 1260 470 L1260 655 L820 655 Q700 655 700 535 L700 410" fill="none" stroke={C.cyan} strokeWidth="4" strokeDasharray="14 16" strokeDashoffset={-frame * 2} opacity=".52" />
        </svg>
        {nodes.map((n, i) => <div key={n.title} style={{position: "absolute", left: n.x, top: n.y, width: 290, height: 170, borderRadius: 24, background: "rgba(14,18,28,.9)", border: `1px solid ${n.color}88`, boxShadow: `0 25px 75px ${n.color}22`, padding: "28px 30px", transform: `translateY(${Math.sin(frame / 35 + i) * 7}px)`}}><div style={{fontSize: 20, color: n.color, fontWeight: 950}}>0{i + 1}</div><div style={{fontSize: 34, fontWeight: 950, marginTop: 13}}>{n.title}</div><div style={{fontSize: 22, color: "#bec4d0", marginTop: 6}}>{n.sub}</div></div>)}
      </div>
      {closing && <div style={{position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 100, opacity: spring({frame: frame - closingAt, fps: FPS, config: {damping: 15}})}}>
        <div style={{position: "absolute", top: -160, bottom: -160, width: 280, left: -360, background: `linear-gradient(90deg,transparent,${C.cyan}2e,${C.lime}38,transparent)`, filter: "blur(12px)", transform: `translateX(${(frame * 19) % 2580}px) skewX(-13deg)`, mixBlendMode: "screen"}} />
        <div style={{transform: `translateY(${Math.sin(frame / 18) * 7}px)`}}>
          <div style={{display: "inline-flex", padding: "10px 15px", background: C.lime, color: C.black, fontWeight: 950, fontSize: 21}}>THANK YOU · 现场体验</div>
          <div style={{fontSize: 96, fontWeight: 950, lineHeight: 1, marginTop: 30, textShadow: `0 0 ${26 + Math.sin(frame / 11) * 12}px ${C.cyan}66`}}>AI 喵搭</div>
          <div style={{fontSize: 36, color: C.cyan, fontWeight: 900, marginTop: 17}}>从“看商品”到“和好友一起成为内容”</div>
          <div style={{fontSize: 25, color: "#bdc4d1", marginTop: 30}}>AI喵搭项目组 · OPC 商业挑战赛</div>
          <div style={{fontSize: 20, color: C.gray, marginTop: 12}}>next-gen-avatar.ai-meow-outfit.pages.dev/#/game</div>
        </div>
        <div style={{width: 380, padding: 26, background: "white", border: `12px solid ${C.lime}`, boxShadow: `0 0 ${75 + Math.sin(frame / 10) * 22}px ${C.lime}55`, transform: `translateY(${Math.sin(frame / 15 + 1.5) * 10}px) scale(${1 + Math.sin(frame / 21) * 0.012})`}}>
          <Img src={staticFile("qr/live-h5.png")} style={{width: "100%", aspectRatio: "1", objectFit: "contain"}} />
          <div style={{color: C.black, fontSize: 27, fontWeight: 950, marginTop: 13, textAlign: "center"}}>扫码现场验证完整路径</div>
        </div>
      </div>}
    </SceneShell>
  );
};

const CaptionLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const item = captions.find((caption) => t >= caption.start && t <= caption.end);
  if (!item) return null;
  const progress = interpolate(t, [item.start, item.end], [0, 1], clamp);
  const spoken = item.words.map((word) => word.text).join("");
  const punctuation = item.text.slice(spoken.length);
  const highlightStart = item.highlight ? spoken.indexOf(item.highlight) : -1;
  const highlightEnd = highlightStart + item.highlight.length;
  let tokenStart = 0;
  return (
    <div style={{position: "absolute", left: 200, right: 200, bottom: 58, zIndex: 100, display: "flex", justifyContent: "center", pointerEvents: "none"}}>
      <div style={{position: "relative", maxWidth: 1500, padding: "15px 30px 18px", borderRadius: 18, background: "rgba(5,7,12,.82)", border: "1px solid rgba(255,255,255,.15)", boxShadow: "0 18px 60px rgba(0,0,0,.48)", backdropFilter: "blur(13px)", textAlign: "center", fontFamily: FONT, fontSize: item.text.length > 20 ? 50 : 58, fontWeight: 900, lineHeight: 1.18, letterSpacing: 1}}>
        {item.words.map((word, index) => {
          const start = tokenStart;
          const end = start + word.text.length;
          tokenStart = end;
          const highlighted = highlightStart >= 0 && start < highlightEnd && end > highlightStart;
          const opacity = interpolate(t, [word.start - 0.045, word.start + 0.07], [0, 1], clamp);
          const pop = spring({frame: Math.max(0, (t - word.start) * FPS), fps: FPS, config: {damping: 15, stiffness: 220}});
          return <span key={`${index}-${word.text}`} style={{display: "inline-block", opacity, color: highlighted ? C.lime : C.white, transform: `translateY(${(1 - pop) * 14}px) scale(${highlighted ? 0.9 + pop * 0.18 : 0.88 + pop * 0.12})`, textShadow: highlighted ? `0 0 22px ${C.lime}66` : "0 3px 10px rgba(0,0,0,.7)"}}>{word.text}</span>;
        })}
        <span style={{display: "inline-block", opacity: interpolate(t, [item.words[item.words.length - 1].start, item.words[item.words.length - 1].end], [0, 1], clamp)}}>{punctuation}</span>
        <div style={{position: "absolute", left: 22, right: 22, bottom: 7, height: 3, borderRadius: 4, background: "rgba(255,255,255,.1)", overflow: "hidden"}}><div style={{height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg,${C.blue},${C.lime})`}} /></div>
      </div>
    </div>
  );
};

const Video: React.FC = () => {
  const scenes = [Hook, Daily, Products, Engine, Identity, Variations, Share, Journey, Plaza, Business];
  const starts = [
    0,
    ...scenes.slice(1).map((_, scene) => {
      const firstCaption = captions.find((caption) => caption.scene === scene + 1);
      return Math.max(1, Math.round(((firstCaption?.start ?? 0) - 0.18) * FPS));
    }),
    DURATION,
  ];
  return (
    <AbsoluteFill style={{background: C.black}}>
      {scenes.map((Component, i) => {
        const from = starts[i];
        const duration = starts[i + 1] - from;
        return <Sequence key={i} from={from} durationInFrames={duration}><Component duration={duration} /></Sequence>;
      })}
      <CaptionLayer />
      <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgba(255,255,255,.08)", zIndex: 120}}><div style={{height: "100%", width: `${(useCurrentFrame() / DURATION) * 100}%`, background: `linear-gradient(90deg,${C.blue},${C.cyan},${C.lime})`}} /></div>
    </AbsoluteFill>
  );
};

const Root: React.FC = () => <Composition id="AiMeowPro" component={Video} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />;
registerRoot(Root);
