import { Suspense, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';

interface GLBModelViewerProps {
  modelPath: string;
  fallbackPath?: string;
}

function Model({ path }: { path: string }) {
  console.log('[GLB] Loading model:', path);
  const { scene } = useGLTF(path);
  console.log('[GLB] Loaded successfully:', path, '- vertices:', scene.children.length);
  const cloned = scene.clone(true);

  // Normalize materials
  cloned.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

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

export default function GLBModelViewer({ modelPath, fallbackPath }: GLBModelViewerProps) {
  const [error, setError] = useState(false);
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
            <Model path={path} />
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
        拖拽旋转 · 滚轮缩放
      </div>
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
