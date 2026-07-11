import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Model3DViewer, { OUTFITS } from '@/components/outfit/Model3DViewer';
import {
  createBodyModelManifest,
  downloadBodyModelManifest,
} from '@/services/bodyModelService';
import type {
  BodyMeasurements,
  BodyModelManifest,
  CaptureAngle,
  CaptureFrame,
} from '@/types/bodyModel';
import type { BodyType, SharePlatform } from '@/types';

type TryOnStep = 'measure' | 'setup' | 'capture' | 'processing' | 'result';
type NumericMeasurementKey = Exclude<keyof BodyMeasurements, 'bodyType'>;
type OptionalMeasurementKey = Exclude<
  NumericMeasurementKey,
  'heightCm' | 'weightKg'
>;

const CAPTURE_ANGLES: CaptureAngle[] = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
];

const BODY_TYPES: { value: BodyType; label: string; hint: string }[] = [
  { value: 'hourglass', label: 'X型', hint: '肩胯接近，腰线明显' },
  { value: 'pear', label: '梨形', hint: '胯部更有存在感' },
  { value: 'apple', label: '苹果', hint: '上身和腰腹更饱满' },
  { value: 'rectangle', label: 'H型', hint: '肩腰胯线条较直' },
  { value: 'inverted_triangle', label: '倒三角', hint: '肩部更宽' },
];

const INITIAL_MEASUREMENTS: BodyMeasurements = {
  heightCm: 168,
  weightKg: 55,
  bodyType: 'hourglass',
};

const OPTIONAL_MEASUREMENT_FIELDS: {
  key: OptionalMeasurementKey;
  label: string;
}[] = [
  { key: 'shoulderCm', label: '肩宽 cm' },
  { key: 'bustCm', label: '胸围 cm' },
  { key: 'waistCm', label: '腰围 cm' },
  { key: 'hipCm', label: '臀围 cm' },
  { key: 'inseamCm', label: '内长 cm' },
];

function numberValue(value: string) {
  return value === '' ? undefined : Number(value);
}

function makeDemoFrame(angle: CaptureAngle) {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 360, 480);
    gradient.addColorStop(0, '#111827');
    gradient.addColorStop(1, '#4c1d95');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 360, 480);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(80, 48, 200, 360);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${angle}deg`, 180, 230);
    ctx.font = '16px sans-serif';
    ctx.fillText('guided capture frame', 180, 260);
  }

  return canvas.toDataURL('image/webp', 0.72);
}

export default function TryOnPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<TryOnStep>('measure');
  const [measurements, setMeasurements] =
    useState<BodyMeasurements>(INITIAL_MEASUREMENTS);
  const [captureFrames, setCaptureFrames] = useState<CaptureFrame[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [modelManifest, setModelManifest] =
    useState<BodyModelManifest | null>(null);
  const [currentOutfitName, setCurrentOutfitName] = useState(OUTFITS[0].name);

  const currentAngle = CAPTURE_ANGLES[captureFrames.length] ?? 330;
  const progress = Math.round((captureFrames.length / CAPTURE_ANGLES.length) * 100);
  const canUseMeasurements =
    measurements.heightCm >= 120 &&
    measurements.heightCm <= 220 &&
    measurements.weightKg >= 30 &&
    measurements.weightKg <= 180;

  const bodyTypeCopy = useMemo(
    () => BODY_TYPES.find((item) => item.value === measurements.bodyType),
    [measurements.bodyType]
  );

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const updateMeasurement =
    (key: NumericMeasurementKey) => (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = numberValue(event.target.value);
      setMeasurements((current) => ({
        ...current,
        [key]: key === 'heightCm' || key === 'weightKg' ? parsed ?? 0 : parsed,
      }));
    };

  const startCamera = async () => {
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('当前浏览器不支持相机调用，可以先使用演示帧跑通流程。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
    } catch {
      setCameraError('没有拿到相机权限。你仍然可以用演示帧生成建模任务。');
    }
  };

  const captureCurrentFrame = () => {
    const angle = CAPTURE_ANGLES[captureFrames.length];
    if (angle === undefined) return;

    const video = videoRef.current;
    let imageDataUrl = makeDemoFrame(angle);
    let qualityScore = cameraReady ? 92 : 76;

    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const sourceRatio = video.videoWidth / video.videoHeight;
        const targetRatio = canvas.width / canvas.height;
        let sx = 0;
        let sy = 0;
        let sw = video.videoWidth;
        let sh = video.videoHeight;

        if (sourceRatio > targetRatio) {
          sw = video.videoHeight * targetRatio;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = video.videoWidth / targetRatio;
          sy = (video.videoHeight - sh) / 2;
        }

        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        imageDataUrl = canvas.toDataURL('image/webp', 0.78);
        qualityScore = 88 + Math.round(Math.random() * 8);
      }
    }

    setCaptureFrames((frames) => [
      ...frames,
      {
        angle,
        imageDataUrl,
        capturedAt: new Date().toISOString(),
        qualityScore,
      },
    ]);
  };

  const buildModel = () => {
    setStep('processing');
    const request = {
      measurements,
      captureFrames,
      captureMode: 'guided-360-phone-stand' as const,
      deviceHint: navigator.userAgent,
      createdAt: new Date().toISOString(),
    };

    window.setTimeout(() => {
      setModelManifest(createBodyModelManifest(request));
      setStep('result');
    }, 1500);
  };

  const handleShare = async (_platform: SharePlatform) => {
    if (navigator.share) {
      await navigator.share({
        title: `AI喵搭 - ${currentOutfitName}`,
        text: `我用 360 度采集生成了 AI 数字分身，正在试穿 ${currentOutfitName}`,
        url: window.location.href,
      });
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    window.alert('链接已复制');
  };

  const resetCapture = () => {
    setCaptureFrames([]);
    setModelManifest(null);
    setStep('measure');
  };

  return (
    <div className="min-h-screen pb-24 safe-top safe-bottom bg-[#08111f] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#08111f]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-sm text-white/60" onClick={() => navigate(-1)}>
            ← 返回
          </button>
          <div className="text-center">
            <h1 className="text-base font-bold">真人 3D 建模试穿</h1>
            <p className="text-[11px] text-white/40">银泰 App 穿搭数字分身</p>
          </div>
          <button className="text-sm font-medium text-pink-300" onClick={resetCapture}>
            重来
          </button>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="mb-4 grid grid-cols-4 gap-2 text-[11px] text-white/50">
          {[
            ['measure', '纸面数据'],
            ['setup', '手机架设'],
            ['capture', '360采集'],
            ['result', '建模文件'],
          ].map(([key, label], index) => (
            <div key={key} className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${
                  ['measure', 'setup', 'capture', 'processing', 'result'].indexOf(step) >=
                  index
                    ? 'bg-pink-400'
                    : 'bg-white/10'
                }`}
              />
              <p>{label}</p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'measure' && (
            <motion.section
              key="measure"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div>
                <p className="text-sm text-pink-200">第一步</p>
                <h2 className="mt-1 text-2xl font-bold">先把纸面身体数据填准</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  身高、体重和身材类型会先生成基础骨架，肩宽、腰围、臀围等可选数据会让后续真人建模更贴近本人。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="text-xs text-white/45">身高 cm</span>
                  <input
                    className="mt-2 w-full bg-transparent text-2xl font-bold outline-none"
                    type="number"
                    min="120"
                    max="220"
                    value={measurements.heightCm ?? ''}
                    onChange={updateMeasurement('heightCm')}
                  />
                </label>
                <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="text-xs text-white/45">体重 kg</span>
                  <input
                    className="mt-2 w-full bg-transparent text-2xl font-bold outline-none"
                    type="number"
                    min="30"
                    max="180"
                    value={measurements.weightKg ?? ''}
                    onChange={updateMeasurement('weightKg')}
                  />
                </label>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-white/70">身材类型</p>
                <div className="grid grid-cols-2 gap-2">
                  {BODY_TYPES.map((item) => (
                    <button
                      key={item.value}
                      className={`rounded-2xl border p-3 text-left transition ${
                        measurements.bodyType === item.value
                          ? 'border-pink-300 bg-pink-400/18 text-white'
                          : 'border-white/10 bg-white/[0.04] text-white/65'
                      }`}
                      onClick={() =>
                        setMeasurements((current) => ({
                          ...current,
                          bodyType: item.value,
                        }))
                      }
                    >
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className="mt-1 block text-[11px] leading-4 opacity-65">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {OPTIONAL_MEASUREMENT_FIELDS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <span className="text-xs text-white/45">{label}</span>
                    <input
                      className="mt-2 w-full bg-transparent text-lg font-semibold outline-none"
                      type="number"
                      min="20"
                      max="180"
                      placeholder="可选"
                      value={measurements[key] ?? ''}
                      onChange={updateMeasurement(key)}
                    />
                  </label>
                ))}
              </div>

              <button
                className="w-full rounded-2xl bg-pink-400 py-4 text-sm font-bold text-[#08111f] disabled:bg-white/10 disabled:text-white/35"
                disabled={!canUseMeasurements}
                onClick={() => setStep('setup')}
              >
                下一步：架好手机
              </button>
            </motion.section>
          )}

          {step === 'setup' && (
            <motion.section
              key="setup"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div>
                <p className="text-sm text-pink-200">第二步</p>
                <h2 className="mt-1 text-2xl font-bold">手机立在桌面，身体完整入镜</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  建议距离手机 1.5 到 2 米，光线从正前方来。转身时保持站姿自然，慢慢完成一圈。
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  ['1', '手机竖屏固定', '靠墙或支架放稳，镜头高度尽量接近腰胸之间。'],
                  ['2', '穿贴身但不紧绷的衣服', '避免宽大外套遮挡肩线、腰线和腿部轮廓。'],
                  ['3', '按 30 度一步转身', '每次听到提示或看到角度后停一下，采集 12 帧。'],
                ].map(([index, title, desc]) => (
                  <div
                    key={title}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-400 text-sm font-bold text-[#08111f]">
                      {index}
                    </div>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm leading-5 text-white/50">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 text-sm font-semibold text-white"
                onClick={startCamera}
              >
                {cameraReady ? '相机已就绪' : '打开相机预览'}
              </button>
              {cameraError && (
                <p className="rounded-2xl bg-amber-400/12 p-3 text-sm leading-5 text-amber-100">
                  {cameraError}
                </p>
              )}

              <button
                className="w-full rounded-2xl bg-pink-400 py-4 text-sm font-bold text-[#08111f]"
                onClick={() => setStep('capture')}
              >
                开始 360 度采集
              </button>
            </motion.section>
          )}

          {step === 'capture' && (
            <motion.section
              key="capture"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black">
                <video
                  ref={videoRef}
                  className="h-[520px] w-full object-cover"
                  playsInline
                  muted
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#101827] text-center">
                    <div className="text-5xl font-black text-white/10">
                      {currentAngle}°
                    </div>
                    <p className="mt-3 max-w-[240px] text-sm leading-6 text-white/55">
                      未开启相机时会生成演示帧，方便先跑通建模任务流程。
                    </p>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-8 top-10 h-[380px] rounded-[48%] border-2 border-dashed border-pink-200/65" />
                <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-sm font-bold">
                  当前角度 {currentAngle}°
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="h-2 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-pink-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-white/65">
                    已采集 {captureFrames.length}/{CAPTURE_ANGLES.length} 帧
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {CAPTURE_ANGLES.map((angle) => {
                  const done = captureFrames.some((frame) => frame.angle === angle);
                  return (
                    <div
                      key={angle}
                      className={`rounded-full py-1 text-center text-[11px] ${
                        done ? 'bg-pink-300 text-[#08111f]' : 'bg-white/8 text-white/40'
                      }`}
                    >
                      {angle}°
                    </div>
                  );
                })}
              </div>

              {captureFrames.length < CAPTURE_ANGLES.length ? (
                <button
                  className="w-full rounded-2xl bg-pink-400 py-4 text-sm font-bold text-[#08111f]"
                  onClick={captureCurrentFrame}
                >
                  采集当前角度，继续慢慢转身
                </button>
              ) : (
                <button
                  className="w-full rounded-2xl bg-emerald-300 py-4 text-sm font-bold text-[#08111f]"
                  onClick={buildModel}
                >
                  生成真人 3D 建模任务
                </button>
              )}
            </motion.section>
          )}

          {step === 'processing' && (
            <motion.section
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[560px] flex-col items-center justify-center text-center"
            >
              <motion.div
                className="mb-6 h-20 w-20 rounded-full border-4 border-pink-200/20 border-t-pink-300"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              />
              <h2 className="text-xl font-bold">正在生成建模文件</h2>
              <p className="mt-3 max-w-xs text-sm leading-6 text-white/50">
                正在整理纸面数据、多角度帧和试穿预览参数，生成可提交给后端真人重建服务的 manifest。
              </p>
            </motion.section>
          )}

          {step === 'result' && modelManifest && (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              <div className="rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-4">
                <p className="text-sm text-emerald-100">建模任务已生成</p>
                <h2 className="mt-1 text-xl font-bold">{modelManifest.output.fileName}</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  质量评分 {modelManifest.qualityScore}/100，已整理 {modelManifest.captureFrameCount}
                  帧 360 度采集数据。后端接入后可把这些数据转换成真人 GLB 模型。
                </p>
              </div>

              <Model3DViewer
                outfitId="casual"
                bodyModel={measurements}
                onOutfitChange={(outfit) => setCurrentOutfitName(outfit.name)}
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  className="rounded-2xl bg-white py-3 text-sm font-bold text-[#08111f]"
                  onClick={() => downloadBodyModelManifest(modelManifest)}
                >
                  下载建模 manifest
                </button>
                <button
                  className="rounded-2xl border border-white/10 bg-white/[0.06] py-3 text-sm font-bold text-white"
                  onClick={() => handleShare('copy_link')}
                >
                  分享试穿结果
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold">当前数字分身参数</p>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {measurements.heightCm}cm / {measurements.weightKg}kg /{' '}
                  {bodyTypeCopy?.label}。银泰 App 后续可以用同一个 manifest ID
                  绑定门店穿搭推荐、3D 试穿和会员资产。
                </p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
