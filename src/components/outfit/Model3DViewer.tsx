import { useState, useEffect, Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import { ContactShadows } from '@react-three/drei/core/ContactShadows.js';
import * as THREE from 'three';
import ProceduralAvatar from './ProceduralAvatar';
import type { BodyMeasurements } from '@/types/bodyModel';

// ── 穿搭定义 ──
interface OutfitDef {
  id: string;
  name: string;
  description: string;
  topColor: string;
  bottomColor: string;
  shoeColor: string;
}

const OUTFITS: OutfitDef[] = [
  { id: 'casual', name: '休闲套装', description: '白T恤 + 牛仔裤', topColor: '#F5F5F5', bottomColor: '#4A7AB5', shoeColor: '#EEE' },
  { id: 'formal', name: '通勤西装', description: '小西装 + 西裤', topColor: '#1A1A1A', bottomColor: '#2D2D2D', shoeColor: '#1A1A1A' },
  { id: 'dress', name: '连衣裙', description: '碎花裙 + 凉鞋', topColor: '#FF6B8A', bottomColor: '#FFB8C6', shoeColor: '#FFD700' },
  { id: 'sporty', name: '运动套装', description: '卫衣 + 运动裤', topColor: '#FF5722', bottomColor: '#212121', shoeColor: '#FF9800' },
  { id: 'elegant', name: '优雅长裙', description: '香槟长裙 + 高跟', topColor: '#C9A96E', bottomColor: '#F5E6CA', shoeColor: '#C9A96E' },
];

// ── 错误边界 ──
class ErrorBoundary extends Component<{ children: ReactNode }, { err: boolean; msg: string }> {
  state = { err: false, msg: '' };
  static getDerivedStateFromError(e: Error) { return { err: true, msg: e.message }; }
  render() {
    if (this.state.err) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-gray-900 rounded-3xl">
          <div className="text-center px-6">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-white/70 text-sm">3D 渲染失败</p>
            <p className="text-white/30 text-xs mt-1">{this.state.msg.slice(0, 60)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 地面 ──
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} receiveShadow>
      <planeGeometry args={[8, 8]} />
      <shadowMaterial transparent opacity={0.12} />
    </mesh>
  );
}

// ── 主组件 ──
interface Model3DViewerProps {
  outfitId?: string;
  onOutfitChange?: (outfit: OutfitDef) => void;
  bodyModel?: BodyMeasurements;
}

export default function Model3DViewer({
  outfitId = 'casual',
  onOutfitChange,
  bodyModel,
}: Model3DViewerProps) {
  const [selectedId, setSelectedId] = useState(outfitId);
  useEffect(() => setSelectedId(outfitId), [outfitId]);
  const current = OUTFITS.find((o) => o.id === selectedId) || OUTFITS[0];

  return (
    <div className="relative">
      <div
        className="relative w-full rounded-3xl overflow-hidden bg-gray-900 shadow-2xl"
        style={{ aspectRatio: '3/4', minHeight: 480 }}
      >
        <ErrorBoundary>
          <Canvas
            camera={{ position: [0, 0.3, 2.8], fov: 40 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
            shadows
            dpr={[1, 1.5]}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
            <directionalLight position={[-3, 3, -3]} intensity={0.6} color="#FFB8C6" />
            <pointLight position={[0, 2, 3]} intensity={0.8} color="#FF6B8A" />

            <group position={[0, 0.1, 0]}>
              <ProceduralAvatar
                outfit={{
                  topColor: current.topColor,
                  bottomColor: current.bottomColor,
                  shoeColor: current.shoeColor,
                  bodyType: bodyModel?.bodyType,
                  heightCm: bodyModel?.heightCm,
                  weightKg: bodyModel?.weightKg,
                }}
              />
            </group>
            <Floor />
            <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={5} blur={2} far={2} />

            <OrbitControls
              enablePan={false}
              minDistance={2} maxDistance={5.5}
              minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 1.8}
              target={[0, -0.1, 0]}
              enableDamping dampingFactor={0.08}
              autoRotate autoRotateSpeed={0.6}
            />
          </Canvas>
        </ErrorBoundary>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none bg-black/40 backdrop-blur px-3 py-1 rounded-full select-none">
          拖拽旋转 · 滚轮缩放
        </div>
      </div>

      {/* 换装选择器 */}
      <div className="mt-4 px-1">
        <h3 className="text-sm font-medium text-gray-400 mb-3">👗 切换穿搭</h3>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {OUTFITS.map((o) => (
            <button
              key={o.id}
              className={`flex-shrink-0 px-3 py-3 rounded-xl text-left transition-all min-w-[100px] ${
                selectedId === o.id
                  ? 'bg-pink-500 text-white shadow-lg scale-105'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
              }`}
              onClick={() => { setSelectedId(o.id); onOutfitChange?.(o); }}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: o.topColor }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: o.bottomColor }} />
                <div className="w-2 h-3 rounded-full" style={{ backgroundColor: o.shoeColor }} />
              </div>
              <p className="text-sm font-bold">{o.name}</p>
              <p className="text-[10px] opacity-70">{o.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { OUTFITS, type OutfitDef };
