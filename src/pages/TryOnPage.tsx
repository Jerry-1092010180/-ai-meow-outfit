import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/common/BottomNav';
import GLBModelViewer from '@/components/outfit/GLBModelViewer';
import { createBodyModelManifest, downloadBodyModelManifest, estimateBodyModelQuality } from '@/services/bodyModelService';
import { submitReconstruction, getPresetModelPath } from '@/services/avatarApi';
import type { BodyMeasurements, BodyModelManifest, CaptureFrame } from '@/types/bodyModel';
import type { BodyType } from '@/types';

type TryOnStep = 'measure' | 'capture' | 'review' | 'reconstructing' | 'result';
type NumericKey = Exclude<keyof BodyMeasurements, 'bodyType'>;

const CAPTURE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const ANGLE_LABELS: Record<number, string> = { 0: '正面', 45: '右前', 90: '右侧', 135: '右后', 180: '背面', 225: '左后', 270: '左侧', 315: '左前' };
const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'hourglass', label: '沙漏型' }, { value: 'pear', label: '梨型' }, { value: 'apple', label: '苹果型' },
  { value: 'rectangle', label: '矩形' }, { value: 'inverted_triangle', label: '倒三角' },
];
const DEFAULT_MEASUREMENTS: BodyMeasurements = { heightCm: 165, weightKg: 55, bodyType: 'hourglass' };

function speak(text: string) {
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.9; speechSynthesis.speak(u); } catch {}
}

// Simple frame differencing to detect body rotation
function frameDifference(a: ImageData | null, b: ImageData | null): number {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return 1;
  const ad = a.data, bd = b.data;
  let diff = 0;
  const step = 8; // Sample every 8th pixel for performance
  for (let i = 0; i < ad.length; i += step * 4) {
    diff += Math.abs(ad[i] - bd[i]) + Math.abs(ad[i + 1] - bd[i + 1]) + Math.abs(ad[i + 2] - bd[i + 2]);
  }
  return diff / (ad.length / (step * 4) * 3 * 255);
}

export default function TryOnPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const detectIntervalRef = useRef<number>(0);
  const borderRef = useRef<typeof borderState>('waiting');
  const angleIdxRef = useRef(0);

  const [step, setStep] = useState<TryOnStep>('measure');
  const [measurements, setMeasurements] = useState<BodyMeasurements>(DEFAULT_MEASUREMENTS);
  const [frames, setFrames] = useState<CaptureFrame[]>([]);
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);
  const [countdown, setCountdown] = useState(-1);
  const [borderState, _setBorderState] = useState<'waiting' | 'turning' | 'ready' | 'captured'>('waiting');
  const setBorderState = (v: typeof borderState) => { borderRef.current = v; _setBorderState(v); };
  const [cameraReady, setCameraReady] = useState(false);
  const [turnProgress, setTurnProgress] = useState(0);
  const [manifest, setManifest] = useState<BodyModelManifest | null>(null);
  const [reconstructResult, setReconstructResult] = useState<any>(null);
  const [apiAvailable, setApiAvailable] = useState(false);

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
  const beginCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Play immediately, transition to capture UI after short delay
        try { await videoRef.current.play(); } catch {}
      }
      // Transition to capture UI directly — video will show when ready
      setCameraReady(true);
      angleIdxRef.current = 0; setCurrentAngleIdx(0);
      setFrames([]);
      setCountdown(-1);
      setBorderState('waiting');
      setTurnProgress(0);
      prevFrameRef.current = null;
      setStep('capture');
      setTimeout(() => speak('请退后两米，让全身出现在画面中。每次顺时针旋转45度，系统将自动检测并拍照。'), 1000);

      // Motion detection loop — uses refs to avoid stale closure
      detectIntervalRef.current = window.setInterval(() => {
        const current = getFrameData();
        if (!current) return;
        const diff = frameDifference(prevFrameRef.current, current);
        setTurnProgress(Math.min(1, diff * 10));
        const bs = borderRef.current;
        const cai = angleIdxRef.current;

        if (bs !== 'captured' && diff > 0.08) {
          setBorderState('turning');
        } else if ((bs === 'turning' || (bs === 'waiting' && cai === 0)) && diff < 0.04) {
          prevFrameRef.current = current;
          setBorderState('ready');
          setCountdown(2);
        }
      }, 400);
    } catch { alert('无法访问摄像头，请允许相机权限后重试'); }
  }, []);

  // ── 倒计时 → 拍照 ──
  useEffect(() => {
    if (step !== 'capture' || countdown < 0) return;
    if (countdown === 0) {
      const dataUrl = capturePhoto();
      if (!dataUrl) return;
      const angle = CAPTURE_ANGLES[currentAngleIdx];
      setFrames((p) => [...p, { angle: angle as any, imageDataUrl: dataUrl, capturedAt: new Date().toISOString(), qualityScore: 80 }]);
      setBorderState('captured');
      setTurnProgress(0);

      const next = currentAngleIdx + 1;
      if (next < CAPTURE_ANGLES.length) {
        setTimeout(() => {
          angleIdxRef.current = next; setCurrentAngleIdx(next);
          setBorderState('waiting');
          prevFrameRef.current = null;
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
                whileTap={{ scale: 0.96 }} onClick={beginCapture}>📷 开始 360° 采集</motion.button>
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

              <div className="relative w-full rounded-2xl overflow-hidden bg-black mb-3" style={{ aspectRatio: '3/4' }}>
                {/* Camera preview — always visible */}
                <video ref={videoRef} autoPlay playsInline muted webkit-playsinline="true"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)', zIndex: 1 }} />
                <canvas ref={canvasRef} className="hidden" />

                {/* Marquee border — 走马灯 */}
                <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ zIndex: 10 }}>
                  {/* Green marquee when ready */}
                  {borderState === 'ready' && (
                    <div className="absolute inset-0 rounded-2xl border-4 border-transparent"
                      style={{
                        background: 'linear-gradient(90deg, transparent 30%, #4ade80 50%, transparent 70%) border-box',
                        WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                        animation: 'marquee-sweep 1.5s linear infinite',
                      }} />
                  )}
                  {/* Red marquee when turning */}
                  {borderState === 'turning' && (
                    <div className="absolute inset-0 rounded-2xl border-4 border-transparent"
                      style={{
                        background: 'linear-gradient(90deg, transparent 30%, #f87171 50%, transparent 70%) border-box',
                        WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                        animation: 'marquee-sweep 0.8s linear infinite',
                      }} />
                  )}
                  {/* White flash on capture */}
                  {borderState === 'captured' && (
                    <div className="absolute inset-0 rounded-2xl bg-white/60" style={{ animation: 'flash-out 0.8s ease-out forwards' }} />
                  )}
                </div>

                {/* Center clock icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
                  <motion.div className="text-6xl bg-black/30 rounded-full w-20 h-20 flex items-center justify-center"
                    animate={borderState === 'turning' ? { rotate: 360 } :
                             borderState === 'ready' ? { scale: [1, 1.2, 1] } : {}}
                    transition={borderState === 'turning' ? { duration: 1.5, repeat: Infinity, ease: 'linear' } : { duration: 0.6 }}>
                    <span className="text-4xl">{borderState === 'ready' ? '🎯' : borderState === 'captured' ? '📸' : '🕐'}</span>
                  </motion.div>
                </div>

                {/* Top info bar */}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur rounded-full px-3 py-1" style={{ zIndex: 10 }}>
                  <span className="text-white text-sm font-bold">{ANGLE_LABELS[currentAngle]} · {currentAngle}°</span>
                </div>
                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur rounded-full px-2 py-1 text-xs text-white/70" style={{ zIndex: 10 }}>
                  {frames.length}/{CAPTURE_ANGLES.length}
                </div>

                {/* Bottom instruction */}
                <div className="absolute bottom-6 left-4 right-4 pointer-events-none" style={{ zIndex: 10 }}>
                  <div className="bg-black/60 backdrop-blur rounded-2xl px-4 py-3 text-center">
                    <p className="text-white text-sm font-bold">
                      {borderState === 'waiting' && '每次顺时针旋转45度 · 系统自动检测'}
                      {borderState === 'turning' && '✅ 正在转身 · 边框变绿时停下'}
                      {borderState === 'ready' && '📍 角度到位 · 保持不动'}
                      {borderState === 'captured' && '📸 已拍照 · 继续顺时针旋转45度'}
                    </p>
                  </div>
                </div>

                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20" style={{ zIndex: 20 }}>
                    <motion.span key={countdown} className="text-8xl font-black text-white drop-shadow-2xl"
                      initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{countdown}</motion.span>
                  </div>
                )}
              </div>

              {/* Marquee animation keyframes */}
              <style>{`
                @keyframes marquee-sweep {
                  0% { background-position: -200% 0; }
                  100% { background-position: 200% 0; }
                }
                @keyframes flash-out {
                  0% { opacity: 1; }
                  100% { opacity: 0; }
                }
              `}</style>

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
                <button className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm" onClick={() => { stopCamera(); beginCapture(); }}>重新采集</button>
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
                  <GLBModelViewer modelPath={`http://100.114.7.5:8765/models/${reconstructResult.job_id}.glb`} />
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
