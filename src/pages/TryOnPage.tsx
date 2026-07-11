import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Model3DViewer from '@/components/outfit/Model3DViewer';
import BottomNav from '@/components/common/BottomNav';
import {
  createBodyModelManifest,
  downloadBodyModelManifest,
  estimateBodyModelQuality,
} from '@/services/bodyModelService';
import type {
  BodyMeasurements,
  BodyModelManifest,
  CaptureFrame,
} from '@/types/bodyModel';
import type { BodyType } from '@/types';
import { submitReconstruction, checkAvatarHealth } from '@/services/avatarApi';

type TryOnStep = 'measure' | 'setup' | 'capture' | 'review' | 'reconstructing' | 'result';
type NumericKey = Exclude<keyof BodyMeasurements, 'bodyType'>;

// 8 个关键角度 (45° 间隔, 覆盖 360°)
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

const DEFAULT_MEASUREMENTS: BodyMeasurements = {
  heightCm: 165, weightKg: 55, bodyType: 'hourglass',
};

/** 语音引导 */
function speak(text: string) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.9;
    speechSynthesis.speak(u);
  }
}

/** 简易帧质量评估 */
function assessFrameQuality(imageDataUrl: string): number {
  // 实际产品中会用亮度、对比度、人体检测等指标
  // 这里简化：data URL 长度作为粗略质量指标
  const baseLen = imageDataUrl.length;
  const minLen = 5000, maxLen = 200000;
  return Math.round(Math.min(100, ((baseLen - minLen) / (maxLen - minLen)) * 60 + 35));
}

export default function TryOnPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<TryOnStep>('measure');
  const [measurements, setMeasurements] = useState<BodyMeasurements>(DEFAULT_MEASUREMENTS);
  const [frames, setFrames] = useState<CaptureFrame[]>([]);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [countdown, setCountdown] = useState(-1);
  const [manifest, setManifest] = useState<BodyModelManifest | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [reconstructResult, setReconstructResult] = useState<any>(null);
  const [apiAvailable, setApiAvailable] = useState(false);

  // 清理摄像头
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Step：资料填写 ──
  const handleMeasureChange = (key: NumericKey, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      setMeasurements((p) => ({ ...p, [key]: n }));
    } else if (val === '') {
      setMeasurements((p) => ({ ...p, [key]: undefined as any }));
    }
  };

  // ── Step：初始化摄像头 ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch {
      alert('无法访问摄像头，请允许相机权限后重试');
    }
  };

  // ── Step：开始采集 ──
  const startCapture = useCallback(() => {
    setCurrentAngle(0);
    setFrames([]);
    setCountdown(-1);
    setStep('capture');
    speak('请站到手机前方两米处，双手自然下垂。准备好了就开始。');
    // 2 秒后开始第一个角度
    setTimeout(() => {
      setCountdown(3);
      speak(`第一个角度：正面。保持不动，3，2，1`);
    }, 2000);
  }, []);

  // 倒计时逻辑
  useEffect(() => {
    if (step !== 'capture' || countdown < 0) return;
    if (countdown === 0) {
      // 拍照
      captureFrame();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, countdown, currentAngle]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const frame: CaptureFrame = {
      angle: currentAngle as any,
      imageDataUrl,
      capturedAt: new Date().toISOString(),
      qualityScore: assessFrameQuality(imageDataUrl),
    };

    setFrames((prev) => [...prev, frame]);

    // 下一个角度
    const nextIdx = CAPTURE_ANGLES.indexOf(currentAngle) + 1;
    if (nextIdx < CAPTURE_ANGLES.length) {
      const nextAngle = CAPTURE_ANGLES[nextIdx];
      setCurrentAngle(nextAngle);
      setCountdown(3);
      const label = ANGLE_LABELS[nextAngle];
      speak(`转向${label}，保持不动，3，2，1`);
    } else {
      // 采集完成
      speak('采集完成！来看看效果吧。');
      setCountdown(-1);
      setStep('review');
    }
  }, [currentAngle]);

  // ── Step：提交建模 ──
  const submitModeling = async () => {
    // Create manifest for local download
    const request = {
      measurements,
      captureFrames: frames,
      captureMode: 'guided-360-phone-stand' as const,
      deviceHint: navigator.userAgent.slice(0, 80),
      createdAt: new Date().toISOString(),
    };
    const m = createBodyModelManifest(request);
    setManifest(m);

    // Try real GPU reconstruction
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

  // ── 评分 ──
  const qualityScore = useMemo(
    () => (frames.length > 0 ? estimateBodyModelQuality(measurements, frames) : 0),
    [measurements, frames]
  );

  const progressPct = frames.length / CAPTURE_ANGLES.length;

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom bg-gray-950">
      <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-gray-400 text-sm" onClick={() => { stopCamera(); navigate(-1); }}>← 返回</button>
          <h1 className="text-lg font-bold text-white">
            {step === 'measure' && '身体数据'}
            {step === 'setup' && '架设手机'}
            {step === 'capture' && `采集 ${frames.length}/${CAPTURE_ANGLES.length}`}
            {step === 'review' && '预览'}
            {step === 'reconstructing' && '重建中...'}
            {step === 'result' && (apiAvailable ? '真实模型' : '建模结果')}
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {/* ═══ Step 1: 身体数据 ═══ */}
          {step === 'measure' && (
            <motion.div key="measure" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-6">
                <span className="text-5xl mb-4 block">📋</span>
                <h2 className="text-xl font-bold text-white mb-2">身体数据</h2>
                <p className="text-gray-400 text-sm">AI 将根据这些数据为你生成专属 3D 数字分身</p>
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
                      <button
                        key={bt.value}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          measurements.bodyType === bt.value
                            ? 'bg-pink-500 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                        onClick={() => setMeasurements((p) => ({ ...p, bodyType: bt.value }))}
                      >
                        {bt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <motion.button
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg"
                whileTap={{ scale: 0.96 }}
                onClick={() => setStep('setup')}
              >
                下一步：架设手机
              </motion.button>
            </motion.div>
          )}

          {/* ═══ Step 2: 架设手机 ═══ */}
          {step === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-6">
                <span className="text-6xl mb-4 block">📱</span>
                <h2 className="text-xl font-bold text-white mb-2">架设手机</h2>
                <p className="text-gray-400 text-sm max-w-xs mx-auto">
                  将手机固定在与胸部齐平的位置（如靠墙、书架或三脚架），后置摄像头对准你站立的区域。
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6">
                <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
                  {cameraReady ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <span className="text-4xl mb-3">📷</span>
                      <p className="text-sm">摄像头预览</p>
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
              {!cameraReady ? (
                <motion.button
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg"
                  whileTap={{ scale: 0.96 }}
                  onClick={startCamera}
                >
                  📷 打开相机
                </motion.button>
              ) : (
                <motion.button
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg"
                  whileTap={{ scale: 0.96 }}
                  onClick={startCapture}
                >
                  ⚡ 开始 360° 采集
                </motion.button>
              )}
              <button
                className="w-full mt-3 py-2 text-sm text-gray-500"
                onClick={() => { setStep('measure'); stopCamera(); }}
              >
                上一步
              </button>
            </motion.div>
          )}

          {/* ═══ Step 3: 自动采集 ═══ */}
          {step === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* 进度条 */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400">采集进度</span>
                  <span className="text-pink-400 font-bold">{frames.length}/{CAPTURE_ANGLES.length}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPct * 100}%` }}
                  />
                </div>
              </div>

              {/* 摄像头 + 引导 */}
              <div className="relative w-full rounded-2xl overflow-hidden bg-black mb-4" style={{ aspectRatio: '4/3' }}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* 人形站位引导框 */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-2/5 h-4/5 border-2 border-dashed border-pink-400/50 rounded-3xl flex items-center justify-center">
                    <span className="text-pink-400/30 text-xs">站位区域</span>
                  </div>
                </div>

                {/* 当前角度 */}
                <div className="absolute top-3 left-3 bg-black/50 backdrop-blur rounded-full px-3 py-1">
                  <span className="text-white text-sm font-bold">
                    {ANGLE_LABELS[currentAngle]} ({currentAngle}°)
                  </span>
                </div>

                {/* 倒计时 */}
                {countdown >= 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <motion.div
                      key={countdown}
                      className="text-8xl font-black text-white"
                      initial={{ scale: 2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                    >
                      {countdown > 0 ? countdown : '📸'}
                    </motion.div>
                  </div>
                )}
              </div>

              {/* 已采集缩略图 */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {frames.map((f, i) => (
                  <div key={i} className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-white/10 relative">
                    <img src={f.imageDataUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-center text-white">
                      {ANGLE_LABELS[f.angle]}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 4: 预览 ═══ */}
          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-2">采集完成 ✨</h2>
                <p className="text-gray-400 text-sm">
                  {frames.length}/{CAPTURE_ANGLES.length} 个角度 · 质量评分 {qualityScore}
                </p>
              </div>
              {/* 8 格预览 */}
              <div className="grid grid-cols-4 gap-1.5 mb-6">
                {CAPTURE_ANGLES.map((angle) => {
                  const frame = frames.find((f) => f.angle === angle);
                  return (
                    <div key={angle} className="aspect-[3/4] rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      {frame ? (
                        <div className="relative w-full h-full">
                          <img src={frame.imageDataUrl} alt="" className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-center text-white py-0.5">
                            {ANGLE_LABELS[angle]}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-white/20 text-xs">缺失</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium"
                  onClick={() => { setStep('capture'); startCapture(); }}
                >
                  重新采集
                </button>
                <button
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold"
                  onClick={submitModeling}
                >
                  提交建模
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ Step: 重建中 ═══ */}
          {step === 'reconstructing' && (
            <motion.div key="reconstructing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20">
              <motion.div className="text-6xl mb-6" animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>✨</motion.div>
              <h2 className="text-xl font-bold text-white mb-2">4090D GPU 重建中...</h2>
              <p className="text-gray-400 text-sm text-center max-w-xs">
                正在将 {frames.length} 张多视角照片通过 silhouette carving + marching cubes 生成 3D 模型
              </p>
            </motion.div>
          )}

          {/* ═══ Step: 结果 ═══ */}
          {step === 'result' && manifest && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">{apiAvailable ? '✅' : '🎉'}</div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {apiAvailable ? '4090D GPU 真实重建完成' : '建模任务已生成'}
                </h2>
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="text-gray-400">评分 {qualityScore}/100</span>
                  {reconstructResult && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="text-green-400">{reconstructResult.vertices.toLocaleString()} 顶点</span>
                      <span className="text-gray-600">·</span>
                      <span className="text-green-400">{reconstructResult.elapsed_seconds}s</span>
                    </>
                  )}
                </div>
              </div>

              {/* 真实 GLB 模型 或 参数化预览 */}
              <div className="mb-6">
                {apiAvailable && reconstructResult ? (
                  <>
                    <p className="text-xs text-green-400 text-center mb-2">← 4090D GPU 生成的真人 GLB 模型（可下载） →</p>
                    <div className="rounded-2xl overflow-hidden bg-gray-900 shadow-2xl" style={{ aspectRatio: '3/4', minHeight: 400 }}>
                      <a
                        href={`http://100.114.7.5:8765/models/${reconstructResult.job_id}.glb`}
                        target="_blank"
                        className="flex items-center justify-center w-full h-full text-pink-400 font-bold text-lg hover:underline"
                      >
                        📦 点击下载 GLB 模型
                        <br />
                        <span className="text-sm text-gray-500 font-normal">
                          ({reconstructResult.vertices.toLocaleString()} 顶点, {reconstructResult.faces.toLocaleString()} 面)
                        </span>
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 text-center mb-2">← 参数化预览（非最终 GLB 模型，AIGC 未连通时显示） →</p>
                    <Model3DViewer bodyModel={measurements} />
                  </>
                )}
              </div>

              {/* 流水线 */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-400">后端建模流水线</span>
                  {apiAvailable && <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">已在 4090D 上执行</span>}
                </div>
                {manifest.pipeline.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500 py-1">
                    <span className={apiAvailable ? 'text-green-400' : 'text-pink-400'}>
                      {apiAvailable ? '✓' : i + 1 + '.'}
                    </span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium"
                  onClick={() => downloadBodyModelManifest(manifest)}
                >
                  📥 下载任务文件
                </button>
                <button
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-sm"
                  onClick={() => navigate('/')}
                >
                  回到首页
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav dark />
    </div>
  );
}

// ── 输入字段 ──
function Field({
  label, value, onChange, optional,
}: {
  label: string; value: number | undefined; onChange: (v: string) => void; optional?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">
        {label}{optional && <span className="text-gray-600 ml-1">选填</span>}
      </label>
      <input
        type="number"
        inputMode="decimal"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                   focus:border-pink-500 focus:outline-none placeholder-gray-600"
        placeholder="—"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
