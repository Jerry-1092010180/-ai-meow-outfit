import { Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';
import ProceduralAvatar from '@/components/outfit/ProceduralAvatar';
import type { AvatarOutfit } from '@/components/outfit/ProceduralAvatar';

// ── 错误边界 ──
class E3D extends Component<{ children: ReactNode }, { err: boolean; msg: string }> {
  state = { err: false, msg: '' };
  static getDerivedStateFromError(e: Error) {
    return { err: true, msg: e.message };
  }
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
      <planeGeometry args={[12, 12]} />
      <shadowMaterial transparent opacity={0.12} />
    </mesh>
  );
}

// ── VS 标签 ──
function VSLabel() {
  return (
    <Text
      position={[0, 0.5, 0]}
      fontSize={0.5}
      color="#FF6B8A"
      anchorX="center"
      anchorY="middle"
      font="/fonts/NotoSansSC-Bold.woff2"
      outlineColor="#000000"
      outlineWidth={0.05}
    >
      VS
    </Text>
  );
}

// ── 聚光灯 ──
function SpotLight({ position, color }: { position: [number, number, number]; color: string }) {
  return <spotLight position={position} angle={0.5} penumbra={0.5} intensity={2} color={color} castShadow />;
}

// ── 主组件 ──

interface DualAvatar3DProps {
  leftOutfit: AvatarOutfit;
  rightOutfit: AvatarOutfit;
  leftName: string;
  rightName: string;
  leftVotes?: number;
  rightVotes?: number;
  theme?: string;
}

export default function DualAvatar3D({
  leftOutfit,
  rightOutfit,
  leftName,
  rightName,
  leftVotes = 0,
  rightVotes = 0,
  theme = 'PK挑战',
}: DualAvatar3DProps) {
  const totalVotes = leftVotes + rightVotes || 1;
  const leftPct = Math.round((leftVotes / totalVotes) * 100);
  const rightPct = Math.round((rightVotes / totalVotes) * 100);

  return (
    <div className="relative">
      {/* 3D 画布 */}
      <div
        className="relative w-full rounded-3xl overflow-hidden bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 shadow-2xl"
        style={{ aspectRatio: '16/10', minHeight: 400 }}
      >
        <E3D>
          <Canvas
            camera={{ position: [0, 0.3, 4.2], fov: 38 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
            shadows
            dpr={[1, 1.5]}
          >
            {/* 灯光 */}
            <ambientLight intensity={0.45} />
            <directionalLight position={[5, 8, 5]} intensity={1} castShadow
              shadow-mapSize-width={512} shadow-mapSize-height={512} />
            <SpotLight position={[-2, 3, 3]} color="#FFB8C6" />
            <SpotLight position={[2, 3, 3]} color="#87CEEB" />
            <pointLight position={[0, 2, 3]} intensity={0.6} color="#FFFFFF" />

            {/* 地面 */}
            <Floor />
            <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={8} blur={2} far={2} />

            {/* 左侧人物 — Team A */}
            <ProceduralAvatar
              outfit={leftOutfit}
              position={[-0.65, 0, 0]}
              scale={0.85}
            />

            {/* 右侧人物 — Team B */}
            <ProceduralAvatar
              outfit={rightOutfit}
              position={[0.65, 0, 0]}
              scale={0.85}
            />

            {/* VS 文字（纯3D几何体，不依赖字体文件） */}
            <VSGeometry />

            {/* 控制 */}
            <OrbitControls
              enablePan={false}
              minDistance={2.5}
              maxDistance={7}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 2.2}
              target={[0, -0.1, 0]}
              enableDamping
              dampingFactor={0.08}
              autoRotate
              autoRotateSpeed={0.4}
            />
          </Canvas>
        </E3D>

        {/* 提示 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none bg-black/40 backdrop-blur px-3 py-1 rounded-full select-none">
          拖拽旋转 · 滚轮缩放
        </div>
      </div>

      {/* 信息栏 */}
      <div className="mt-4 grid grid-cols-3 gap-3 items-end">
        {/* 左侧选手 */}
        <div className="text-center">
          <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{ backgroundColor: leftOutfit.topColor }} />
          <p className="text-sm font-bold text-white">{leftName}</p>
          <p className="text-2xl font-black text-pink-400">{leftVotes}</p>
          <p className="text-[10px] text-gray-500">票</p>
        </div>

        {/* VS 中间 */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">{theme}</div>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-white font-black text-lg shadow-lg">
            VS
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden flex">
            <div
              className="h-full bg-pink-500 transition-all"
              style={{ width: `${leftPct}%` }}
            />
            <div
              className="h-full bg-blue-400 transition-all"
              style={{ width: `${rightPct}%` }}
            />
          </div>
        </div>

        {/* 右侧选手 */}
        <div className="text-center">
          <div className="w-4 h-4 rounded-full mx-auto mb-1" style={{ backgroundColor: rightOutfit.topColor }} />
          <p className="text-sm font-bold text-white">{rightName}</p>
          <p className="text-2xl font-black text-blue-400">{rightVotes}</p>
          <p className="text-[10px] text-gray-500">票</p>
        </div>
      </div>
    </div>
  );
}

// ── 3D VS 几何体（不依赖外部字体） ──
function VSGeometry() {
  return (
    <group position={[0, 0.55, 0]}>
      {/* V 字 — 两根倾斜的柱子 */}
      <mesh position={[-0.12, 0, 0]} rotation={[0, 0, 0.35]} castShadow>
        <boxGeometry args={[0.06, 0.25, 0.06]} />
        <meshStandardMaterial color="#FF6B8A" roughness={0.3} metalness={0.5} emissive="#FF6B8A" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.12, 0, 0]} rotation={[0, 0, -0.35]} castShadow>
        <boxGeometry args={[0.06, 0.25, 0.06]} />
        <meshStandardMaterial color="#FF6B8A" roughness={0.3} metalness={0.5} emissive="#FF6B8A" emissiveIntensity={0.5} />
      </mesh>
      {/* S 字 — 三个横条 */}
      {[[0, 0.12], [0, 0], [0, -0.12]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[0.18, 0.04, 0.04]} />
          <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.5} emissive="#FFD700" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}
