import { useMemo, useState } from 'react';
import type { AvatarExpressionName, AvatarOutfit, StylizedAvatar } from '@/types/avatarSystem';

type PoseName = 'idle' | 'confident' | 'wave' | 'share';

interface AnimeAvatarViewerProps {
  avatar: StylizedAvatar;
  outfit?: AvatarOutfit | null;
}

const EXPRESSIONS: AvatarExpressionName[] = ['neutral', 'smile', 'cool', 'surprised'];
const POSES: Array<{ id: PoseName; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'confident', label: 'Pose' },
  { id: 'wave', label: 'Wave' },
  { id: 'share', label: 'Share' },
];

function shade(hex: string, amount: number) {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = Math.min(255, Math.max(0, ((value >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((value >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (value & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function outfitPalette(outfit?: AvatarOutfit | null) {
  const base = outfit?.materialConfig.baseColor ?? '#f4f4ee';
  const secondary = outfit?.materialConfig.secondaryColor ?? '#ed7199';
  const trim = outfit?.materialConfig.trimColor ?? '#25232b';
  return { base, secondary, trim, shadow: shade(base, -34), light: shade(base, 28) };
}

function expressionClass(expression: AvatarExpressionName) {
  return `anime-expression-${expression}`;
}

function poseClass(pose: PoseName) {
  return `anime-pose-${pose}`;
}

export default function AnimeAvatarViewer({ avatar, outfit }: AnimeAvatarViewerProps) {
  const [pose, setPose] = useState<PoseName>('idle');
  const [expression, setExpression] = useState<AvatarExpressionName>('smile');
  const palette = useMemo(() => outfitPalette(outfit), [outfit]);
  const features = avatar.stylizedHead?.identityFeatures;
  const head = avatar.stylizedHead;
  const skin = features?.skinToneHex ?? avatar.appearance.style.palette.skin;
  const hair = features?.hairToneHex ?? avatar.appearance.style.palette.hair;
  const faceScale = features?.faceWidthRatio ? Math.min(1.1, Math.max(0.92, features.faceWidthRatio / 0.44)) : 1;
  const headHeight = features?.faceAspectRatio ? Math.min(1.08, Math.max(0.94, features.faceAspectRatio / 1.28)) : 1;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#17223a] shadow-2xl" style={{ aspectRatio: '3/4', minHeight: 430 }}>
      <style>{`
        .anime-stage {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 52% 18%, rgba(255,255,255,0.22), transparent 22%),
            linear-gradient(145deg, #203d6b 0%, #151a31 48%, #26152d 100%);
        }
        .anime-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.18) 0 1px, transparent 1px);
          background-size: 14px 14px;
          opacity: 0.22;
          mix-blend-mode: screen;
        }
        .anime-character {
          position: absolute;
          left: 50%;
          bottom: 7%;
          width: 72%;
          height: 83%;
          transform: translateX(-50%);
          filter: drop-shadow(0 24px 20px rgba(0,0,0,0.36));
          transition: transform 260ms ease;
        }
        .anime-character * {
          box-sizing: border-box;
        }
        .anime-outline {
          border: 4px solid #121018;
          box-shadow: inset -12px -14px 0 rgba(0,0,0,0.12), inset 8px 8px 0 rgba(255,255,255,0.22);
        }
        .anime-head {
          position: absolute;
          z-index: 8;
          left: 50%;
          top: 3%;
          width: calc(44% * var(--face-scale));
          height: calc(34% * var(--head-height));
          transform: translateX(-50%);
          border-radius: 48% 48% 46% 46%;
          background: var(--skin);
          overflow: hidden;
        }
        .anime-head::after {
          content: "";
          position: absolute;
          inset: 12% 8% auto;
          height: 42%;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.34), transparent);
          pointer-events: none;
        }
        .anime-face-filter {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.44;
          mix-blend-mode: soft-light;
          transform: none;
          filter: saturate(1.2) contrast(1.14) brightness(1.08);
        }
        .anime-hair {
          position: absolute;
          z-index: 9;
          left: 50%;
          top: -1%;
          width: 55%;
          height: 28%;
          transform: translateX(-50%);
          border-radius: 48% 48% 30% 30%;
          background: var(--hair);
          border: 4px solid #121018;
          clip-path: polygon(9% 45%, 17% 14%, 46% 0, 79% 8%, 94% 34%, 90% 78%, 72% 58%, 57% 79%, 42% 56%, 28% 82%, 17% 58%);
        }
        .anime-hair-back {
          position: absolute;
          z-index: 2;
          left: 50%;
          top: 8%;
          width: 62%;
          height: 38%;
          transform: translateX(-50%);
          border-radius: 48% 48% 42% 42%;
          background: var(--hair);
          border: 4px solid #121018;
          box-shadow: inset -18px -20px 0 rgba(0,0,0,0.18);
        }
        .anime-eye {
          position: absolute;
          z-index: 12;
          top: 43%;
          width: 17%;
          height: 13%;
          border-radius: 55%;
          background: #17141b;
          box-shadow: inset 4px 3px 0 rgba(255,255,255,0.9);
          transition: all 180ms ease;
        }
        .anime-eye.left { left: 27%; }
        .anime-eye.right { right: 27%; }
        .anime-brow {
          position: absolute;
          z-index: 12;
          top: 35%;
          width: 19%;
          height: 3.6%;
          border-radius: 999px;
          background: #3b2119;
          transition: all 180ms ease;
        }
        .anime-brow.left { left: 25%; transform: rotate(-8deg); }
        .anime-brow.right { right: 25%; transform: rotate(8deg); }
        .anime-nose {
          position: absolute;
          z-index: 12;
          left: 50%;
          top: 52%;
          width: 8%;
          height: 13%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: rgba(145,74,58,0.22);
        }
        .anime-mouth {
          position: absolute;
          z-index: 12;
          left: 50%;
          top: 69%;
          width: 24%;
          height: 4%;
          transform: translateX(-50%);
          border-radius: 0 0 999px 999px;
          background: #a64a62;
          transition: all 180ms ease;
        }
        .anime-cheek {
          position: absolute;
          z-index: 11;
          top: 62%;
          width: 17%;
          height: 8%;
          border-radius: 50%;
          background: rgba(237,113,153,0.22);
        }
        .anime-cheek.left { left: 18%; }
        .anime-cheek.right { right: 18%; }
        .anime-neck {
          position: absolute;
          z-index: 4;
          left: 50%;
          top: 33%;
          width: 15%;
          height: 12%;
          transform: translateX(-50%);
          border-radius: 35%;
          background: var(--skin);
          border: 4px solid #121018;
        }
        .anime-body {
          position: absolute;
          z-index: 5;
          left: 50%;
          top: 39%;
          width: 42%;
          height: 32%;
          transform: translateX(-50%);
          border-radius: 36% 36% 28% 28%;
          background: linear-gradient(135deg, var(--garment-light), var(--garment) 58%, var(--garment-shadow));
          clip-path: polygon(21% 0, 79% 0, 96% 86%, 50% 100%, 4% 86%);
        }
        .anime-collar {
          position: absolute;
          z-index: 7;
          left: 50%;
          top: 39%;
          width: 24%;
          height: 9%;
          transform: translateX(-50%);
          background: var(--trim);
          border: 4px solid #121018;
          clip-path: polygon(0 0, 50% 100%, 100% 0, 76% 0, 50% 42%, 24% 0);
        }
        .anime-arm {
          position: absolute;
          z-index: 4;
          top: 43%;
          width: 13%;
          height: 33%;
          border-radius: 999px;
          background: var(--skin);
          transform-origin: 50% 8%;
        }
        .anime-arm::before {
          content: "";
          position: absolute;
          inset: 0 0 42%;
          border-radius: 999px;
          background: var(--garment);
          border-bottom: 4px solid #121018;
        }
        .anime-arm.left { left: 16%; transform: rotate(12deg); }
        .anime-arm.right { right: 16%; transform: rotate(-12deg); }
        .anime-hand {
          position: absolute;
          left: 50%;
          bottom: -7%;
          width: 120%;
          height: 18%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: var(--skin);
          border: 4px solid #121018;
        }
        .anime-skirt {
          position: absolute;
          z-index: 6;
          left: 50%;
          top: 65%;
          width: 49%;
          height: 18%;
          transform: translateX(-50%);
          border-radius: 16% 16% 42% 42%;
          background: linear-gradient(160deg, var(--garment-2), var(--trim));
          clip-path: polygon(12% 0, 88% 0, 100% 100%, 0 100%);
        }
        .anime-leg {
          position: absolute;
          z-index: 3;
          top: 78%;
          width: 12%;
          height: 20%;
          border-radius: 999px;
          background: var(--skin);
        }
        .anime-leg.left { left: 38%; transform: rotate(3deg); }
        .anime-leg.right { right: 38%; transform: rotate(-3deg); }
        .anime-shoe {
          position: absolute;
          bottom: -8%;
          width: 150%;
          height: 22%;
          border-radius: 999px 999px 40% 40%;
          background: #17141b;
          border: 4px solid #121018;
        }
        .anime-leg.left .anime-shoe { right: -10%; }
        .anime-leg.right .anime-shoe { left: -10%; }
        .anime-expression-smile .anime-eye { height: 9%; top: 44%; }
        .anime-expression-smile .anime-mouth { width: 34%; height: 8%; border-radius: 0 0 999px 999px; }
        .anime-expression-cool .anime-eye { height: 7%; top: 45%; }
        .anime-expression-cool .anime-brow.left { transform: rotate(-18deg); top: 34%; }
        .anime-expression-cool .anime-brow.right { transform: rotate(18deg); top: 34%; }
        .anime-expression-cool .anime-mouth { width: 18%; height: 3%; }
        .anime-expression-surprised .anime-eye { height: 18%; width: 18%; top: 41%; }
        .anime-expression-surprised .anime-mouth { width: 13%; height: 12%; border-radius: 50%; }
        .anime-expression-surprised .anime-brow { top: 31%; }
        .anime-pose-confident { transform: translateX(-50%) rotate(-2deg); }
        .anime-pose-confident .anime-arm.left { transform: rotate(54deg); }
        .anime-pose-confident .anime-arm.right { transform: rotate(-42deg); }
        .anime-pose-wave .anime-arm.right { transform: rotate(-132deg); top: 36%; }
        .anime-pose-wave .anime-arm.left { transform: rotate(20deg); }
        .anime-pose-share { transform: translateX(-50%) rotate(2deg) scale(1.02); }
        .anime-pose-share .anime-arm.left { transform: rotate(82deg); top: 41%; }
        .anime-pose-share .anime-arm.right { transform: rotate(-82deg); top: 41%; }
        .anime-halftone {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.18) 0 1px, transparent 1.2px);
          background-size: 9px 9px;
          mix-blend-mode: screen;
          pointer-events: none;
          opacity: 0.28;
        }
      `}</style>

      <div className="anime-stage" />
      <div
        className={`anime-character ${poseClass(pose)} ${expressionClass(expression)}`}
        style={{
          ['--skin' as string]: skin,
          ['--hair' as string]: hair,
          ['--garment' as string]: palette.base,
          ['--garment-2' as string]: palette.secondary,
          ['--garment-shadow' as string]: palette.shadow,
          ['--garment-light' as string]: palette.light,
          ['--trim' as string]: palette.trim,
          ['--face-scale' as string]: faceScale,
          ['--head-height' as string]: headHeight,
        }}
      >
        <div className="anime-hair-back" />
        <div className="anime-neck" />
        <div className="anime-arm left anime-outline"><div className="anime-hand" /></div>
        <div className="anime-arm right anime-outline"><div className="anime-hand" /></div>
        <div className="anime-body anime-outline" />
        <div className="anime-collar" />
        <div className="anime-skirt anime-outline" />
        <div className="anime-leg left anime-outline"><div className="anime-shoe" /></div>
        <div className="anime-leg right anime-outline"><div className="anime-shoe" /></div>
        <div className="anime-head anime-outline">
          {head?.previewDataUrl && <img className="anime-face-filter" src={head.previewDataUrl} alt="" />}
          <div className="anime-eye left" />
          <div className="anime-eye right" />
          <div className="anime-brow left" />
          <div className="anime-brow right" />
          <div className="anime-nose" />
          <div className="anime-mouth" />
          <div className="anime-cheek left" />
          <div className="anime-cheek right" />
        </div>
        <div className="anime-hair" />
      </div>
      <div className="anime-halftone" />

      <div className="absolute left-3 right-3 top-3 z-20 grid grid-cols-4 gap-1.5">
        {POSES.map((item) => (
          <button
            key={item.id}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold backdrop-blur ${pose === item.id ? 'bg-pink-500 text-white' : 'bg-black/45 text-white/80'}`}
            onClick={() => setPose(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="absolute left-3 right-3 top-14 z-20 grid grid-cols-4 gap-1.5">
        {EXPRESSIONS.map((item) => (
          <button
            key={item}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold backdrop-blur ${expression === item ? 'bg-pink-500 text-white' : 'bg-black/45 text-white/80'}`}
            onClick={() => setExpression(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between gap-3">
        <div className="rounded-xl bg-black/48 px-3 py-2 text-[10px] text-white/70 backdrop-blur">
          full anime character · no face-plane GLB
          <span className="block text-white/45">{head?.providerStage ?? 'style-only'} · {Math.round((head?.confidence ?? 0.62) * 100)}%</span>
        </div>
        {outfit && (
          <div className="max-w-[48%] rounded-xl bg-black/55 px-3 py-2 text-right text-[11px] text-white/85 backdrop-blur">
            {outfit.name}
            <span className="block text-white/45">{outfit.brand}</span>
          </div>
        )}
      </div>
    </div>
  );
}
