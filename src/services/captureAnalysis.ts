/**
 * 智能采集分析器 v3 — 渐进式重构
 *
 * 修改内容:
 * 1. findBodyBox: 三级置信度 (0.2 motion + 0.5 foreground + 0.3 geometry)
 * 2. Foreground 阈值从 40→22
 * 3. bodyPct 删除, 改用 bbox geometry (heightRatio > 0.7 = 全身)
 * 4. stabilityScore 改为多帧 center 标准差 (σ < 4px)
 * 5. ready 改为连续加权评分 (readyScore > 0.72)
 * 6. detail 改为结构化 key:value 字符串
 */

export type CaptureLightState = 'waiting' | 'turning' | 'ready' | 'captured';

export interface CaptureBox { x: number; y: number; width: number; height: number; }

export interface CaptureAnalysis {
  box: CaptureBox | null;
  motionScore: number;
  fullBodyScore: number;
  distanceScore: number;
  centerScore: number;
  stabilityScore: number;
  angleScore: number;
  qualityScore: number;
  isFullBody: boolean;
  isCentered: boolean;
  isStable: boolean;
  angleMatched: boolean;
  distance: 'too-close' | 'too-far' | 'good' | 'unknown';
  lightState: CaptureLightState;
  ready: boolean;
  instruction: string;
  /** 结构化调试数据, 格式: ready:0.68,motion:0.13,body:0.74,center:0.82,angle:0.91,stable:0.80 */
  detail: string;
}

interface AnalyzeOptions { previousFrame: ImageData | null; targetAngle: number; }

const ANGLE_LABELS: Record<number,string> = {0:'正面',45:'右前',90:'右侧',135:'右后',180:'背面',225:'左后',270:'左侧',315:'左前'};

function clamp(v:number,lo=0,hi=1){return Math.min(Math.max(v,lo),hi)}
function scoreAround(v:number,t:number,tol:number){return clamp(1-Math.abs(v-t)/tol)}

// ── 帧间差分 (motion) ──
function frameDiff(a:ImageData|null,b:ImageData|null):{score:number;maskPct:number}{
  if(!a||!b||a.width!==b.width||a.height!==b.height)return{score:1,maskPct:0};
  const ad=a.data,bd=b.data;let diff=0,motionPixels=0,px=0;
  for(let y=1;y<a.height-1;y+=3){
    for(let x=1;x<a.width-1;x+=3){
      const i=(y*a.width+x)*4;
      const d=Math.abs(ad[i]-bd[i])+Math.abs(ad[i+1]-bd[i+1])+Math.abs(ad[i+2]-bd[i+2]);
      diff+=d;px++;
      if(d>18*3)motionPixels++;
    }
  }
  return{score:diff/(px*3*255),maskPct:motionPixels/Math.max(px,1)};
}

// ── 帧间运动检测 (不依赖颜色) ──
let prevMotionFrame: ImageData | null = null;
function findBodyByMotion(frame: ImageData, currMotion: { score: number; maskPct: number }): { box: CaptureBox | null; confidence: number } {
  // 只在 motion 足够大时才做
  if (currMotion.maskPct < 0.01 || !prevMotionFrame) {
    prevMotionFrame = frame;
    return { box: null, confidence: 0 };
  }

  const { width, height, data } = frame;
  const pd = prevMotionFrame.data;
  // 二值化运动掩码
  const motionPixels: Array<{ x: number; y: number }> = [];
  for (let y = 2; y < height - 2; y += 3) {
    for (let x = 2; x < width - 2; x += 3) {
      const i = (y * width + x) * 4;
      if (Math.abs(data[i] - pd[i]) + Math.abs(data[i + 1] - pd[i + 1]) + Math.abs(data[i + 2] - pd[i + 2]) > 18 * 3) {
        motionPixels.push({ x, y });
      }
    }
  }

  prevMotionFrame = frame;

  if (motionPixels.length < 30) return { box: null, confidence: 0 };

  // 膨胀模拟：扩大运动区域以包含静止的人体
  const sx = motionPixels.map(p => p.x).sort((a, b) => a - b);
  const sy = motionPixels.map(p => p.y).sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(motionPixels.length * 0.05));
  const mx = Math.max(0, (sx[trim] - 30)) / width;
  const Mx = Math.min(1, (sx[sx.length - 1 - trim] + 30)) / width;
  const my = Math.max(0, (sy[trim] - 40)) / height;
  const My = Math.min(1, (sy[sy.length - 1 - trim] + 40)) / height;

  if (Mx <= mx || My <= my || (Mx - mx) < 0.04 || (My - my) < 0.06) return { box: null, confidence: 0 };

  // motion confidence: how much of the frame is moving
  const motionConfidence = Math.min(1, motionPixels.length / ((width * height) / 1000));
  return {
    box: { x: mx, y: my, width: Mx - mx, height: My - my },
    confidence: clamp(motionConfidence),
  };
}
const centerHistory:Array<{x:number;y:number}>=[];
function clearCenterHistory(){centerHistory.length=0;prevMotionFrame=null;}

// ── 背景色检测 (foreground) ──
function findBodyByColor(frame:ImageData):{box:CaptureBox|null;bodyPct:number;heightRatio:number}{
  const{width,height,data}=frame;
  // 背景色采样
  let bgR=0,bgG=0,bgB=0,bgN=0;
  for(let x=0;x<width;x+=3){let i=x*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  for(let x=0;x<width;x+=3){let i=((height-1)*width+x)*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  for(let y=0;y<height;y+=3){let i=(y*width)*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  for(let y=0;y<height;y+=3){let i=(y*width+width-1)*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  bgR/=bgN;bgG/=bgN;bgB/=bgN;

  // THRESH 从 40 降至 22
  const THRESH=22;
  const pointsX:number[]=[],pointsY:number[]=[];
  for(let y=6;y<height-6;y+=6){
    for(let x=6;x<width-6;x+=6){
      const i=(y*width+x)*4;
      if(Math.abs(data[i]-bgR)+Math.abs(data[i+1]-bgG)+Math.abs(data[i+2]-bgB)>THRESH*3){
        pointsX.push(x);pointsY.push(y);
      }
    }
  }
  const totalSamples=Math.floor(width/6)*Math.floor(height/6);
  const bodyPct=pointsX.length/Math.max(totalSamples,1);

  if(pointsX.length<20||bodyPct<0.008){return{box:null,bodyPct,heightRatio:0};}

  const sx=pointsX.slice().sort((a,b)=>a-b),sy=pointsY.slice().sort((a,b)=>a-b);
  const trim=Math.min(Math.floor(pointsX.length*0.04),sx.length-1);
  const mx=sx[trim]/width,Mx=sx[sx.length-1-trim]/width;
  const my=sy[trim]/height,My=sy[sy.length-1-trim]/height;
  if(Mx<=mx||My<=my)return{box:null,bodyPct,heightRatio:0};
  return{box:{x:mx,y:my,width:Mx-mx,height:My-my},bodyPct:bodyPct*0.6+(My-my)*0.4,heightRatio:My-my};
}

// ── 三级置信度人体检测 (颜色 + 运动双重通道) ──
function detectBody(frame: ImageData, motion: { score: number; maskPct: number }): { box: CaptureBox | null; confidence: number; heightRatio: number; detailParts: string[] } {
  // 通道 A: 颜色检测
  const fg = findBodyByColor(frame);
  const detail: string[] = [];

  if (fg.box) {
    const geoScore = fg.heightRatio > 0.7 ? 1 : Math.min(1, fg.heightRatio * 1.4);
    const fgScore = fg.box.width > 0.12 && fg.box.height > 0.2 ? clamp(fg.bodyPct * 2.5) : 0;
    return {
      box: fg.box,
      confidence: 0.5 * fgScore + 0.3 * geoScore,
      heightRatio: fg.heightRatio,
      detailParts: detail,
    };
  }

  // 通道 B: 运动检测 (颜色失败时回退)
  const motionBody = findBodyByMotion(frame, motion);
  if (motionBody.box) {
    const hRatio = motionBody.box.height;
    return {
      box: motionBody.box,
      confidence: motionBody.confidence * 0.6 + 0.2, // motion 偏保守
      heightRatio: hRatio,
      detailParts: ['motion-fallback'],
    };
  }

  return { box: null, confidence: 0, heightRatio: 0, detailParts: detail };
}

function aspectForAngle(a:number):number{
  const n=((a%180)+180)%180;
  if(n<=15||n>=165)return 0.34;
  if(Math.abs(n-90)<=15)return 0.22;
  return 0.28;
}

export function analyzeCaptureFrame(frame:ImageData,opts:AnalyzeOptions):CaptureAnalysis{
  const motion=frameDiff(opts.previousFrame,frame);
  const body=detectBody(frame,motion); // 传入 motion 给运动通道

  // Final confidence: add motion
  const confidence=motion.maskPct>0.02?Math.max(body.confidence,motion.maskPct):body.confidence;
  body.confidence=confidence;

  const box=body.box;

  if(!box||box.width<0.04||box.height<0.06||confidence<0.35){
    return{
      box:null,motionScore:motion.score,fullBodyScore:0,distanceScore:0,centerScore:0,stabilityScore:0,
      angleScore:0,qualityScore:0,isFullBody:false,isCentered:false,isStable:false,angleMatched:false,
      distance:'unknown',lightState:'waiting',ready:false,
      instruction:'请站到画面中央',
      detail:`rdy:--,mot:${(motion.score*100).toFixed(0)},bod:${(confidence*100).toFixed(0)},ctr:--,ang:--,stb:--`,
    };
  }

  const bottom=box.y+box.height,cx=box.x+box.width/2;
  const aspect=box.width/Math.max(box.height,0.001);

  // Geometry-based scores (no bodyPct)
  const heightRatio=body.heightRatio;
  const topMargin=box.y;
  const bottomMargin=1-(box.y+box.height);

  // fullBodyScore: check head/feet margins
  const topOK=topMargin>0.02&&topMargin<0.2;
  const bottomOK=bottomMargin>0.02&&bottomMargin<0.2;
  const fullBodyScore=heightRatio>0.7?1:clamp((topOK?0.5:scoreAround(topMargin,0.06,0.15))+(bottomOK?0.5:scoreAround(bottomMargin,0.08,0.15)));

  const distanceScore=scoreAround(box.height,0.7,0.28);
  const centerScore=scoreAround(cx,0.5,0.32);

  // stabilityScore: body center σ over recent frames
  centerHistory.push({x:box.x+box.width/2,y:box.y+box.height/2});
  if(centerHistory.length>20)centerHistory.shift();
  let stabilityScore=0;
  if(centerHistory.length>=5){
    const mx=centerHistory.reduce((s,p)=>s+p.x,0)/centerHistory.length;
    const my=centerHistory.reduce((s,p)=>s+p.y,0)/centerHistory.length;
    const sx=Math.sqrt(centerHistory.reduce((s,p)=>s+(p.x-mx)**2,0)/centerHistory.length);
    const sy=Math.sqrt(centerHistory.reduce((s,p)=>s+(p.y-my)**2,0)/centerHistory.length);
    stabilityScore=clamp(1-(sx+sy)/2*8);
  }

  const angleScore=scoreAround(aspect,aspectForAngle(opts.targetAngle),0.16);

  const dist:CaptureAnalysis['distance']=box.height>0.95||box.width>0.9?'too-close':box.height<0.28?'too-far':'good';
  const isFullBody=fullBodyScore>=0.5;
  const isCentered=centerScore>=0.35;
  const isStable=stabilityScore>=0.5;
  const angleMatched=angleScore>=0.12;

  // Weighted ready score
  const readyScore=0.25*fullBodyScore+0.20*centerScore+0.20*stabilityScore+0.15*distanceScore+0.20*angleScore;
  const ready=readyScore>0.72&&dist!=='too-close';

  const qualityScore=Math.round(clamp(readyScore)*100);

  const lightState:CaptureLightState=ready?'ready':motion.score>0.1?'turning':'waiting';

  // Instruction
  let inst=`转到 ${ANGLE_LABELS[opts.targetAngle]??opts.targetAngle+'°'}`;
  if(!isFullBody)inst=topMargin>0.2?'📱 手机抬高':'👣 站远一点';
  else if(dist==='too-close')inst='向后站一点';
  else if(dist==='too-far')inst='向前站一点';
  else if(!isCentered)inst=cx<0.5?'👈 向右移':'👉 向左移';
  else if(!isStable)inst='停住别动...';
  else if(ready)inst='✅ 保持不动';

  const detail=`rdy:${(readyScore*100).toFixed(0)},mot:${(motion.score*100).toFixed(0)},bod:${(confidence*100).toFixed(0)},ctr:${(centerScore*100).toFixed(0)},ang:${(angleScore*100).toFixed(0)},stb:${(stabilityScore*100).toFixed(0)}`;

  return{
    box,motionScore:motion.score,fullBodyScore,distanceScore,centerScore,stabilityScore,angleScore,qualityScore,
    isFullBody,isCentered,isStable,angleMatched,distance:dist,lightState,ready,instruction:inst,detail,
  };
}

export{clearCenterHistory};
