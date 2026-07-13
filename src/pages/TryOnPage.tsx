import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/common/BottomNav';
import GLBModelViewer from '@/components/outfit/GLBModelViewer';
import { createBodyModelManifest, downloadBodyModelManifest, estimateBodyModelQuality } from '@/services/bodyModelService';
import { submitReconstruction, getPresetModelPath, getReconstructionModelUrl } from '@/services/avatarApi';
import { analyzeCaptureFrame, type CaptureAnalysis } from '@/services/captureAnalysis';
import type { BodyMeasurements, BodyModelManifest, CaptureAngle, CaptureFrame } from '@/types/bodyModel';
import type { BodyType } from '@/types';

type TryOnStep = 'measure' | 'capture' | 'review' | 'reconstructing' | 'result';
type BorderState = 'waiting' | 'turning' | 'ready' | 'captured';
type NumericKey = Exclude<keyof BodyMeasurements, 'bodyType'>;

const CAPTURE_ANGLES: CaptureAngle[] = [0, 45, 90, 135, 180, 225, 270, 315];
const ANGLE_LABELS: Record<number, string> = { 0: '正面', 45: '右前', 90: '右侧', 135: '右后', 180: '背面', 225: '左后', 270: '左侧', 315: '左前' };
const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'hourglass', label: '沙漏型' }, { value: 'pear', label: '梨型' }, { value: 'apple', label: '苹果型' },
  { value: 'rectangle', label: '矩形' }, { value: 'inverted_triangle', label: '倒三角' },
];
const DEFAULT_MEASUREMENTS: BodyMeasurements = { heightCm: 165, weightKg: 55, bodyType: 'hourglass' };

function speak(text: string) {
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.9; speechSynthesis.speak(u); } catch {}
}

export default function TryOnPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const detectIntervalRef = useRef<number>(0);
  const borderRef = useRef<BorderState>('waiting');
  const angleIdxRef = useRef(0);
  const countdownRef = useRef(-1);
  const readyTicksRef = useRef(0);
  const captureAnalysisRef = useRef<CaptureAnalysis | null>(null);

  const [step, setStep] = useState<TryOnStep>('measure');
  const [measurements, setMeasurements] = useState<BodyMeasurements>(DEFAULT_MEASUREMENTS);
  const [frames, setFrames] = useState<CaptureFrame[]>([]);
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);
  const [countdown, setCountdown] = useState(-1);
  const [borderState, _setBorderState] = useState<BorderState>('waiting');
  const setBorderState = (v: BorderState) => { borderRef.current = v; _setBorderState(v); };
  const [cameraReady, setCameraReady] = useState(false);
  const [captureAnalysis, setCaptureAnalysis] = useState<CaptureAnalysis | null>(null);
  const [manifest, setManifest] = useState<BodyModelManifest | null>(null);
  const [reconstructResult, setReconstructResult] = useState<any>(null);
  const [apiAvailable, setApiAvailable] = useState(false);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);

  const stopCamera = useCallback(() => {
    clearInterval(detectIntervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleMeasureChange = (key: NumericKey, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) setMeasurements((p) => ({ ...p, [key]: n }));
    else if (val === '') setMeasurements((p) => ({ ...p, [key]: undefined as any }));
  };

  const getFrameData = useCallback((): ImageData | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 320, 240);
    return ctx.getImageData(0, 0, 320, 240);
  }, []);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // ── 启动摄像头 ──
  // Step 1: Transition to capture page first (so containerRef mounts)
  const startCaptureFlow = useCallback(() => {
    setCameraReady(false);
	    setCurrentAngleIdx(0); angleIdxRef.current = 0;
	    setFrames([]); setCountdown(-1);
	    setBorderState('waiting'); borderRef.current = 'waiting';
	    prevFrameRef.current = null;
	    readyTicksRef.current = 0;
	    captureAnalysisRef.current = null;
	    setCaptureAnalysis(null);
	    setStep('capture');
	  }, []);

  // Step 2: Once capture page is rendered, init camera
  useEffect(() => {
    if (step !== 'capture' || cameraReady) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = document.createElement('video');
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.muted = true;
        video.srcObject = stream;
        video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);z-index:0;';
        videoRef.current = video;

        // Wait for container to exist (it should now, since step='capture' rendered)
        await new Promise<void>(resolve => {
          const check = () => {
            if (containerRef.current) { containerRef.current.innerHTML = ''; containerRef.current.appendChild(video); resolve(); }
            else setTimeout(check, 50);
          };
          check();
        });

        try { await video.play(); } catch {}

        if (!cancelled) {
          setCameraReady(true);
          speak('请退后两步，每次顺时针旋转45度');
	          detectIntervalRef.current = window.setInterval(() => {
	            const current = getFrameData();
	            if (!current) return;
	            const analysis = analyzeCaptureFrame(current, {
	              previousFrame: prevFrameRef.current,
	              targetAngle: CAPTURE_ANGLES[angleIdxRef.current],
	            });
	            prevFrameRef.current = current;
	            captureAnalysisRef.current = analysis;
	            setCaptureAnalysis(analysis);
	            if (borderRef.current === 'captured') return;

	            if (countdownRef.current > 0 && analysis.motionScore > 0.12) {
	              setCountdown(-1);
	              setBorderState(analysis.lightState === 'turning' ? 'turning' : 'waiting');
	              readyTicksRef.current = 0;
	              return;
	            }

	            if (analysis.ready) {
	              readyTicksRef.current += 1;
	              setBorderState('ready'); borderRef.current = 'ready';
	              if (countdownRef.current < 0 && readyTicksRef.current >= 1) setCountdown(2);
	            } else {
	              readyTicksRef.current = 0;
	              setBorderState(analysis.lightState === 'turning' ? 'turning' : 'waiting');
	            }
	          }, 400);
	        }
      } catch (err: any) {
        if (!cancelled) alert(`摄像头启动失败: ${err.message || '未知错误'}`);
      }
    })();
    return () => { cancelled = true; };
	  }, [step, cameraReady, getFrameData]);

  // ── 倒计时 → 拍照 ──
  useEffect(() => {
    if (step !== 'capture' || countdown < 0) return;
    if (countdown === 0) {
      const dataUrl = capturePhoto();
      if (!dataUrl) return;
      const angle = CAPTURE_ANGLES[currentAngleIdx];
	      setFrames((p) => [...p, { angle, imageDataUrl: dataUrl, capturedAt: new Date().toISOString(), qualityScore: captureAnalysisRef.current?.qualityScore ?? 70 }]);
	      setBorderState('captured');
	      readyTicksRef.current = 0;

      const next = currentAngleIdx + 1;
      if (next < CAPTURE_ANGLES.length) {
        setTimeout(() => {
	          angleIdxRef.current = next; setCurrentAngleIdx(next);
	          setBorderState('waiting');
	          prevFrameRef.current = null;
	          captureAnalysisRef.current = null;
	          setCaptureAnalysis(null);
	          setCountdown(-1);
	          speak(`请继续顺时针旋转45度`);
        }, 1500);
      } else {
        setTimeout(() => {
          clearInterval(detectIntervalRef.current);
          speak('采集完成');
          setCountdown(-1);
          setStep('review');
        }, 1500);
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown, currentAngleIdx, capturePhoto]);

  // ── 提交 AIGC ──
  const submitModeling = async () => {
    const m = createBodyModelManifest({
      measurements, captureFrames: frames,
      captureMode: 'guided-360-phone-stand' as const,
      deviceHint: navigator.userAgent.slice(0, 80), createdAt: new Date().toISOString(),
    });
    setManifest(m);
    setStep('reconstructing');
    try { const r = await submitReconstruction(measurements, frames); setReconstructResult(r); setApiAvailable(true); } catch { setApiAvailable(false); }
    setStep('result');
  };

  const qualityScore = useMemo(() => (frames.length > 0 ? estimateBodyModelQuality(measurements, frames) : 0), [measurements, frames]);
  const currentAngle = CAPTURE_ANGLES[currentAngleIdx];
  const progressPct = frames.length / CAPTURE_ANGLES.length;
  const analysisMetrics = captureAnalysis ? [
    ['全身', captureAnalysis.fullBodyScore],
    ['距离', captureAnalysis.distanceScore],
    ['居中', captureAnalysis.centerScore],
    ['角度', captureAnalysis.angleScore],
    ['稳定', captureAnalysis.stabilityScore],
  ] as const : [];

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom bg-gray-950">
      <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-gray-400 text-sm" onClick={() => { stopCamera(); navigate(-1); }}>← 返回</button>
          <h1 className="text-lg font-bold text-white">
            {step === 'measure' && '身体数据'}
            {step === 'capture' && `采集 ${frames.length}/${CAPTURE_ANGLES.length}`}
            {step === 'review' && '预览确认'}
            {step === 'reconstructing' && 'AIGC 生成中...'}
            {step === 'result' && '建模结果'}
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">

          {/* ═══ 身体数据 ═══ */}
          {step === 'measure' && (
            <motion.div key="measure" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-6">
                <span className="text-5xl mb-4 block">📋</span>
                <h2 className="text-xl font-bold text-white mb-2">身体数据</h2>
                <p className="text-gray-400 text-sm">填写数据，AI 为你生成专属 3D 数字分身</p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="身高 (cm)" value={measurements.heightCm} onChange={(v) => handleMeasureChange('heightCm', v)} />
                  <Field label="体重 (kg)" value={measurements.weightKg} onChange={(v) => handleMeasureChange('weightKg', v)} />
                  <Field label="肩宽 (cm)" value={measurements.shoulderCm} onChange={(v) => handleMeasureChange('shoulderCm', v)} optional />
                  <Field label="胸围 (cm)" value={measurements.bustCm} onChange={(v) => handleMeasureChange('bustCm', v)} optional />
                  <Field label="腰围 (cm)" value={measurements.waistCm} onChange={(v) => handleMeasureChange('waistCm', v)} optional />
                  <Field label="臀围 (cm)" value={measurements.hipCm} onChange={(v) => handleMeasureChange('hipCm', v)} optional />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">身型</label>
                  <div className="flex gap-2 flex-wrap">
                    {BODY_TYPES.map((bt) => (
                      <button key={bt.value}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${measurements.bodyType === bt.value ? 'bg-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}
                        onClick={() => setMeasurements((p) => ({ ...p, bodyType: bt.value }))}>{bt.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <motion.button className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg"
                whileTap={{ scale: 0.96 }} onClick={startCaptureFlow}>📷 开始 360° 采集</motion.button>
            </motion.div>
          )}

          {/* ═══ 采集 ═══ */}
          {step === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-400">采集进度</span>
                  <span className="text-pink-400 font-bold">{frames.length}/{CAPTURE_ANGLES.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progressPct * 100}%` }} />
                </div>
              </div>

              <div className="relative w-full rounded-2xl overflow-hidden bg-gray-900 mb-3"
                style={{ aspectRatio: '3/4', boxShadow: borderState === 'ready' ? '0 0 40px 8px rgba(74,222,128,0.6), inset 0 0 30px rgba(74,222,128,0.2)' :
                         borderState === 'captured' ? '0 0 60px 12px rgba(255,255,255,0.8)' :
                         borderState === 'turning' ? '0 0 30px 6px rgba(248,113,113,0.5)' : 'none' }}>
                {/* Camera container — video inserted imperatively */}
                <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, background: '#111' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Top gradient overlay for readability */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80,
                              background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)', zIndex: 5 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
                              background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', zIndex: 5 }} />

                {/* Angle indicator ring */}
                <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.6)',
                                backdropFilter: 'blur(8px)', borderRadius: 24, padding: '6px 16px' }}>
                    <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: `rotate(${currentAngle}deg)` }}>
                      <circle cx="14" cy="14" r="12" fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
                      <circle cx="14" cy="14" r="12" fill="none" stroke="#4ade80" strokeWidth="2.5"
                        strokeDasharray={`${(currentAngle/360)*75.4} 75.4`} strokeLinecap="round" />
                      <line x1="14" y1="2" x2="14" y2="8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <span style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>{ANGLE_LABELS[currentAngle]}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{currentAngle}°</span>
                  </div>
                </div>

                {/* Progress dots */}
	                <div style={{ position: 'absolute', top: 16, right: 12, zIndex: 10, display: 'flex', gap: 3 }}>
	                  {CAPTURE_ANGLES.map((a, i) => (
                    <div key={a} style={{ width: 6, height: 6, borderRadius: '50%',
                      background: i < currentAngleIdx ? '#4ade80' : a === currentAngle ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                      boxShadow: a === currentAngle ? '0 0 6px #fbbf24' : 'none' }} />
	                  ))}
	                </div>

	                {/* Smart person box */}
	                {captureAnalysis?.box && (
	                  <div style={{
	                    position: 'absolute',
	                    left: `${captureAnalysis.box.x * 100}%`,
	                    top: `${captureAnalysis.box.y * 100}%`,
	                    width: `${captureAnalysis.box.width * 100}%`,
	                    height: `${captureAnalysis.box.height * 100}%`,
	                    border: `2px solid ${captureAnalysis.ready ? '#4ade80' : '#fbbf24'}`,
	                    boxShadow: captureAnalysis.ready ? '0 0 16px rgba(74,222,128,0.65)' : '0 0 12px rgba(251,191,36,0.45)',
	                    borderRadius: 12,
	                    zIndex: 7,
	                    pointerEvents: 'none',
	                    transition: 'all 0.25s ease',
	                  }} />
	                )}

                {/* Center guide */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 8,
                              width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,0,0,0.35)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <motion.div style={{ fontSize: 32 }}
                    animate={borderState === 'turning' ? { rotate: 360 } : { scale: [1, 1.15, 1] }}
                    transition={borderState === 'turning' ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0.8, repeat: Infinity }}>
                    {borderState === 'ready' ? '🎯' : borderState === 'captured' ? '✅' : '↻'}
                  </motion.div>
                </div>

                {/* Bottom instruction bar */}
                <div style={{ position: 'absolute', bottom: 16, left: 12, right: 12, zIndex: 10 }}>
                  {/* Marquee bar — pulses green or red */}
                  <div style={{
                    height: 4, borderRadius: 2, marginBottom: 8,
                    background: borderState === 'ready' ? '#4ade80' : borderState === 'turning' ? '#f87171' : 'rgba(255,255,255,0.15)',
                    boxShadow: borderState === 'ready' ? '0 0 12px #4ade80, 0 0 24px #4ade80' :
                               borderState === 'turning' ? '0 0 12px #f87171' : 'none',
                    transition: 'all 0.3s',
                    animation: (borderState === 'ready' || borderState === 'turning') ? 'pulse-bar 0.6s ease-in-out infinite' : 'none',
                  }} />
                  <div style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', borderRadius: 16,
                                padding: '10px 14px', textAlign: 'center' }}>
	                    <p style={{ color: 'white', fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.5 }}>
	                      {borderState === 'waiting' && <>👆 {captureAnalysis?.instruction ?? '请退后两步'} · <span style={{ color: '#fbbf24' }}>{captureAnalysis?.detail ?? '每次顺时针旋转45度'}</span></>}
	                      {borderState === 'turning' && <>🔄 {captureAnalysis?.instruction ?? '检测到转身'} · <span style={{ color: '#4ade80' }}>{captureAnalysis?.detail ?? `转到 ${ANGLE_LABELS[currentAngle]} 后停下`}</span></>}
	                      {borderState === 'ready' && <>🎯 {captureAnalysis?.instruction ?? '角度到位'} · <span style={{ color: '#4ade80' }}>{captureAnalysis?.detail ?? '保持不动'}</span></>}
	                      {borderState === 'captured' && <>📸 第 {frames.length}/{CAPTURE_ANGLES.length} 张已拍 · 继续<span style={{ color: '#fbbf24' }}>顺时针旋转45度</span></>}
	                    </p>
	                  </div>
	                </div>

                {countdown > 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.25)', zIndex: 20 }}>
                    <motion.span key={countdown} style={{ fontSize: 96, fontWeight: 900, color: 'white',
                      textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                      initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{countdown}</motion.span>
                  </div>
                )}
              </div>

	              <style>{`@keyframes pulse-bar { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>

	              {/* 智能判定面板 */}
	              <div className="grid grid-cols-5 gap-1.5 mb-3">
	                {analysisMetrics.map(([label, value]) => {
	                  const pct = Math.round(value * 100);
	                  const active = pct >= 70;
	                  return (
	                    <div key={label} className={`rounded-lg px-1.5 py-2 text-center border ${active ? 'bg-green-500/10 border-green-400/30' : 'bg-white/5 border-white/10'}`}>
	                      <div className={`text-[10px] ${active ? 'text-green-300' : 'text-gray-500'}`}>{label}</div>
	                      <div className={`text-sm font-bold ${active ? 'text-green-200' : 'text-gray-300'}`}>{pct}</div>
	                    </div>
	                  );
	                })}
	              </div>

	              {/* 缩略图 */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
                {frames.map((f, i) => (
                  <div key={i} className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden border border-white/10">
                    <img src={f.imageDataUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {Array.from({ length: CAPTURE_ANGLES.length - frames.length }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-10 h-14 rounded-lg bg-white/5 border border-white/5" />
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ 预览 ═══ */}
          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-1">采集完成 ✨</h2>
                <p className="text-gray-400 text-sm">{frames.length}/{CAPTURE_ANGLES.length} 角度 · 质量 {qualityScore}</p>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-6">
                {CAPTURE_ANGLES.map((a) => {
                  const f = frames.find((x) => x.angle === a);
                  return <div key={a} className="aspect-[3/4] rounded-lg overflow-hidden bg-white/5 border border-white/10">
                    {f ? <img src={f.imageDataUrl} alt="" className="w-full h-full object-cover" /> :
                      <div className="flex items-center justify-center h-full text-white/20 text-xs">—</div>}
                  </div>;
                })}
              </div>
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm" onClick={() => { stopCamera(); startCaptureFlow(); }}>重新采集</button>
                <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold" onClick={submitModeling}>提交 AIGC 建模</button>
              </div>
            </motion.div>
          )}

          {/* ═══ 生成中 ═══ */}
          {step === 'reconstructing' && (
            <motion.div key="reconstructing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
              <motion.div className="text-7xl mb-6" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>🧬</motion.div>
              <h2 className="text-xl font-bold text-white mb-3">AIGC 生成 3D 建模中...</h2>
              {['分析身体数据...', '匹配参数化模型...', '生成 GLB 网格...'].map((t, i) => (
                <motion.p key={t} className="text-sm text-gray-400" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.5 }}>{t}</motion.p>
              ))}
            </motion.div>
          )}

          {/* ═══ 结果 ═══ */}
          {step === 'result' && manifest && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-1">{apiAvailable ? '✅ 4090D 建模完成' : '📦 预置模型'}</h2>
                <p className="text-gray-400 text-sm">身型: {measurements.bodyType} · 身高: {measurements.heightCm}cm · 体重: {measurements.weightKg}kg</p>
              </div>
              <div className="mb-6">
	                {apiAvailable && reconstructResult ? (
	                  <GLBModelViewer modelPath={getReconstructionModelUrl(reconstructResult)} />
	                ) : (
                  <>
                    <p className="text-xs text-gray-500 text-center mb-2">← 预置 {measurements.bodyType} GLB 模型 →</p>
                    <GLBModelViewer modelPath={getPresetModelPath(measurements.bodyType)} />
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm" onClick={() => downloadBodyModelManifest(manifest)}>📥 下载任务文件</button>
                <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold" onClick={() => navigate('/')}>回到首页</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BottomNav dark />
    </div>
  );
}

function Field({ label, value, onChange, optional }: { label: string; value: number | undefined; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}{optional && <span className="text-gray-600 ml-1">选填</span>}</label>
      <input type="number" inputMode="decimal" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
        value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
