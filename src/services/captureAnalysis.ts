import type { PoseEvidence } from './poseCaptureAnalysis';

/** MediaPipe Pose is authoritative for automatic capture; foreground tracking is the visual fallback. */

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

interface AnalyzeOptions {
  previousFrame: ImageData | null;
  targetAngle: number;
  pose?: PoseEvidence | null;
  poseRequired?: boolean;
}

interface MotionSummary { score:number; maskPct:number; box:CaptureBox|null; }
interface TrackedBody { box:CaptureBox; confidence:number; heightRatio:number; lastSeenAt:number; }

const ANGLE_LABELS: Record<number,string> = {0:'正面',45:'右前',90:'右侧',135:'右后',180:'背面',225:'左后',270:'左侧',315:'左前'};

function clamp(v:number,lo=0,hi=1){return Math.min(Math.max(v,lo),hi)}
function scoreAround(v:number,t:number,tol:number){return clamp(1-Math.abs(v-t)/tol)}

// ── 帧间差分 (motion) ──
function frameDiff(a:ImageData|null,b:ImageData|null):MotionSummary{
  if(!a||!b||a.width!==b.width||a.height!==b.height)return{score:1,maskPct:0,box:null};
  const ad=a.data,bd=b.data;let diff=0,motionPixels=0,px=0;
  let minX=a.width,minY=a.height,maxX=0,maxY=0;
  for(let y=1;y<a.height-1;y+=3){
    for(let x=1;x<a.width-1;x+=3){
      const i=(y*a.width+x)*4;
      const d=Math.abs(ad[i]-bd[i])+Math.abs(ad[i+1]-bd[i+1])+Math.abs(ad[i+2]-bd[i+2]);
      diff+=d;px++;
      if(d>18*3){motionPixels++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    }
  }
  const maskPct=motionPixels/Math.max(px,1);
  let box:CaptureBox|null=null;
  if(motionPixels>=24&&maxX>minX&&maxY>minY){
    const x0=clamp((minX-a.width*0.1)/a.width),x1=clamp((maxX+a.width*0.1)/a.width);
    const y0=clamp((minY-a.height*0.16)/a.height),y1=clamp((maxY+a.height*0.16)/a.height);
    if(x1-x0>=0.08&&y1-y0>=0.2)box={x:x0,y:y0,width:x1-x0,height:y1-y0};
  }
  return{score:diff/(px*3*255),maskPct,box};
}

const centerHistory:Array<{x:number;y:number}>=[];
let trackedBody:TrackedBody|null=null;
function clearCenterHistory(){centerHistory.length=0;trackedBody=null;}

function median(values:number[]):number{
  if(values.length===0)return 0;
  const sorted=values.slice().sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length/2)];
}

function smoothBox(previous:CaptureBox,next:CaptureBox,weight=0.38):CaptureBox{
  return{x:previous.x*(1-weight)+next.x*weight,y:previous.y*(1-weight)+next.y*weight,
    width:previous.width*(1-weight)+next.width*weight,height:previous.height*(1-weight)+next.height*weight};
}

// ── 背景色检测 (foreground) ──
function findBodyByColor(frame:ImageData):{box:CaptureBox|null;bodyPct:number;heightRatio:number;confidence:number;threshold:number}{
  const{width,height,data}=frame;
  const rs:number[]=[],gs:number[]=[],bs:number[]=[];
  const sample=(x:number,y:number)=>{const i=(y*width+x)*4;rs.push(data[i]);gs.push(data[i+1]);bs.push(data[i+2]);};
  const edgeX=Math.max(4,Math.floor(width*0.08)),edgeY=Math.max(4,Math.floor(height*0.08));
  for(let y=0;y<height;y+=4){for(let x=0;x<width;x+=4){
    if(x<edgeX||x>=width-edgeX||y<edgeY||y>=height-edgeY)sample(x,y);
  }}
  const bgR=median(rs),bgG=median(gs),bgB=median(bs);
  const noise=median(rs.map((r,i)=>Math.abs(r-bgR)+Math.abs(gs[i]-bgG)+Math.abs(bs[i]-bgB)));
  // Dynamic summed-RGB threshold: low on clean walls, higher under uneven lighting.
  const threshold=Math.min(84,Math.max(24,noise*2.4+18));
  const pointsX:number[]=[],pointsY:number[]=[];
  for(let y=4;y<height-4;y+=4){
    for(let x=4;x<width-4;x+=4){
      const i=(y*width+x)*4;
      if(Math.abs(data[i]-bgR)+Math.abs(data[i+1]-bgG)+Math.abs(data[i+2]-bgB)>threshold){
        pointsX.push(x);pointsY.push(y);
      }
    }
  }
  const totalSamples=Math.floor(width/4)*Math.floor(height/4);
  const bodyPct=pointsX.length/Math.max(totalSamples,1);

  if(pointsX.length<24||bodyPct<0.006||bodyPct>0.82)return{box:null,bodyPct,heightRatio:0,confidence:0,threshold};

  const sx=pointsX.slice().sort((a,b)=>a-b),sy=pointsY.slice().sort((a,b)=>a-b);
  const trim=Math.min(Math.floor(pointsX.length*0.06),sx.length-1);
  const mx=sx[trim]/width,Mx=sx[sx.length-1-trim]/width;
  const my=sy[trim]/height,My=sy[sy.length-1-trim]/height;
  const box={x:mx,y:my,width:Mx-mx,height:My-my};
  if(box.width<0.08||box.height<0.2)return{box:null,bodyPct,heightRatio:0,confidence:0,threshold};
  const geometry=clamp((box.height-0.2)/0.55)*0.65+clamp((box.width-0.08)/0.35)*0.35;
  const coverage=clamp((bodyPct-0.006)/0.16);
  return{box,bodyPct,heightRatio:box.height,confidence:0.25+geometry*0.45+coverage*0.3,threshold};
}

// ── 三级置信度人体检测 (颜色 + 运动双重通道) ──
function detectBody(frame: ImageData, motion: MotionSummary): { box: CaptureBox | null; confidence: number; heightRatio: number; detailParts: string[] } {
  // 通道 A: 颜色检测
  const fg = findBodyByColor(frame);
  if (fg.box) {
    const box=trackedBody?smoothBox(trackedBody.box,fg.box):fg.box;
    trackedBody={box,confidence:fg.confidence,heightRatio:box.height,lastSeenAt:Date.now()};
    return {
      box,
      confidence: fg.confidence,
      heightRatio: box.height,
      detailParts: [`fg-thr:${Math.round(fg.threshold)}`],
    };
  }

  if (motion.box&&motion.maskPct>=0.008) {
    const box=trackedBody?smoothBox(trackedBody.box,motion.box,0.22):motion.box;
    const confidence=clamp(0.32+motion.maskPct*2.5,0.32,0.72);
    trackedBody={box,confidence,heightRatio:box.height,lastSeenAt:Date.now()};
    return {
      box,
      confidence,
      heightRatio: box.height,
      detailParts: ['motion-track'],
    };
  }

  if(trackedBody&&Date.now()-trackedBody.lastSeenAt<6000){
    const age=(Date.now()-trackedBody.lastSeenAt)/6000;
    return{box:trackedBody.box,confidence:Math.max(0.24,trackedBody.confidence*(1-age*0.45)),
      heightRatio:trackedBody.heightRatio,detailParts:['tracked']};
  }

  return { box: null, confidence: 0, heightRatio: 0, detailParts: [] };
}

function aspectForAngle(a:number):number{
  const n=((a%180)+180)%180;
  if(n<=15||n>=165)return 0.34;
  if(Math.abs(n-90)<=15)return 0.22;
  return 0.28;
}

export function analyzeCaptureFrame(frame:ImageData,opts:AnalyzeOptions):CaptureAnalysis{
  const motion=frameDiff(opts.previousFrame,frame);
  const fallbackBody=detectBody(frame,motion);
  const pose=opts.pose?.detected?opts.pose:null;
  const body=pose?.box?{box:pose.box,confidence:pose.confidence,heightRatio:pose.box.height,detailParts:[pose.detail]}:fallbackBody;

  const confidence=body.confidence;

  const box=body.box;

  if(!box||box.width<0.06||box.height<0.18||confidence<0.2){
    return{
      box:null,motionScore:motion.score,fullBodyScore:0,distanceScore:0,centerScore:0,stabilityScore:0,
      angleScore:0,qualityScore:0,isFullBody:false,isCentered:false,isStable:false,angleMatched:false,
      distance:'unknown',lightState:'waiting',ready:false,
      instruction:'请站到画面中央',
      detail:`rdy:--,mot:${(motion.score*100).toFixed(0)},bod:${(confidence*100).toFixed(0)},ctr:--,ang:--,stb:--`,
    };
  }

  const cx=box.x+box.width/2;
  const aspect=box.width/Math.max(box.height,0.001);

  // Geometry-based scores (no bodyPct)
  const heightRatio=body.heightRatio;
  const topMargin=box.y;
  const bottomMargin=1-(box.y+box.height);

  // fullBodyScore: check head/feet margins
  const topOK=topMargin>0.02&&topMargin<0.2;
  const bottomOK=bottomMargin>0.02&&bottomMargin<0.2;
  const geometryFullBody=heightRatio>0.7?1:clamp((topOK?0.5:scoreAround(topMargin,0.06,0.15))+(bottomOK?0.5:scoreAround(bottomMargin,0.08,0.15)));
  const fullBodyScore=pose?pose.fullBodyScore:geometryFullBody;

  const distanceScore=scoreAround(box.height,0.7,0.28);
  const centerScore=pose?pose.centerScore:scoreAround(cx,0.5,0.32);

  // Body-center variance rejects camera shake; frame motion rejects turning in place.
  centerHistory.push({x:box.x+box.width/2,y:box.y+box.height/2});
  if(centerHistory.length>20)centerHistory.shift();
  let centerStability=0;
  if(centerHistory.length>=5){
    const mx=centerHistory.reduce((s,p)=>s+p.x,0)/centerHistory.length;
    const my=centerHistory.reduce((s,p)=>s+p.y,0)/centerHistory.length;
    const sx=Math.sqrt(centerHistory.reduce((s,p)=>s+(p.x-mx)**2,0)/centerHistory.length);
    const sy=Math.sqrt(centerHistory.reduce((s,p)=>s+(p.y-my)**2,0)/centerHistory.length);
    centerStability=clamp(1-(sx+sy)/2*10);
  }
  const motionStability=clamp(1-motion.score/0.08);
  const stabilityScore=centerHistory.length>=5?0.55*centerStability+0.45*motionStability:0;

  const angleScore=pose?pose.angleScore:scoreAround(aspect,aspectForAngle(opts.targetAngle),0.16);

  const dist:CaptureAnalysis['distance']=box.height>0.95||box.width>0.9?'too-close':box.height<0.28?'too-far':'good';
  const isFullBody=fullBodyScore>=0.45;
  const isCentered=centerScore>=0.5;
  const isStable=stabilityScore>=0.58;
  const angleMatched=pose?pose.angleMatched:angleScore>=0.12;

  const readyScore=0.25*fullBodyScore+0.20*centerScore+0.20*stabilityScore+0.15*distanceScore+0.20*angleScore;
  const poseGate=!opts.poseRequired||(Boolean(pose)&&angleMatched&&fullBodyScore>=0.62);
  const ready=poseGate&&confidence>=0.22&&dist!=='too-close'&&distanceScore>=0.2&&isCentered&&isStable&&(isFullBody||heightRatio>=0.5);

  const qualityScore=Math.round(clamp(readyScore)*100);

  const lightState:CaptureLightState=ready?'ready':motion.score>0.04?'turning':'waiting';

  // Instruction
  let inst=`转到 ${ANGLE_LABELS[opts.targetAngle]??opts.targetAngle+'°'}`;
  if(opts.poseRequired&&!pose)inst='正在识别人形...';
  else if(!isFullBody)inst=topMargin>0.2?'📱 手机抬高':'👣 站远一点';
  else if(dist==='too-close')inst='向后站一点';
  else if(dist==='too-far')inst='向前站一点';
  else if(!isCentered)inst=cx<0.5?'👈 向右移':'👉 向左移';
  else if(pose&&!angleMatched)inst=pose.turnDeltaDeg!==null&&pose.turnDeltaDeg>72?'转回一点':`转到 ${ANGLE_LABELS[opts.targetAngle]??opts.targetAngle+'°'}`;
  else if(!isStable)inst='停住别动...';
  else if(ready)inst='✅ 保持不动';

  const detail=`rdy:${(readyScore*100).toFixed(0)},mot:${(motion.score*100).toFixed(0)},bod:${(confidence*100).toFixed(0)},ctr:${(centerScore*100).toFixed(0)},ang:${(angleScore*100).toFixed(0)},stb:${(stabilityScore*100).toFixed(0)},src:${body.detailParts[0]??'none'}`;

  return{
    box,motionScore:motion.score,fullBodyScore,distanceScore,centerScore,stabilityScore,angleScore,qualityScore,
    isFullBody,isCentered,isStable,angleMatched,distance:dist,lightState,ready,instruction:inst,detail,
  };
}

export{clearCenterHistory};
