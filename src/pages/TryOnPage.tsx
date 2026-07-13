import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/common/BottomNav';
import GLBModelViewer from '@/components/outfit/GLBModelViewer';
import {
  createBodyModelManifest,
  downloadBodyModelManifest,
  estimateBodyModelQuality,
} from '@/services/bodyModelService';
import { submitReconstruction, getPresetModelPath } from '@/services/avatarApi';
import type { BodyMeasurements, BodyModelManifest, CaptureFrame } from '@/types/bodyModel';
import type { BodyType } from '@/types';

type TryOnStep = 'measure' | 'capture' | 'review' | 'reconstructing' | 'result';
type NumericKey = Exclude<keyof BodyMeasurements, 'bodyType'>;

const CAPTURE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const ANGLE_LABELS: Record<number, string> = {
  0: '正面', 45: '右前', 90: '右侧', 135: '右后',
  180: '背面', 225: '左后', 270: '左侧', 315: '左前',
};

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'hourglass', label: '沙漏型' },
  { value: 'pear', label: '梨型' },
  { value: 'apple', label: '苹果型' },
  { value: 'rectangle', label: '矩形' },
  { value: 'inverted_triangle', label: '倒三角' },
];

const DEFAULT_MEASUREMENTS: BodyMeasurements = { heightCm: 165, weightKg: 55, bodyType: 'hourglass' };

function speak(text: string) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = 0.9;
    speechSynthesis.speak(u);
  }
}

export default function TryOnPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<TryOnStep>('measure');
  const [measurements, setMeasurements] = useState<BodyMeasurements>(DEFAULT_MEASUREMENTS);
  const [frames, setFrames] = useState<CaptureFrame[]>([]);
  const [currentAngleIdx, setCurrentAngleIdx] = useState(0);
  const [countdown, setCountdown] = useState(-1);
  const [borderState, setBorderState] = useState<'waiting' | 'ready' | 'captured'>('waiting');
  const [manifest, setManifest] = useState<BodyModelManifest | null>(null);
  const [reconstructResult, setReconstructResult] = useState<any>(null);
  const [apiAvailable, setApiAvailable] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleMeasureChange = (key: NumericKey, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) setMeasurements((p) => ({ ...p, [key]: n }));
    else if (val === '') setMeasurements((p) => ({ ...p, [key]: undefined as any }));
  };

  // ── 启动前置摄像头 ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      return true;
    } catch {
      alert('无法访问摄像头，请允许相机权限后重试');
      return false;
    }
  };

  // ── 开始采集：填完数据后直接进入 ──
  const beginCapture = async () => {
    const ok = await startCamera();
    if (!ok) return;
    setCurrentAngleIdx(0);
    setFrames([]);
    setCountdown(-1);
    setBorderState('waiting');
    setStep('capture');
    speak('请退后两米，让全身出现在画面中。看到屏幕中央的箭头后，按箭头方向缓慢转身。');
    // 1.5 秒后激活第一个角度
    setTimeout(() => {
      setBorderState('ready');
      setCountdown(3);
      speak('正面，保持不动');
    }, 2500);
  };

  // ── 倒计时 → 拍照 ──
  useEffect(() => {
    if (step !== 'capture' || countdown < 0) return;
    if (countdown === 0) { captureFrame(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, countdown, currentAngleIdx]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const angle = CAPTURE_ANGLES[currentAngleIdx];
    setFrames((prev) => [...prev, {
      angle: angle as any, imageDataUrl,
      capturedAt: new Date().toISOString(),
      qualityScore: Math.round(70 + Math.random() * 25),
    }]);
    setBorderState('captured');

    // 下一个角度
    const next = currentAngleIdx + 1;
    if (next < CAPTURE_ANGLES.length) {
      setTimeout(() => {
        setCurrentAngleIdx(next);
        setBorderState('ready');
        setCountdown(3);
        speak(`${ANGLE_LABELS[CAPTURE_ANGLES[next]]}`);
      }, 1200);
    } else {
      setTimeout(() => {
        speak('采集完成');
        setCountdown(-1);
        setBorderState('waiting');
        setStep('review');
      }, 1200);
    }
  }, [currentAngleIdx]);

  // ── 提交建模 ──
  const submitModeling = async () => {
    const request = {
      measurements, captureFrames: frames,
      captureMode: 'guided-360-phone-stand' as const,
      deviceHint: navigator.userAgent.slice(0, 80),
      createdAt: new Date().toISOString(),
    };
    const m = createBodyModelManifest(request);
    setManifest(m);
    setStep('reconstructing');

    try {
      const result = await submitReconstruction(measurements, frames);
      setReconstructResult(result);
      setApiAvailable(true);
    } catch {
      setApiAvailable(false);
    }
    setStep('result');
  };

  const qualityScore = useMemo(
    () => (frames.length > 0 ? estimateBodyModelQuality(measurements, frames) : 0),
    [measurements, frames]
  );

  const currentAngle = CAPTURE_ANGLES[currentAngleIdx];
  const progressPct = frames.length / CAPTURE_ANGLES.length;
  const nextAngleDeg = CAPTURE_ANGLES[(currentAngleIdx + 1) % CAPTURE_ANGLES.length];

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
              <motion.button
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg"
                whileTap={{ scale: 0.96 }} onClick={beginCapture}>
                📷 开始 360° 采集
              </motion.button>
            </motion.div>
          )}

          {/* ═══ 采集 ═══ */}
          {step === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* 进度 */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-400">采集进度</span>
                  <span className="text-pink-400 font-bold">{frames.length}/{CAPTURE_ANGLES.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progressPct * 100}%` }} />
                </div>
              </div>

              {/* 摄像头画面 */}
              <div className="relative w-full rounded-2xl overflow-hidden bg-black mb-3" style={{ aspectRatio: '3/4' }}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />

                {/* 边框信号 */}
                <div className={`absolute inset-0 pointer-events-none border-4 transition-all duration-500 rounded-2xl ${
                  borderState === 'ready' ? 'border-green-400 shadow-[inset_0_0_40px_rgba(74,222,128,0.3)]' :
                  borderState === 'captured' ? 'border-green-500 shadow-[inset_0_0_60px_rgba(34,197,94,0.5)]' :
                  'border-white/20'
                }`} />

                {/* 旋转箭头指示 */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    className="text-6xl opacity-80"
                    animate={{ rotate: borderState === 'ready' ? 0 : borderState === 'waiting' ? [0, 360] : 0 }}
                    transition={borderState === 'waiting' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
                  >
                    {borderState === 'ready' ? '🎯' : borderState === 'captured' ? '✅' : '🔄'}
                  </motion.div>
                </div>

                {/* 角度标签 */}
                <div className="absolute top-3 left-3 bg-black/50 backdrop-blur rounded-full px-3 py-1">
                  <span className="text-white text-sm font-bold">{ANGLE_LABELS[currentAngle]} ({currentAngle}°)</span>
                </div>

                {/* 下一个角度提示 */}
                <div className="absolute top-3 right-3 bg-black/30 backdrop-blur rounded-full px-2 py-1">
                  <span className="text-white/50 text-xs">→ {ANGLE_LABELS[nextAngleDeg]}</span>
                </div>

                {/* 站位引导 */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur rounded-full px-4 py-2 text-white/60 text-xs">
                  {borderState === 'waiting' && '请缓慢转身，等待边框变绿'}
                  {borderState === 'ready' && '保持不动...'}
                  {borderState === 'captured' && '已捕捉！请继续转身'}
                </div>

                {/* 倒计时 */}
                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <motion.span key={countdown} className="text-8xl font-black text-white"
                      initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      {countdown}
                    </motion.span>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {/* 已拍缩略图 */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
                {frames.map((f, i) => (
                  <div key={i} className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden border border-white/10">
                    <img src={f.imageDataUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {Array.from({ length: CAPTURE_ANGLES.length - frames.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex-shrink-0 w-10 h-14 rounded-lg bg-white/5 border border-white/5" />
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
                  return (
                    <div key={a} className="aspect-[3/4] rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      {f ? <img src={f.imageDataUrl} alt="" className="w-full h-full object-cover" /> :
                        <div className="flex items-center justify-center h-full text-white/20 text-xs">—</div>}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm"
                  onClick={() => { setCurrentAngleIdx(0); setFrames([]); setCountdown(-1); setBorderState('waiting'); setStep('capture'); }}>
                  重新采集</button>
                <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold"
                  onClick={submitModeling}>提交 AIGC 建模</button>
              </div>
            </motion.div>
          )}

          {/* ═══ AIGC 生成中 ═══ */}
          {step === 'reconstructing' && (
            <motion.div key="reconstructing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20">
              <motion.div className="text-7xl mb-6" animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>🧬</motion.div>
              <h2 className="text-xl font-bold text-white mb-3">AIGC 生成 3D 建模中...</h2>
              <div className="space-y-2 text-center">
                {['分析身体数据...', '匹配参数化模型...', '生成 GLB 网格...'].map((t, i) => (
                  <motion.p key={t} className="text-sm text-gray-400"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.5 }}>{t}</motion.p>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ 结果 ═══ */}
          {step === 'result' && manifest && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-1">
                  {apiAvailable ? '✅ 4090D 建模完成' : '📦 预置模型'}
                </h2>
                <p className="text-gray-400 text-sm">
                  身型: {measurements.bodyType} · 身高: {measurements.heightCm}cm · 体重: {measurements.weightKg}kg
                </p>
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
                <button className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm"
                  onClick={() => downloadBodyModelManifest(manifest)}>📥 下载任务文件</button>
                <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold"
                  onClick={() => navigate('/')}>回到首页</button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      <BottomNav dark />
    </div>
  );
}

// ── 输入框 ──
function Field({ label, value, onChange, optional }: {
  label: string; value: number | undefined; onChange: (v: string) => void; optional?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}{optional && <span className="text-gray-600 ml-1">选填</span>}</label>
      <input type="number" inputMode="decimal"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
        value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
