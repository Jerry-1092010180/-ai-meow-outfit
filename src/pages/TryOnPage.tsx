import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import GLBModelViewer from '@/components/outfit/GLBModelViewer';
import { createBodyModelManifest, downloadBodyModelManifest, estimateBodyModelQuality } from '@/services/bodyModelService';
import { getPresetModelPath } from '@/services/avatarApi';
import { avatarOutfitProvider } from '@/services/avatarOutfitProvider';
import {
  createDefaultAppearance,
  DEFAULT_DEMO_OUTFIT,
  DEFAULT_VRM_READY_METADATA,
  faceIdentityProvider,
  stylizedAvatarProvider,
} from '@/services/avatarPipeline';
import { analyzeSelfieFrame, type SelfieAnalysis } from '@/services/selfieAnalysis';
import type { BodyMeasurements, BodyModelManifest, SelfieFrame } from '@/types/bodyModel';
import type { BodyType } from '@/types';
import type { AvatarOutfit, StylizedAvatar } from '@/types/avatarSystem';

type TryOnStep = 'profile' | 'selfie' | 'review' | 'reconstructing' | 'result';
type NumericKey = Exclude<keyof BodyMeasurements, 'bodyType' | 'skinTone'>;

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'hourglass', label: '沙漏型' },
  { value: 'pear', label: '梨型' },
  { value: 'apple', label: '苹果型' },
  { value: 'rectangle', label: '矩形' },
  { value: 'inverted_triangle', label: '倒三角' },
];

const SKIN_TONES = ['#f4c7a5', '#e5aa82', '#d08a61', '#b86f4a', '#8f553c'];
const DEFAULT_MEASUREMENTS: BodyMeasurements = { heightCm: 165, weightKg: 55, bodyType: 'hourglass' };
const HEAD_SCAN_STEPS: { label: NonNullable<SelfieFrame['poseLabel']>; title: string; hint: string }[] = [
  { label: 'front', title: '看镜头', hint: '保持正脸，露出完整脸部和肩颈' },
  { label: 'left', title: '慢慢看左边', hint: '头部轻转，不要转动身体' },
  { label: 'right', title: '慢慢看右边', hint: '回到中间后再轻轻看右边' },
  { label: 'up', title: '微微抬头', hint: '下巴稍微抬起，保持脸在框内' },
  { label: 'down', title: '微微低头', hint: '眼睛看屏幕，下巴轻轻收一点' },
];

function speak(text: string) {
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  } catch {}
}

export default function TryOnPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<number>(0);
  const readyTicksRef = useRef(0);
  const countdownRef = useRef(-1);
  const analysisRef = useRef<SelfieAnalysis | null>(null);
  const manualCaptureAvailableRef = useRef(false);
  const scanStepIdxRef = useRef(0);
  const scanFramesRef = useRef<SelfieFrame[]>([]);
  const stepStartedAtRef = useRef(Date.now());

  const [step, setStep] = useState<TryOnStep>('profile');
  const [measurements, setMeasurements] = useState<BodyMeasurements>(DEFAULT_MEASUREMENTS);
  const [selfieFrame, setSelfieFrame] = useState<SelfieFrame | null>(null);
  const [selfieFrames, setSelfieFrames] = useState<SelfieFrame[]>([]);
  const [selfieAnalysis, setSelfieAnalysis] = useState<SelfieAnalysis | null>(null);
  const [scanStepIdx, setScanStepIdx] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState(-1);
  const [manualCaptureAvailable, setManualCaptureAvailable] = useState(false);
  const [manifest, setManifest] = useState<BodyModelManifest | null>(null);
  const [stylizedAvatar, setStylizedAvatar] = useState<StylizedAvatar | null>(null);
  const [outfitOptions, setOutfitOptions] = useState<AvatarOutfit[]>([]);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string>('');
  const [apiAvailable, setApiAvailable] = useState(false);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  const stopCamera = useCallback(() => {
    clearInterval(detectIntervalRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoRef.current = null;
    setCameraReady(false);
    console.log('[Avatar] Selfie Camera Stopped');
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleMeasureChange = (key: NumericKey, val: string) => {
    const n = Number.parseFloat(val);
    if (Number.isFinite(n) && n > 0) setMeasurements((prev) => ({ ...prev, [key]: n }));
    else if (val === '') setMeasurements((prev) => ({ ...prev, [key]: undefined }));
  };

  const getFrameData = useCallback((): ImageData | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = 360;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, []);

  const captureSelfie = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  const startSelfieFlow = useCallback(() => {
    setSelfieFrame(null);
    setSelfieFrames([]);
    setSelfieAnalysis(null);
    analysisRef.current = null;
    readyTicksRef.current = 0;
    scanStepIdxRef.current = 0;
    scanFramesRef.current = [];
    stepStartedAtRef.current = Date.now();
    setScanStepIdx(0);
    setCountdown(-1);
    setManualCaptureAvailable(false);
    manualCaptureAvailableRef.current = false;
    setCameraReady(false);
    setStep('selfie');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'selfie') {
      stopCamera();
      setCountdown(-1);
      setSelfieAnalysis(null);
      setStep('profile');
      return;
    }
    if (step === 'review') {
      startSelfieFlow();
      return;
    }
    if (step === 'result') {
      setStep('profile');
      return;
    }
    if (step !== 'reconstructing') {
      stopCamera();
      navigate(-1);
    }
  }, [navigate, startSelfieFlow, step, stopCamera]);

  useEffect(() => {
    if (step !== 'selfie' || cameraReady) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        console.log('[Avatar] Selfie Camera Started facingMode=user');
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const video = document.createElement('video');
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.muted = true;
        video.srcObject = stream;
        video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);z-index:0;';
        videoRef.current = video;

        await new Promise<void>((resolve) => {
          const attach = () => {
            if (containerRef.current) {
              containerRef.current.innerHTML = '';
              containerRef.current.appendChild(video);
              resolve();
            } else {
              window.setTimeout(attach, 40);
            }
          };
          attach();
        });

        try {
          await video.play();
        } catch {}
        if (cancelled) return;

        setCameraReady(true);
        speak(HEAD_SCAN_STEPS[0].title);
        detectIntervalRef.current = window.setInterval(() => {
          const current = getFrameData();
          if (!current) return;
          const analysis = analyzeSelfieFrame(current);
          analysisRef.current = analysis;
          setSelfieAnalysis(analysis);
          const elapsedMs = Date.now() - stepStartedAtRef.current;
          if (!manualCaptureAvailableRef.current && elapsedMs > 2500) {
            manualCaptureAvailableRef.current = true;
            setManualCaptureAvailable(true);
          }

          if (countdownRef.current > 0 && !analysis.ready && elapsedMs < 6500) {
            setCountdown(-1);
            readyTicksRef.current = 0;
            return;
          }
          if (analysis.ready) {
            readyTicksRef.current += 1;
            if (countdownRef.current < 0 && readyTicksRef.current >= 2) setCountdown(2);
          } else if (countdownRef.current < 0 && elapsedMs > 6500 && analysis.qualityScore >= 18) {
            console.info('[Avatar] Head Scan Auto Capture fallback step=' + scanStepIdxRef.current + ' quality=' + analysis.qualityScore);
            setCountdown(2);
          } else {
            readyTicksRef.current = 0;
          }
        }, 220);
      } catch (err: any) {
        console.error('[Avatar] Selfie Camera FAILED', err?.message || err);
        if (!cancelled) alert(`摄像头启动失败: ${err.message || '未知错误'}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraReady, getFrameData, step]);

  useEffect(() => {
    if (step !== 'selfie' || countdown < 0) return;
    if (countdown === 0) {
      const imageDataUrl = captureSelfie();
      const analysis = analysisRef.current;
      if (!imageDataUrl || !analysis) return;
      const frame: SelfieFrame = {
        imageDataUrl,
        capturedAt: new Date().toISOString(),
        qualityScore: analysis.qualityScore,
        faceBox: analysis.faceBox ?? undefined,
        skinToneHex: analysis.skinToneHex,
        source: 'guided-head-scan',
        poseLabel: HEAD_SCAN_STEPS[scanStepIdxRef.current].label,
      };
      const nextFrames = [...scanFramesRef.current, frame];
      scanFramesRef.current = nextFrames;
      setSelfieFrames(nextFrames);
      if (frame.poseLabel === 'front') setSelfieFrame(frame);
      setMeasurements((prev) => ({
        ...prev,
        skinTone: prev.skinTone ?? frame.skinToneHex,
      }));
      const nextStep = scanStepIdxRef.current + 1;
      if (nextStep < HEAD_SCAN_STEPS.length) {
        scanStepIdxRef.current = nextStep;
        stepStartedAtRef.current = Date.now();
        setScanStepIdx(nextStep);
        readyTicksRef.current = 0;
        manualCaptureAvailableRef.current = false;
        setManualCaptureAvailable(false);
        setCountdown(-1);
        speak(HEAD_SCAN_STEPS[nextStep].title);
        return;
      }
      setSelfieFrame(nextFrames.find((item) => item.poseLabel === 'front') ?? nextFrames[0] ?? frame);
      stopCamera();
      setCountdown(-1);
      setStep('review');
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [captureSelfie, countdown, step, stopCamera]);

  const submitModeling = async () => {
    const primarySelfie = selfieFrame ?? selfieFrames[0];
    if (!primarySelfie) return;
    console.log('[Avatar] Submit Started pipeline=identity-driven-stylized-avatar frames=' + selfieFrames.length);
    const avatarManifest = createBodyModelManifest({
      measurements,
      captureFrames: [],
      selfieFrame: primarySelfie,
      selfieFrames,
      captureMode: 'guided-head-scan',
      deviceHint: navigator.userAgent.slice(0, 80),
      createdAt: new Date().toISOString(),
    });
    setManifest(avatarManifest);
    setStep('reconstructing');
    try {
      const identity = await faceIdentityProvider.extract(selfieFrames.length > 0 ? selfieFrames : [primarySelfie], navigator.userAgent.slice(0, 80));
      const { avatar } = await stylizedAvatarProvider.build({
        identity,
        appearance: createDefaultAppearance(measurements),
        outfit: DEFAULT_DEMO_OUTFIT,
        measurements,
      });
      console.log('[Avatar] Submit Success method=' + (avatar.method || 'unknown'));
      setStylizedAvatar(avatar);
      setApiAvailable(true);
    } catch (err: any) {
      console.warn('[Avatar] Submit FAILED fallback-to-preset', err?.message || err);
      setStylizedAvatar(null);
      setApiAvailable(false);
    }
    setStep('result');
  };

  useEffect(() => {
    if (step !== 'result') return;
    let cancelled = false;
    avatarOutfitProvider.listDemoOutfits()
      .then((outfits) => {
        if (cancelled) return;
        setOutfitOptions(outfits);
        setSelectedOutfitId((current) => current || outfits[0]?.id || '');
      })
      .catch((err) => {
        console.warn('[AvatarOutfit] Product Load FAILED', err);
        if (!cancelled) setOutfitOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  const qualityScore = useMemo(
    () => estimateBodyModelQuality(measurements, [], selfieFrame ?? selfieFrames[0] ?? undefined),
    [measurements, selfieFrame, selfieFrames]
  );
  const analysisMetrics = selfieAnalysis
    ? ([
        ['脸部', selfieAnalysis.faceScore],
        ['居中', selfieAnalysis.centeredScore],
        ['光线', selfieAnalysis.lightingScore],
        ['清晰', selfieAnalysis.sharpnessScore],
      ] as const)
    : [];
  const selectedOutfit = useMemo(
    () => outfitOptions.find((outfit) => outfit.id === selectedOutfitId) ?? outfitOptions[0] ?? null,
    [outfitOptions, selectedOutfitId]
  );

  return (
    <div className="min-h-screen pb-8 safe-top safe-bottom bg-gray-950">
      <header className="sticky top-0 z-20 bg-gray-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-gray-400 text-sm" onClick={handleBack}>← {step === 'review' ? '重拍' : '返回'}</button>
          <h1 className="text-lg font-bold text-white">
            {step === 'profile' && '动漫化身'}
            {step === 'selfie' && '头部扫描'}
            {step === 'review' && '确认生成'}
            {step === 'reconstructing' && 'AIGC 生成中...'}
            {step === 'result' && '数字人结果'}
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {step === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <section className="mb-5">
                <p className="text-pink-300 text-sm font-semibold mb-2">银泰喵搭 Anime Avatar</p>
                <h2 className="text-2xl font-black text-white mb-2">轻转头生成漫画感人物模特</h2>
                <p className="text-gray-400 text-sm leading-6">
                  像录入人脸一样采集正脸、左右侧脸和上下角度，AIGC 会把你的脸部特征美化成漫画感 3D 角色。下方数据只是风格偏好，可直接跳过。
                </p>
              </section>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4 mb-5">
                <p className="text-white text-sm font-semibold">可选风格参数</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="身高 (cm)" value={measurements.heightCm} onChange={(v) => handleMeasureChange('heightCm', v)} />
                  <Field label="体重 (kg)" value={measurements.weightKg} onChange={(v) => handleMeasureChange('weightKg', v)} />
                  <Field label="头围 (cm)" value={measurements.headCm} onChange={(v) => handleMeasureChange('headCm', v)} optional />
                  <Field label="肩宽 (cm)" value={measurements.shoulderCm} onChange={(v) => handleMeasureChange('shoulderCm', v)} optional />
                  <Field label="胸围 (cm)" value={measurements.bustCm} onChange={(v) => handleMeasureChange('bustCm', v)} optional />
                  <Field label="腰围 (cm)" value={measurements.waistCm} onChange={(v) => handleMeasureChange('waistCm', v)} optional />
                  <Field label="臀围 (cm)" value={measurements.hipCm} onChange={(v) => handleMeasureChange('hipCm', v)} optional />
                  <Field label="臂长 (cm)" value={measurements.armCm} onChange={(v) => handleMeasureChange('armCm', v)} optional />
                  <Field label="腿长 (cm)" value={measurements.legCm} onChange={(v) => handleMeasureChange('legCm', v)} optional />
                  <Field label="内长 (cm)" value={measurements.inseamCm} onChange={(v) => handleMeasureChange('inseamCm', v)} optional />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-2 block">身型</label>
                  <div className="flex gap-2 flex-wrap">
                    {BODY_TYPES.map((bt) => (
                      <button
                        key={bt.value}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${measurements.bodyType === bt.value ? 'bg-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}
                        onClick={() => setMeasurements((prev) => ({ ...prev, bodyType: bt.value }))}
                      >
                        {bt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-2 block">肤色参考<span className="text-gray-600 ml-1">选填</span></label>
                  <div className="flex items-center gap-2">
                    {SKIN_TONES.map((tone) => (
                      <button
                        key={tone}
                        aria-label={tone}
                        className={`w-8 h-8 rounded-full border-2 ${measurements.skinTone === tone ? 'border-white' : 'border-white/10'}`}
                        style={{ background: tone }}
                        onClick={() => setMeasurements((prev) => ({ ...prev, skinTone: tone }))}
                      />
                    ))}
                    <button className="ml-1 text-xs text-gray-500" onClick={() => setMeasurements((prev) => ({ ...prev, skinTone: undefined }))}>
                      自动识别
                    </button>
                  </div>
                </div>
              </div>

              <motion.button
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg"
                whileTap={{ scale: 0.96 }}
                onClick={startSelfieFlow}
              >
                开始头部扫描
              </motion.button>
            </motion.div>
          )}

          {step === 'selfie' && (
            <motion.div key="selfie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                className="relative w-full rounded-2xl overflow-hidden bg-gray-900 mb-3"
                style={{
                  aspectRatio: '3/4',
                  boxShadow: selfieAnalysis?.ready
                    ? '0 0 42px 8px rgba(74,222,128,0.55), inset 0 0 30px rgba(74,222,128,0.18)'
                    : '0 0 24px rgba(236,72,153,0.18)',
                }}
              >
                <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#111' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div className="absolute inset-x-0 top-0 h-24 z-10" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)' }} />
                <div className="absolute inset-x-0 bottom-0 h-36 z-10" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.76), transparent)' }} />

                {selfieAnalysis?.faceBox && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${selfieAnalysis.faceBox.x * 100}%`,
                      top: `${selfieAnalysis.faceBox.y * 100}%`,
                      width: `${selfieAnalysis.faceBox.width * 100}%`,
                      height: `${selfieAnalysis.faceBox.height * 100}%`,
                      border: `2px solid ${selfieAnalysis.ready ? '#4ade80' : '#fbbf24'}`,
                      borderRadius: '40% 40% 45% 45%',
                      boxShadow: selfieAnalysis.ready ? '0 0 18px rgba(74,222,128,0.7)' : '0 0 12px rgba(251,191,36,0.5)',
                      zIndex: 8,
                      pointerEvents: 'none',
                      transition: 'all 0.22s ease',
                    }}
                  />
                )}

                <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
                  <div className="rounded-full bg-black/55 px-3 py-1.5 text-white text-sm font-bold backdrop-blur">
                    {scanStepIdx + 1}/{HEAD_SCAN_STEPS.length} · {HEAD_SCAN_STEPS[scanStepIdx].title}
                  </div>
                  <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selfieAnalysis?.ready ? 'bg-green-400 text-gray-950' : 'bg-white/15 text-white'}`}>
                    {selfieAnalysis ? `${selfieAnalysis.qualityScore} 分` : cameraReady ? '检测中' : '启动中'}
                  </div>
                </div>

                <div className="absolute bottom-4 left-3 right-3 z-20">
                  <div className={`h-1 rounded-full mb-2 ${selfieAnalysis?.ready ? 'bg-green-400' : 'bg-pink-400/70'}`} />
                  <div className="rounded-2xl bg-black/65 backdrop-blur px-4 py-3 text-center">
                    <p className="text-white text-base font-bold">{selfieAnalysis?.ready ? '保持一下，自动捕获' : HEAD_SCAN_STEPS[scanStepIdx].title}</p>
                    <p className="text-gray-300 text-xs mt-1">{selfieAnalysis?.detail ?? HEAD_SCAN_STEPS[scanStepIdx].hint}</p>
                  </div>
                </div>

                {countdown > 0 && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
                    <motion.span
                      key={countdown}
                      className="text-8xl font-black text-white"
                      style={{ textShadow: '0 5px 22px rgba(0,0,0,0.55)' }}
                      initial={{ scale: 1.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      {countdown}
                    </motion.span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {analysisMetrics.map(([label, value]) => {
                  const pct = Math.round(value * 100);
                  const active = pct >= 70;
                  return (
                    <div key={label} className={`rounded-lg px-2 py-2 text-center border ${active ? 'bg-green-500/10 border-green-400/30' : 'bg-white/5 border-white/10'}`}>
                      <div className={`text-[10px] ${active ? 'text-green-300' : 'text-gray-500'}`}>{label}</div>
                      <div className={`text-sm font-bold ${active ? 'text-green-200' : 'text-gray-300'}`}>{pct}</div>
                    </div>
                  );
                })}
              </div>

              {manualCaptureAvailable && countdown < 0 && (
                <button
                  type="button"
                  className="w-full py-2.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-semibold"
                  onClick={() => setCountdown(0)}
                >
                  手动捕获当前角度
                </button>
              )}
            </motion.div>
          )}

          {step === 'review' && (selfieFrame || selfieFrames[0]) && (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-1">头部扫描完成</h2>
                <p className="text-gray-400 text-sm">{selfieFrames.length}/{HEAD_SCAN_STEPS.length} 角度 · 综合质量 {qualityScore}</p>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mb-4">
                {HEAD_SCAN_STEPS.map((scanStep) => {
                  const frame = selfieFrames.find((item) => item.poseLabel === scanStep.label);
                  return (
                    <div key={scanStep.label} className="aspect-[3/4] rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      {frame ? <img src={frame.imageDataUrl} alt={scanStep.title} className="w-full h-full object-cover" /> : null}
                    </div>
                  );
                })}
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-5">
                <p className="text-white text-sm font-semibold mb-2">生成策略</p>
                <p className="text-gray-400 text-sm leading-6">
                  正脸、左右和上下角度会一起提交给 AIGC，用于漫画化脸部特征、头发轮廓和立体角色生成；身体走卡通人物比例，可继续接银泰衣物、pose、表情和社交同框。
                </p>
              </div>
              <div className="sticky bottom-4 z-30 flex gap-3 rounded-2xl bg-gray-950/92 py-3 backdrop-blur">
                <button className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm" onClick={startSelfieFlow}>重拍</button>
                <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold" onClick={submitModeling}>
                  提交 AIGC 生成
                </button>
              </div>
            </motion.div>
          )}

          {step === 'reconstructing' && (
            <motion.div key="reconstructing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
              <motion.div className="text-7xl mb-6" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>🧬</motion.div>
              <h2 className="text-xl font-bold text-white mb-3">AIGC 生成动漫化身中...</h2>
              {['融合多角度脸部特征...', '生成漫画感立体角色...', '绑定可换装 GLB...'].map((text, index) => (
                <motion.p key={text} className="text-sm text-gray-400" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.45 }}>
                  {text}
                </motion.p>
              ))}
            </motion.div>
          )}

          {step === 'result' && manifest && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-white mb-1">{apiAvailable ? '动漫化身已生成' : '预置化身预览'}</h2>
                <p className="text-gray-400 text-sm">漫画感角色 · 可接银泰衣物换装和 pose 分享</p>
              </div>
              <div className="mb-5">
                {apiAvailable && stylizedAvatar ? (
                  <GLBModelViewer
                    modelPath={stylizedAvatar.cdnUrl || stylizedAvatar.modelUrl || getPresetModelPath(measurements.bodyType)}
                    renderStyle={stylizedAvatar.appearance.style}
                    outfit={selectedOutfit}
                    runtimeMetadata={stylizedAvatar.runtimeMetadata}
                  />
                ) : (
                  <GLBModelViewer
                    modelPath={getPresetModelPath(measurements.bodyType)}
                    renderStyle={createDefaultAppearance(measurements).style}
                    outfit={selectedOutfit}
                    runtimeMetadata={DEFAULT_VRM_READY_METADATA}
                  />
                )}
              </div>
              {outfitOptions.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">银泰商品换装</p>
                    <p className="text-[11px] text-gray-500">proxy-from-product · 不重生成 Avatar</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {outfitOptions.map((outfit) => {
                      const active = selectedOutfit?.id === outfit.id;
                      return (
                        <button
                          key={outfit.id}
                          type="button"
                          className={`overflow-hidden rounded-xl border text-left transition-all ${active ? 'border-pink-400 bg-pink-500/15' : 'border-white/10 bg-white/5'}`}
                          onClick={() => setSelectedOutfitId(outfit.id)}
                        >
                          <img src={outfit.previewImage} alt={outfit.name} className="h-24 w-full object-cover" />
                          <div className="p-2">
                            <p className="truncate text-[11px] font-semibold text-white">{outfit.brand}</p>
                            <p className="truncate text-[10px] text-gray-400">{outfit.name}</p>
                            <p className="mt-1 text-[9px] text-pink-300">{outfit.category} · {outfit.fittingMode}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {stylizedAvatar && (
                <p className="text-center text-xs text-gray-500 mb-4">
                  method: {stylizedAvatar.method} · rig: {stylizedAvatar.rig.format} · style: {stylizedAvatar.appearance.style.id}
                </p>
              )}
              <div className="sticky bottom-4 z-30 flex gap-3 rounded-2xl bg-gray-950/92 py-3 backdrop-blur">
                <button className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 text-sm" onClick={() => downloadBodyModelManifest(manifest)}>下载任务文件</button>
                <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold" onClick={() => navigate('/')}>回到首页</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, optional }: { label: string; value: number | undefined; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}{optional && <span className="text-gray-600 ml-1">选填</span>}</label>
      <input
        type="number"
        inputMode="decimal"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-pink-500 focus:outline-none"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
