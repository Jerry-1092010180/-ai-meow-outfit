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

const COLORS = {
  ink: "#0b0d12",
  paper: "#f5f3ed",
  lime: "#d8ff48",
  blue: "#3454ff",
  pink: "#ff4f7b",
  muted: "#a5a9b2",
};

const font = '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';

type SceneProps = {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  screenshot?: string;
  screenshotAlt?: string;
  accent?: "lime" | "blue" | "pink";
  reverse?: boolean;
  children?: React.ReactNode;
  badge?: string;
};

const FadeIn: React.FC<{children: React.ReactNode; delay?: number}> = ({children, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = spring({frame: frame - delay, fps, config: {damping: 18, mass: 0.8}});
  return (
    <div style={{opacity: rise, transform: `translateY(${(1 - rise) * 34}px)`}}>
      {children}
    </div>
  );
};

const PhoneShot: React.FC<{src: string; alt?: string; rotate?: number}> = ({src, alt = "H5 实机画面", rotate = 0}) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 34) * 5;
  return (
    <div
      style={{
        width: 414,
        height: 896,
        padding: 12,
        borderRadius: 54,
        background: "#050608",
        border: "2px solid #343840",
        boxShadow: "0 32px 90px rgba(0,0,0,.4)",
        transform: `translateY(${bob}px) rotate(${rotate}deg)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{position: "absolute", top: 17, left: "50%", transform: "translateX(-50%)", width: 112, height: 28, borderRadius: 20, background: "#050608", zIndex: 2}} />
      <Img src={staticFile(src)} alt={alt} style={{width: "100%", height: "100%", objectFit: "cover", borderRadius: 42}} />
    </div>
  );
};

const Pill: React.FC<{children: React.ReactNode; color?: string}> = ({children, color = COLORS.lime}) => (
  <span style={{display: "inline-flex", padding: "10px 16px", border: "2px solid #111", background: color, color: "#101114", fontWeight: 800, fontSize: 24}}>{children}</span>
);

const Fact: React.FC<{value: string; label: string}> = ({value, label}) => (
  <div style={{borderTop: "2px solid currentColor", paddingTop: 14, minWidth: 190}}>
    <div style={{fontSize: 44, fontWeight: 900}}>{value}</div>
    <div style={{fontSize: 23, opacity: 0.72, marginTop: 4}}>{label}</div>
  </div>
);

const Scene: React.FC<SceneProps> = ({eyebrow, title, body, screenshot, screenshotAlt, accent = "lime", reverse = false, children, badge}) => {
  const color = COLORS[accent];
  return (
    <AbsoluteFill style={{fontFamily: font, background: COLORS.paper, color: COLORS.ink, padding: "74px 106px"}}>
      <div style={{position: "absolute", inset: 0, backgroundImage: "radial-gradient(#111 1px, transparent 1px)", backgroundSize: "18px 18px", opacity: 0.05}} />
      <div style={{display: "flex", flexDirection: reverse ? "row-reverse" : "row", gap: 98, alignItems: "center", height: "100%", position: "relative"}}>
        {screenshot ? (
          <FadeIn>
            <PhoneShot src={screenshot} alt={screenshotAlt} rotate={reverse ? 1.2 : -1.2} />
          </FadeIn>
        ) : null}
        <div style={{flex: 1, maxWidth: screenshot ? 1040 : 1500}}>
          <FadeIn delay={5}>
            <div style={{fontSize: 23, letterSpacing: 0, fontWeight: 900, color: COLORS.blue, marginBottom: 22}}>{eyebrow}</div>
          </FadeIn>
          <FadeIn delay={10}>
            <h1 style={{fontSize: screenshot ? 72 : 92, lineHeight: 1.08, letterSpacing: 0, margin: 0, fontWeight: 950}}>{title}</h1>
          </FadeIn>
          <FadeIn delay={16}>
            <p style={{fontSize: 31, lineHeight: 1.55, maxWidth: 980, margin: "30px 0 0", color: "#3d4149"}}>{body}</p>
          </FadeIn>
          {children ? <FadeIn delay={22}><div style={{marginTop: 34}}>{children}</div></FadeIn> : null}
        </div>
      </div>
      {badge ? <div style={{position: "absolute", right: 44, top: 36}}><Pill color={color}>{badge}</Pill></div> : null}
      <div style={{position: "absolute", left: 106, bottom: 34, display: "flex", gap: 18, alignItems: "center", fontSize: 20, fontWeight: 800}}>
        <span style={{width: 26, height: 26, display: "inline-grid", placeItems: "center", background: COLORS.ink, color: COLORS.lime}}>IN</span>
        <span>AI 喵搭 · 银泰会员每日角色副本</span>
      </div>
      <div style={{position: "absolute", right: 106, bottom: 36, fontSize: 18, color: "#555b65"}}>next-gen-avatar.ai-meow-outfit.pages.dev/#/game</div>
    </AbsoluteFill>
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 14}});
  return (
    <AbsoluteFill style={{fontFamily: font, color: "white", background: COLORS.ink, padding: "92px 112px", overflow: "hidden"}}>
      <div style={{position: "absolute", width: 740, height: 740, right: -90, top: -110, background: COLORS.blue, transform: `rotate(${8 + frame / 80}deg)`, opacity: 0.9}} />
      <div style={{position: "absolute", width: 530, height: 530, right: 160, bottom: -210, background: COLORS.pink, transform: "rotate(-14deg)"}} />
      <div style={{position: "relative", zIndex: 2, transform: `scale(${0.92 + pop * 0.08})`, transformOrigin: "left center"}}>
        <Pill>OPC 商业挑战赛 · 可运行 H5</Pill>
        <h1 style={{fontSize: 130, lineHeight: 0.98, letterSpacing: 0, margin: "44px 0 30px", maxWidth: 1180}}>让每天打开喵街<br />变成一次角色更新</h1>
        <p style={{fontSize: 34, lineHeight: 1.5, maxWidth: 1050, color: "#c7cad2"}}>银泰商品图选择 × 用户身份动漫化 × 好友角色共创 × 公开穿搭广场</p>
      </div>
    </AbsoluteFill>
  );
};

const AigcScene: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = ["身份特征", "5 层商品", "场景天气", "动作表情", "社交构图"];
  return (
    <Scene eyebrow="AIGC IS THE CONTENT ENGINE" title={<>AI 不是推荐一句话，<br />而是生产每天的新角色内容</>} body="输入会共同决定画面：用户身份、完整商品穿搭、当天故事、发型、姿势和好友席位。输出是可继续编辑与分享的角色海报。" badge="核心加分项">
      <div style={{display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, maxWidth: 1320}}>
        {steps.map((step, index) => {
          const active = frame > 20 + index * 18;
          return <div key={step} style={{padding: "26px 14px", background: active ? COLORS.blue : "white", color: active ? "white" : COLORS.ink, border: "2px solid #111", textAlign: "center", fontSize: 25, fontWeight: 900}}>{step}</div>;
        })}
      </div>
      <div style={{display: "flex", alignItems: "center", gap: 18, marginTop: 30, fontSize: 28, fontWeight: 900}}>
        <span>结构化输入</span><span>→</span><span style={{color: COLORS.blue}}>AIGC 生成编排</span><span>→</span><span>角色 / 动作 / 多人海报</span>
      </div>
    </Scene>
  );
};

const FinalScene: React.FC = () => (
  <AbsoluteFill style={{fontFamily: font, background: COLORS.ink, color: "white", padding: "88px 116px"}}>
    <div style={{display: "flex", height: "100%", alignItems: "center", gap: 110}}>
      <div style={{flex: 1}}>
        <Pill>评委可现场验证</Pill>
        <h1 style={{fontSize: 92, lineHeight: 1.08, letterSpacing: 0, margin: "36px 0 28px"}}>从“看商品”<br />到“和好友一起成为内容”</h1>
        <p style={{fontSize: 32, lineHeight: 1.55, color: "#c4c8d1", maxWidth: 990}}>每日故事负责打开，AIGC 负责生成，好友角色负责传播，商品详情和门店任务负责回到经营闭环。</p>
        <div style={{display: "flex", gap: 42, marginTop: 52}}>
          <Fact value="7 天" label="连续角色章节" />
          <Fact value="5 层" label="完整商品穿搭" />
          <Fact value="2–4 人" label="好友共创场景" />
        </div>
      </div>
      <div style={{width: 430, background: "white", color: COLORS.ink, padding: 28, border: `12px solid ${COLORS.lime}`}}>
        <Img src={staticFile("qr/live-h5.png")} style={{width: "100%", aspectRatio: "1", objectFit: "contain"}} />
        <div style={{fontWeight: 950, fontSize: 30, marginTop: 18}}>扫码体验 H5</div>
        <div style={{fontSize: 19, color: "#555", marginTop: 8, wordBreak: "break-all"}}>next-gen-avatar.ai-meow-outfit.pages.dev/#/game</div>
      </div>
    </div>
  </AbsoluteFill>
);

const Video: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={210}><Intro /></Sequence>
    <Sequence from={210} durationInFrames={390}>
      <Scene eyebrow="DAILY OPEN HOOK" title={<>每天不是签到，<br />是更新一集“今天的我”</>} body="7 天连续章节叠加天气、商圈和新商品池。用户每天打开都有新的角色故事，但选择过程不限时，不制造催促。" screenshot="ui/01-daily-lobby.png" screenshotAlt="每日角色副本首页" badge="约 60 秒 · 不限时">
        <div style={{display: "flex", gap: 18}}><Pill>每日新剧情</Pill><Pill color={COLORS.pink}>连续收藏卡</Pill><Pill color="white">门店任务</Pill></div>
      </Scene>
    </Sequence>
    <Sequence from={600} durationInFrames={480}>
      <Scene eyebrow="PRODUCT IMAGE FIRST" title={<>先凭商品图选喜欢，<br />详情只在需要时打开</>} body="内搭、外套、下装、鞋履和配饰共同组成完整 Look。卡片点击只负责选择与下沉反馈，“查看详情”才进入演示价格、尺码和门店字段。" screenshot="ui/02-product-selection.png" screenshotAlt="银泰商品选择页" reverse badge="样例商品字段 · 正式接 PIM">
        <div style={{display: "flex", gap: 18}}><Pill>图片占比优先</Pill><Pill color="white">5 层穿搭</Pill><Pill color={COLORS.blue}>商品详情回流</Pill></div>
      </Scene>
    </Sequence>
    <Sequence from={1080} durationInFrames={420}><AigcScene /></Sequence>
    <Sequence from={1500} durationInFrames={480}>
      <Scene eyebrow="IDENTITY-PRESERVING STYLIZATION" title={<>生成的不是模板人，<br />而是“像我”的动漫角色</>} body="用户身份特征与商品实拍共同进入生成任务。角色结果可继续换发型、换动作、换表情和换背景，同一个身份资产不需要反复生成。" screenshot="ui/05-avatar-result.png" screenshotAlt="用户动漫角色结果" badge="效果演示 · Provider 可替换">
        <div style={{display: "flex", gap: 18}}><Pill>脸部身份</Pill><Pill color={COLORS.pink}>商品一致性</Pill><Pill color="white">持续编辑</Pill></div>
      </Scene>
    </Sequence>
    <Sequence from={1980} durationInFrames={420}>
      <Scene eyebrow="CONTENT VARIATIONS" title={<>同一个人，<br />每天都有新的表达</>} body="站姿、自信主角、街头漫游和好友招呼构成动作入口；自然、微笑、酷感、惊喜构成表情入口。每个选择都触发新的内容版本。" screenshot="ui/06-pose-expression.png" screenshotAlt="动作和表情编辑" reverse badge="AIGC 生成变体">
        <div style={{display: "flex", gap: 18}}><Pill>动作</Pill><Pill color={COLORS.blue}>表情</Pill><Pill color={COLORS.pink}>发型</Pill><Pill color="white">背景</Pill></div>
      </Scene>
    </Sequence>
    <Sequence from={2400} durationInFrames={510}>
      <Scene eyebrow="FRIEND CO-CREATION" title={<>分享的不是投票，<br />是一张“等你入镜”的邀请</>} body="好友打开链接后建立自己的身份、独立挑选完整穿搭，再加入同一场景。每个人的角色资产互不覆盖，房间支持 2–4 人。" screenshot="ui/08-friend-joined.png" screenshotAlt="双人共创房间" badge="邀请即内容">
        <div style={{display: "flex", gap: 18}}><Pill>并肩逛街</Pill><Pill color={COLORS.pink}>碰拳击掌</Pill><Pill color="white">一起走秀</Pill><Pill color={COLORS.blue}>合照自拍</Pill></div>
      </Scene>
    </Sequence>
    <Sequence from={2910} durationInFrames={420}>
      <Scene eyebrow="THE INVITED USER ALSO CREATES" title={<>好友不是被动帮忙，<br />也会完成自己的角色旅程</>} body="邀请页明确展示房间、好友角色和 3 套完整 Look。好友生成自己的角色后，才进入双人或多人互动海报。" screenshot="ui/10-friend-invite-entry.png" screenshotAlt="好友独立选装入口" reverse badge="角色资产独立">
        <div style={{display: "flex", gap: 18}}><Pill>上传身份</Pill><Pill color="white">独立选装</Pill><Pill color={COLORS.blue}>加入同框</Pill></div>
      </Scene>
    </Sequence>
    <Sequence from={3330} durationInFrames={420}>
      <Scene eyebrow="PUBLIC OUTFIT PLAZA" title={<>好友之外，<br />还有整个银泰穿搭社区</>} body="用户可自愿公开动漫穿搭海报、昵称和商品清单，原始身份照片默认不公开。其他人可以看同款、回商品详情或继续发起共创。" screenshot="ui/09-outfit-plaza.png" screenshotAlt="银泰穿搭广场" badge="公开需用户主动开启">
        <div style={{display: "flex", gap: 18}}><Pill>发现穿搭</Pill><Pill color={COLORS.pink}>看同款</Pill><Pill color="white">邀请共创</Pill></div>
      </Scene>
    </Sequence>
    <Sequence from={3750} durationInFrames={570}><FinalScene /></Sequence>
  </AbsoluteFill>
);

const Root: React.FC = () => (
  <Composition
    id="AiMeowCompetitionDemo"
    component={Video}
    durationInFrames={4320}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(Root);
