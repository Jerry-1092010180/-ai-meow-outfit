/**
 * 智能采集分析器 — 基于质心的人体检测 (快速, 始终可用)
 */

export type CaptureLightState = 'waiting' | 'turning' | 'ready' | 'captured';

// 删掉这里... 这个文件内容太多了

// 核心思路重写: 用边框颜色做背景参照, 前景=与边框差异大的像素
// 聚类前景像素 → 取最大连通区域 → 这就是人
// 判断: 人是否充满画面(距离), 头脚是否入画, 是否居中, 是否稳定

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
  detail: string;
}

interface AnalyzeOptions { previousFrame: ImageData | null; targetAngle: number; }

const ANGLE_LABELS: Record<number,string> = {0:'正面',45:'右前',90:'右侧',135:'右后',180:'背面',225:'左后',270:'左侧',315:'左前'};

function clamp(v:number,lo=0,hi=1){return Math.min(Math.max(v,lo),hi)}
function scoreAround(v:number,t:number,tol:number){return clamp(1-Math.abs(v-t)/tol)}

function frameDiff(a:ImageData|null,b:ImageData|null):number{
  if(!a||!b||a.width!==b.width||a.height!==b.height)return 1;
  const ad=a.data,bd=b.data;let d=0,c=0;
  for(let i=0;i<ad.length;i+=4){d+=Math.abs(ad[i]-bd[i])+Math.abs(ad[i+1]-bd[i+1])+Math.abs(ad[i+2]-bd[i+2]);c++}
  return d/(c*3*255);
}

function findBodyBox(frame:ImageData):{box:CaptureBox|null;bodyPct:number}{
  const {width,height,data}=frame;
  // 背景色 = 四边采样中位数
  let bgR=0,bgG=0,bgB=0,bgN=0;
  for(let x=0;x<width;x+=2){let i=x*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  for(let x=0;x<width;x+=2){let i=((height-1)*width+x)*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  for(let y=0;y<height;y+=2){let i=(y*width)*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  for(let y=0;y<height;y+=2){let i=(y*width+width-1)*4;bgR+=data[i];bgG+=data[i+1];bgB+=data[i+2];bgN++;}
  bgR/=bgN;bgG/=bgN;bgB/=bgN;

  // 前景 = 与背景色差 > 40 的像素
  const THRESH=40;const pointsX:number[]=[],pointsY:number[]=[];
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

  if(pointsX.length<30||bodyPct<0.015)return{box:null,bodyPct};

  // Trim 5% extremes → box
  const sx=pointsX.slice().sort((a,b)=>a-b),sy=pointsY.slice().sort((a,b)=>a-b);
  const trim=Math.max(1,Math.floor(pointsX.length*0.04));
  const mx=sx[trim]/width,Mx=sx[sx.length-1-trim]/width;
  const my=sy[trim]/height,My=sy[sy.length-1-trim]/height;
  if(Mx<=mx||My<=my)return{box:null,bodyPct};
  return{box:{x:mx,y:my,width:Mx-mx,height:My-my},bodyPct};
}

function aspectForAngle(a:number):number{
  const n=((a%180)+180)%180;
  if(n<=15||n>=165)return 0.34;
  if(Math.abs(n-90)<=15)return 0.22;
  return 0.28;
}

export function analyzeCaptureFrame(frame:ImageData,opts:AnalyzeOptions):CaptureAnalysis{
  const motion=frameDiff(opts.previousFrame,frame);
  const{box,bodyPct}=findBodyBox(frame);

  if(!box||box.width<0.04||box.height<0.08){
    return{box:null,motionScore:motion,fullBodyScore:0,distanceScore:0,centerScore:0,stabilityScore:0,
      angleScore:0,qualityScore:0,isFullBody:false,isCentered:false,isStable:false,angleMatched:false,
      distance:'unknown',lightState:'waiting',ready:false,
      instruction:'请站到画面中央，确保光线充足',detail:`检测中 ${Math.round(bodyPct*100)}%`};
  }

  const bottom=box.y+box.height,cx=box.x+box.width/2;
  const aspect=box.width/Math.max(box.height,0.001);

  const fullBodyScore=clamp(
    (box.y<0.18?0.4:scoreAround(box.y,0.06,0.2)*0.4)+
    (bottom>0.78?0.4:scoreAround(bottom,0.94,0.18)*0.4)+
    (box.width>0.14?0.2:scoreAround(box.width,0.3,0.25)*0.2));
  const distanceScore=scoreAround(box.height,0.7,0.28);
  const centerScore=scoreAround(cx,0.5,0.32);
  const stabilityScore=motion<0.04?1:motion<0.08?0.6:motion<0.12?0.3:0;
  const angleScore=scoreAround(aspect,aspectForAngle(opts.targetAngle),0.16);

  const dist:CaptureAnalysis['distance']=box.height>0.94||box.width>0.9?'too-close':box.height<0.28?'too-far':'good';
  const isFullBody=bodyPct>0.025||fullBodyScore>=0.35;
  const isCentered=centerScore>=0.25;
  const isStable=bodyPct>0.02||stabilityScore>=0.4;
  const angleMatched=angleScore>=0.12;

  const passes=[isFullBody,isCentered,isStable,angleMatched].filter(Boolean).length;
  const ready=passes>=3&&dist!=='too-close'&&bodyPct>0.02;

  const qualityScore=Math.round(clamp(fullBodyScore*.34+distanceScore*.18+centerScore*.16+stabilityScore*.18+angleScore*.14)*100);

  // Light state
  let light:CaptureLightState='waiting';
  if(motion>0.1&&!ready)light='turning';
  else if(ready)light='ready';

  // Instructions
  let inst=`转到 ${ANGLE_LABELS[opts.targetAngle]??opts.targetAngle+'°'} 后停住`;
  let detail=`人${Math.round(bodyPct*100)}% 动${Math.round(motion*100)}%`;

  if(!isFullBody){inst=box.y>0.2?'📱 手机抬高一点':'👣 向后站一点，脚没入镜';detail=`全身${Math.round(fullBodyScore*100)}%`}
  else if(dist==='too-close')inst='向后站一点，太近了';
  else if(dist==='too-far')inst='向前站一点，太远了';
  else if(!isCentered)inst=cx<0.5?'👈 向画面右侧挪一点':'👉 向画面左侧挪一点';
  else if(!isStable)inst='停住别动...';
  else if(ready)inst='✅ 保持不动，即将拍照';
  if(passes>=2&&!ready){inst=`就差一点... ${inst}`;}

  return{box,motionScore:motion,fullBodyScore,distanceScore,centerScore,stabilityScore,angleScore,qualityScore,
    isFullBody,isCentered,isStable,angleMatched,distance:dist,lightState:light,ready,instruction:inst,detail};
}
