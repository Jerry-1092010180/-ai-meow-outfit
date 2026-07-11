import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUserStore } from '@/stores/useUserStore';
import type { BodyType, ColorPreference } from '@/types';

/** 肤色映射 */
export const SKIN_TONES: Record<ColorPreference, string> = {
  warm: '#FDDCB5', cool: '#FDEBD0', neutral: '#F5D5B8',
  monochrome: '#E8C9A0', vibrant: '#FFDAB9',
};

/** 身型参数 */
export const BODY_PARAMS: Record<BodyType, { torsoW: number; hipW: number; shoulderOff: number }> = {
  hourglass: { torsoW: 0.33, hipW: 0.32, shoulderOff: 0.39 },
  pear: { torsoW: 0.3, hipW: 0.34, shoulderOff: 0.37 },
  apple: { torsoW: 0.36, hipW: 0.28, shoulderOff: 0.38 },
  rectangle: { torsoW: 0.31, hipW: 0.3, shoulderOff: 0.38 },
  inverted_triangle: { torsoW: 0.34, hipW: 0.27, shoulderOff: 0.41 },
};

export interface AvatarOutfit {
  topColor: string;
  bottomColor: string;
  shoeColor: string;
  skinTone?: string | ColorPreference;
  bodyType?: BodyType;
  heightCm?: number;
  weightKg?: number;
}

interface ProceduralAvatarProps {
  outfit: AvatarOutfit;
  position?: [number, number, number];
  scale?: number;
  animate?: boolean;
}

/** 可复用的程序化3D人体模型 */
export default function ProceduralAvatar({
  outfit,
  position = [0, 0, 0],
  scale = 1,
  animate = true,
}: ProceduralAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const profile = useUserStore((s) => s.profile);

  const bodyType = outfit.bodyType || profile?.bodyType || 'hourglass';
  const rawSkin = outfit.skinTone;
  const skin = rawSkin
    ? (SKIN_TONES[rawSkin as ColorPreference] || rawSkin)
    : SKIN_TONES[profile?.colorPreferences?.[0] || 'warm'];
  const hair = '#3D2B1F';
  const bp = BODY_PARAMS[bodyType] || BODY_PARAMS.hourglass;
  const heightScale = outfit.heightCm ? outfit.heightCm / 168 : 1;
  const weightScale = outfit.weightKg ? Math.sqrt(outfit.weightKg / 58) : 1;
  const avatarScale = scale * Math.min(Math.max(heightScale, 0.88), 1.12);
  const widthScale = Math.min(Math.max(weightScale, 0.88), 1.14);

  useFrame(() => {
    if (groupRef.current && animate) {
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.0012) * 0.015;
    }
  });

  const s = avatarScale;
  const {
    torsoW,
    hipW,
    shoulderOff,
  } = {
    torsoW: bp.torsoW * widthScale,
    hipW: bp.hipW * widthScale,
    shoulderOff: bp.shoulderOff * Math.min(Math.max(widthScale, 0.94), 1.08),
  };

  return (
    <group ref={groupRef} position={position}>
      {/* 头部 */}
      <mesh position={[0, 0.85 * s, 0]} castShadow>
        <sphereGeometry args={[0.26 * s, 32, 32]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      {/* 头发 */}
      <mesh position={[0, 0.96 * s, 0.03 * s]} castShadow>
        <sphereGeometry args={[0.27 * s, 32, 32, 0, Math.PI * 2, 0, 1.2]} />
        <meshStandardMaterial color={hair} roughness={0.7} />
      </mesh>
      {/* 脖子 */}
      <mesh position={[0, 0.52 * s, 0]}>
        <cylinderGeometry args={[0.07 * s, 0.09 * s, 0.12 * s, 16]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      {/* 躯干 */}
      <mesh position={[0, 0.22 * s, 0]} castShadow>
        <capsuleGeometry args={[torsoW * s, 0.42 * s, 4, 16]} />
        <meshStandardMaterial color={outfit.topColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* 臀部 */}
      <mesh position={[0, -0.22 * s, 0]} castShadow>
        <capsuleGeometry args={[hipW * s, 0.3 * s, 4, 16]} />
        <meshStandardMaterial color={outfit.bottomColor} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* 双腿 */}
      <mesh position={[-0.12 * s, -0.72 * s, 0]} castShadow>
        <capsuleGeometry args={[0.13 * s, 0.46 * s, 4, 12]} />
        <meshStandardMaterial color={outfit.bottomColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.12 * s, -0.72 * s, 0]} castShadow>
        <capsuleGeometry args={[0.13 * s, 0.46 * s, 4, 12]} />
        <meshStandardMaterial color={outfit.bottomColor} roughness={0.5} />
      </mesh>
      {/* 双脚 */}
      <mesh position={[-0.12 * s, -1.12 * s, 0.06 * s]} castShadow>
        <boxGeometry args={[0.14 * s, 0.08 * s, 0.24 * s]} />
        <meshStandardMaterial color={outfit.shoeColor} roughness={0.4} />
      </mesh>
      <mesh position={[0.12 * s, -1.12 * s, 0.06 * s]} castShadow>
        <boxGeometry args={[0.14 * s, 0.08 * s, 0.24 * s]} />
        <meshStandardMaterial color={outfit.shoeColor} roughness={0.4} />
      </mesh>
      {/* 双臂 */}
      <mesh position={[-shoulderOff * s, 0.33 * s, 0]} rotation={[0, 0, 0.5]} castShadow>
        <capsuleGeometry args={[0.1 * s, 0.28 * s, 4, 12]} />
        <meshStandardMaterial color={outfit.topColor} roughness={0.55} />
      </mesh>
      <mesh position={[-(shoulderOff + 0.17) * s, 0.03 * s, 0]} rotation={[0, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.08 * s, 0.26 * s, 4, 12]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      <mesh position={[-(shoulderOff + 0.27) * s, -0.2 * s, 0]}>
        <sphereGeometry args={[0.07 * s, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      <mesh position={[shoulderOff * s, 0.33 * s, 0]} rotation={[0, 0, -0.5]} castShadow>
        <capsuleGeometry args={[0.1 * s, 0.28 * s, 4, 12]} />
        <meshStandardMaterial color={outfit.topColor} roughness={0.55} />
      </mesh>
      <mesh position={[(shoulderOff + 0.17) * s, 0.03 * s, 0]} rotation={[0, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.08 * s, 0.26 * s, 4, 12]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
      <mesh position={[(shoulderOff + 0.27) * s, -0.2 * s, 0]}>
        <sphereGeometry args={[0.07 * s, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.5} />
      </mesh>
    </group>
  );
}
