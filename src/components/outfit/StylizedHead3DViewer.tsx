import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import { useGLTF } from '@react-three/drei/core/Gltf.js';
import * as THREE from 'three';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';

interface StylizedHead3DViewerProps {
  modelUrl: string;
  previewUrl?: string;
}

function toonMaterial(source: THREE.Material) {
  const material = source as THREE.MeshStandardMaterial;
  return new THREE.MeshToonMaterial({
    name: `${source.name || 'head'}-anime-toon`,
    color: material.color ?? new THREE.Color('#e6ad8e'),
    map: material.map ?? null,
    vertexColors: Boolean(material.vertexColors),
    transparent: material.transparent,
    opacity: material.opacity,
    side: THREE.DoubleSide,
  });
}

function HeadAsset({ modelUrl, onReady }: { modelUrl: string; onReady: () => void }) {
  const gltf = useGLTF(modelUrl);
  const groupRef = useRef<THREE.Group>(null);
  const scene = useMemo(() => cloneScene(gltf.scene), [gltf.scene]);

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = Array.isArray(object.material)
        ? object.material.map(toonMaterial)
        : toonMaterial(object.material);
      object.castShadow = true;
      object.receiveShadow = true;
    });

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
    scene.position.sub(center);
    scene.scale.setScalar(1.65 / maxDimension);
    onReady();
  }, [onReady, scene]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.16;
  });

  return (
    <group ref={groupRef} position={[0, -0.02, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export default function StylizedHead3DViewer({ modelUrl, previewUrl }: StylizedHead3DViewerProps) {
  const [ready, setReady] = useState(false);

  return (
    <div className="relative aspect-square min-h-[360px] overflow-hidden rounded-lg border border-white/10 bg-[#141723]">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 0.04, 2.2], fov: 35 }}>
        <color attach="background" args={['#141723']} />
        <ambientLight intensity={1.55} />
        <directionalLight position={[2.2, 3.2, 3.6]} intensity={2.4} castShadow />
        <directionalLight position={[-2.8, 1.1, 1.5]} intensity={1.1} color="#f58cac" />
        <Suspense fallback={null}>
          <HeadAsset modelUrl={modelUrl} onReady={() => setReady(true)} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.35}
          maxDistance={3.5}
          target={[0, 0, 0]}
        />
      </Canvas>
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#141723] text-sm text-gray-300">
          加载动漫 3D 头部...
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/65 px-2 py-1 text-[11px] text-white">
        拖动旋转 · 双指缩放 · NeRF GLB
      </div>
      {previewUrl && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 right-3 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold text-gray-900"
        >
          360° 视频
        </a>
      )}
    </div>
  );
}
