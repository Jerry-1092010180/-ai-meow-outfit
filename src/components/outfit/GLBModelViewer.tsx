import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import { ContactShadows } from '@react-three/drei/core/ContactShadows.js';
import { useGLTF } from '@react-three/drei/core/Gltf.js';
import { Center } from '@react-three/drei/core/Center.js';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarRenderStyle } from '@/types/avatarSystem';

interface GLBModelViewerProps {
  modelPath: string;
  fallbackPath?: string;
  renderStyle?: AvatarRenderStyle;
}

interface RigApi {
  playIdle: () => void;
  playConfident: () => void;
  rotateHead: () => void;
  raiseLeftArm: () => void;
  raiseRightArm: () => void;
}

interface RigState {
  bones: number;
  skinnedMeshes: number;
  animations: string[];
}

function toonifyMaterial(material: THREE.Material, style?: AvatarRenderStyle) {
  if (!style?.toonShading) return material;
  const source = material as THREE.MeshStandardMaterial;
  const toon = new THREE.MeshToonMaterial({
    color: source.color ?? new THREE.Color('#f4f4ee'),
    map: source.map ?? null,
    transparent: source.transparent,
    opacity: source.opacity,
  });
  toon.side = source.side;
  return toon;
}

function addOutline(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  const edges = new THREE.EdgesGeometry(geometry, 28);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: '#111014', transparent: true, opacity: 0.55 })
  );
  line.name = 'comic-outline';
  line.renderOrder = 10;
  mesh.add(line);
}

function Model({
  path,
  renderStyle,
  rigApiRef,
  onRigState,
}: {
  path: string;
  renderStyle?: AvatarRenderStyle;
  rigApiRef: MutableRefObject<RigApi | null>;
  onRigState: (state: RigState) => void;
}) {
  console.log('[GLB] Loading model:', path);
  const { scene, animations } = useGLTF(path);
  console.log('[GLB] Loaded successfully:', path, '- vertices:', scene.children.length);
  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);
  const bonesRef = useRef<Record<string, THREE.Bone>>({});

  useFrame((_, delta) => mixer.update(delta));

  useEffect(() => {
    const bones: Record<string, THREE.Bone> = {};
    let skinnedMeshes = 0;
    cloned.traverse((child) => {
      if (child instanceof THREE.Bone) bones[child.name] = child;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (Array.isArray(child.material)) child.material = child.material.map((m) => toonifyMaterial(m, renderStyle));
        else child.material = toonifyMaterial(child.material, renderStyle);
        if (renderStyle?.outline && !child.getObjectByName('comic-outline')) addOutline(child);
      }
      if (child instanceof THREE.SkinnedMesh) skinnedMeshes += 1;
    });
    bonesRef.current = bones;
    onRigState({ bones: Object.keys(bones).length, skinnedMeshes, animations: animations.map((clip) => clip.name) });

    const resetBones = () => {
      Object.values(bones).forEach((bone) => bone.rotation.set(0, 0, 0));
    };
    const playClip = (name: string) => {
      mixer.stopAllAction();
      resetBones();
      const clip = animations.find((item) => item.name === name);
      if (clip) mixer.clipAction(clip).reset().fadeIn(0.12).play();
    };
    rigApiRef.current = {
      playIdle: () => playClip('idle'),
      playConfident: () => playClip('confident-pose'),
      rotateHead: () => {
        mixer.stopAllAction();
        resetBones();
        if (bones.Head) bones.Head.rotation.y = 0.42;
      },
      raiseLeftArm: () => {
        mixer.stopAllAction();
        resetBones();
        if (bones.LeftUpperArm) bones.LeftUpperArm.rotation.z = -1.05;
        if (bones.LeftLowerArm) bones.LeftLowerArm.rotation.z = -0.25;
      },
      raiseRightArm: () => {
        mixer.stopAllAction();
        resetBones();
        if (bones.RightUpperArm) bones.RightUpperArm.rotation.z = 1.05;
        if (bones.RightLowerArm) bones.RightLowerArm.rotation.z = 0.25;
      },
    };
    return () => {
      mixer.stopAllAction();
      rigApiRef.current = null;
    };
  }, [animations, cloned, mixer, onRigState, renderStyle, rigApiRef]);

  return (
    <Center position={[0, -0.1, 0]}>
      <primitive object={cloned} />
    </Center>
  );
}

function LoadingSpinner() {
  return (
    <mesh>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshStandardMaterial color="#FF6B8A" wireframe />
    </mesh>
  );
}

export default function GLBModelViewer({ modelPath, fallbackPath, renderStyle }: GLBModelViewerProps) {
  const [error, setError] = useState(false);
  const [rigState, setRigState] = useState<RigState>({ bones: 0, skinnedMeshes: 0, animations: [] });
  const rigApiRef = useRef<RigApi | null>(null);
  console.log('[Avatar] Viewer Loading path=' + modelPath + (fallbackPath ? ' fallback=' + fallbackPath : ''));
  const path = error && fallbackPath ? fallbackPath : modelPath;

  return (
    <div className="relative w-full rounded-3xl overflow-hidden bg-gray-900 shadow-2xl" style={{ aspectRatio: '3/4', minHeight: 400 }}>
      <Canvas
        camera={{ position: [0, 0.3, 2.2], fov: 40 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        shadows
        dpr={[1, 1.5]}
        onCreated={() => console.log('GLB Canvas ready')}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
        <directionalLight position={[-3, 3, -3]} intensity={0.6} color="#FFB8C6" />
        <pointLight position={[0, 2, 3]} intensity={0.8} color="#FF6B8A" />

        <Suspense fallback={<LoadingSpinner />}>
          <ErrorCatcher onError={() => setError(true)}>
            <Model path={path} renderStyle={renderStyle} rigApiRef={rigApiRef} onRigState={setRigState} />
          </ErrorCatcher>
        </Suspense>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <shadowMaterial transparent opacity={0.12} />
        </mesh>
        <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={5} blur={2} far={2} />

        <OrbitControls
          enablePan={false}
          minDistance={1.5} maxDistance={4.5}
          minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 1.8}
          target={[0, 0, 0]}
          enableDamping dampingFactor={0.08}
          autoRotate autoRotateSpeed={0.5}
        />
      </Canvas>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/30 text-xs pointer-events-none bg-black/40 backdrop-blur px-3 py-1 rounded-full select-none">
        bones {rigState.bones} · skinned {rigState.skinnedMeshes} · anim {rigState.animations.length}
      </div>
      {rigState.skinnedMeshes > 0 && (
        <div className="absolute left-3 right-3 top-3 z-20 grid grid-cols-5 gap-1.5">
          {[
            ['Idle', () => rigApiRef.current?.playIdle()],
            ['Pose', () => rigApiRef.current?.playConfident()],
            ['Head', () => rigApiRef.current?.rotateHead()],
            ['L Arm', () => rigApiRef.current?.raiseLeftArm()],
            ['R Arm', () => rigApiRef.current?.raiseRightArm()],
          ].map(([label, action]) => (
            <button
              key={label as string}
              className="rounded-lg bg-black/55 px-2 py-1.5 text-[11px] font-semibold text-white backdrop-blur"
              onClick={action as () => void}
            >
              {label as string}
            </button>
          ))}
        </div>
      )}
      {renderStyle?.halftone && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle at center, white 0 1px, transparent 1.3px)',
            backgroundSize: '9px 9px',
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </div>
  );
}

// Simple error boundary for 3D
function ErrorCatcher({ children, onError }: { children: React.ReactNode; onError: () => void }) {
  try {
    return <>{children}</>;
  } catch {
    onError();
    return null;
  }
}
