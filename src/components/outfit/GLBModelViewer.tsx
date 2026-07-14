import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import { ContactShadows } from '@react-three/drei/core/ContactShadows.js';
import { useGLTF } from '@react-three/drei/core/Gltf.js';
import { Center } from '@react-three/drei/core/Center.js';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {
  AvatarExpressionName,
  AvatarOutfit,
  AvatarRenderStyle,
  BodyVisibilityMask,
  VrmReadyMetadata,
} from '@/types/avatarSystem';

interface GLBModelViewerProps {
  modelPath: string;
  fallbackPath?: string;
  renderStyle?: AvatarRenderStyle;
  outfit?: AvatarOutfit | null;
  runtimeMetadata?: VrmReadyMetadata;
}

interface ExpressionController {
  setExpression: (expression: AvatarExpressionName) => void;
}

interface RigApi extends ExpressionController {
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
  outfitMeshes: number;
  outfitSkinned: boolean;
  outfitName?: string;
  expression: AvatarExpressionName;
  bodyMask?: BodyVisibilityMask;
}

type Influence = [string, number];
type ExpressionProxy = {
  group: THREE.Group;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  mouth: THREE.Mesh;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
};

const EXPRESSIONS: AvatarExpressionName[] = ['neutral', 'smile', 'cool', 'surprised'];
const GARMENT_SURFACE_OFFSET_Z = 0.012;
const GARMENT_THICKNESS_BIAS = 1.08;
const LEGACY_OUTFIT_MATERIALS = ['outfit_primary', 'outfit_accent', 'outfit_dark', 'shoe_dark'];

function toonifyMaterial(material: THREE.Material, style?: AvatarRenderStyle) {
  if (!style?.toonShading) return material;
  const source = material as THREE.MeshStandardMaterial;
  const toon = new THREE.MeshToonMaterial({
    name: source.name,
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

function applyBodyVisibilityMask(material: THREE.Material, outfitActive: boolean) {
  const name = material.name || '';
  if (!outfitActive || !LEGACY_OUTFIT_MATERIALS.some((legacyName) => name.includes(legacyName))) {
    return null;
  }

  const masked = material as THREE.MeshToonMaterial;
  masked.name = `${name}:masked-canonical-base`;
  masked.transparent = true;
  masked.opacity = name.includes('accent') ? 0.08 : 0.32;
  masked.depthWrite = false;
  if ('color' in masked) masked.color = new THREE.Color('#2e3038');

  return name;
}

function createBodyMaskReport(maskedMaterialNames: string[]): BodyVisibilityMask {
  return {
    hiddenPrimitiveNames: [],
    mutedMaterialNames: [...new Set(maskedMaterialNames)],
    reason: maskedMaterialNames.length > 0 ? 'outfit-overlay-active' : 'canonical-body-runtime',
  };
}

function expressionMaterial(color: string, opacity = 0.92) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function makeFacePlane(name: string, width: number, height: number, color: string, opacity = 0.92) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), expressionMaterial(color, opacity));
  mesh.name = name;
  mesh.renderOrder = 30;
  return mesh;
}

function createExpressionProxy() {
  const group = new THREE.Group();
  group.name = 'ExpressionControllerProxy';
  group.position.set(0, 0, 0);

  const leftEye = makeFacePlane('expr-left-eye', 0.045, 0.014, '#17141b');
  leftEye.position.set(-0.075, 0.115, 0.238);
  const rightEye = makeFacePlane('expr-right-eye', 0.045, 0.014, '#17141b');
  rightEye.position.set(0.075, 0.115, 0.238);
  const mouth = makeFacePlane('expr-mouth', 0.078, 0.011, '#9f3d52');
  mouth.position.set(0, 0.018, 0.242);
  const leftBrow = makeFacePlane('expr-left-brow', 0.052, 0.007, '#3c2118', 0.86);
  leftBrow.position.set(-0.077, 0.16, 0.24);
  const rightBrow = makeFacePlane('expr-right-brow', 0.052, 0.007, '#3c2118', 0.86);
  rightBrow.position.set(0.077, 0.16, 0.24);

  group.add(leftEye, rightEye, mouth, leftBrow, rightBrow);
  return { group, leftEye, rightEye, mouth, leftBrow, rightBrow };
}

function applyExpression(
  expression: AvatarExpressionName,
  proxy: ExpressionProxy | null,
  bones: Record<string, THREE.Bone>
) {
  const head = bones.Head;
  if (head) head.rotation.set(0, 0, 0);
  if (!proxy) return;

  proxy.leftEye.scale.set(1, 1, 1);
  proxy.rightEye.scale.set(1, 1, 1);
  proxy.mouth.scale.set(1, 1, 1);
  proxy.leftBrow.rotation.set(0, 0, 0);
  proxy.rightBrow.rotation.set(0, 0, 0);
  proxy.leftBrow.position.y = 0.16;
  proxy.rightBrow.position.y = 0.16;
  proxy.mouth.position.y = 0.018;

  if (expression === 'smile') {
    proxy.leftEye.scale.y = 0.72;
    proxy.rightEye.scale.y = 0.72;
    proxy.mouth.scale.set(1.35, 1.15, 1);
    proxy.mouth.position.y = 0.025;
    if (head) head.rotation.z = 0.035;
  } else if (expression === 'cool') {
    proxy.leftEye.scale.y = 0.62;
    proxy.rightEye.scale.y = 0.62;
    proxy.leftBrow.rotation.z = -0.18;
    proxy.rightBrow.rotation.z = 0.18;
    proxy.mouth.scale.set(0.82, 0.78, 1);
    if (head) head.rotation.y = 0.18;
  } else if (expression === 'surprised') {
    proxy.leftEye.scale.set(1.16, 1.55, 1);
    proxy.rightEye.scale.set(1.16, 1.55, 1);
    proxy.leftBrow.position.y = 0.175;
    proxy.rightBrow.position.y = 0.175;
    proxy.mouth.scale.set(0.72, 2.2, 1);
    proxy.mouth.position.y = 0.008;
    if (head) head.rotation.x = -0.08;
  }
}

function materialForOutfit(outfit: AvatarOutfit, color: string, name: string) {
  const material = new THREE.MeshToonMaterial({
    name,
    color: new THREE.Color(color),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.98,
  });
  material.depthWrite = true;
  return material;
}

function boneIndex(skeleton: THREE.Skeleton, name: string) {
  return Math.max(0, skeleton.bones.findIndex((bone) => bone.name === name));
}

function normalizedInfluences(skeleton: THREE.Skeleton, influences: Influence[]) {
  const compact = influences
    .filter(([, weight]) => weight > 0)
    .slice(0, 4);
  const total = compact.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const indices = [0, 0, 0, 0];
  const weights = [0, 0, 0, 0];

  compact.forEach(([name, weight], index) => {
    indices[index] = boneIndex(skeleton, name);
    weights[index] = weight / total;
  });

  return { indices, weights };
}

function skinForPosition(position: THREE.Vector3, outfit: AvatarOutfit): Influence[] {
  const side = position.x < 0 ? 'Left' : 'Right';
  const absX = Math.abs(position.x);

  if (outfit.category === 'bottom') {
    if (position.y < 0.16) return [[`${side}LowerLeg`, 0.9], [`${side}UpperLeg`, 0.1]];
    if (position.y < 0.32) return [[`${side}LowerLeg`, 0.62], [`${side}UpperLeg`, 0.38]];
    if (position.y < 0.48) return [[`${side}UpperLeg`, 0.68], ['Hips', 0.32]];
    return [['Hips', 0.58], [`${side}UpperLeg`, 0.28], ['Spine', 0.14]];
  }

  if (outfit.category === 'dress') {
    if (position.y < 0.34) return [[`${side}UpperLeg`, 0.62], ['Hips', 0.38]];
    if (position.y < 0.56) return [['Hips', 0.58], [`${side}UpperLeg`, 0.22], ['Spine', 0.2]];
    if (position.y < 0.74) return [['Spine', 0.52], ['Chest', 0.42], ['Hips', 0.06]];
    return [['Chest', 0.78], ['Spine', 0.22]];
  }

  if (outfit.category === 'outerwear' || outfit.category === 'top') {
    if (absX > 0.22) {
      if (position.y < 0.58) return [[`${side}LowerArm`, 0.68], [`${side}UpperArm`, 0.32]];
      if (position.y < 0.7) return [[`${side}UpperArm`, 0.6], [`${side}LowerArm`, 0.24], ['Chest', 0.16]];
      return [[`${side}UpperArm`, 0.64], ['Chest', 0.28], [`${side}LowerArm`, 0.08]];
    }
    if (position.y < 0.55) return [['Spine', 0.62], ['Hips', 0.28], ['Chest', 0.1]];
    if (position.y < 0.73) return [['Spine', 0.42], ['Chest', 0.54], ['Hips', 0.04]];
    return [['Chest', 0.78], ['Spine', 0.16], [`${side}UpperArm`, 0.06]];
  }

  return [['Chest', 1]];
}

function applySkinning(geometry: THREE.BufferGeometry, skeleton: THREE.Skeleton, outfit: AvatarOutfit, overrideBone?: string) {
  const position = geometry.getAttribute('position');
  const indices: number[] = [];
  const weights: number[] = [];
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const influences = overrideBone ? [[overrideBone, 1] as Influence] : skinForPosition(vertex, outfit);
    const normalized = normalizedInfluences(skeleton, influences);
    indices.push(...normalized.indices);
    weights.push(...normalized.weights);
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.computeVertexNormals();
}

function makeSkinnedMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  skeleton: THREE.Skeleton,
  outfit: AvatarOutfit,
  overrideBone?: string
) {
  applySkinning(geometry, skeleton, outfit, overrideBone);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(skeleton);
  return mesh;
}

function tubeGeometry(rings: Array<{ y: number; rx: number; rz: number; cx?: number; cz?: number }>, segments = 28, thicknessBias = GARMENT_THICKNESS_BIAS) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < segments; i += 1) {
      const u = i / segments;
      const angle = Math.PI * 2 * u;
      positions.push(
        (ring.cx ?? 0) + Math.cos(angle) * ring.rx * thicknessBias,
        ring.y,
        (ring.cz ?? 0) + Math.sin(angle) * ring.rz * thicknessBias + GARMENT_SURFACE_OFFSET_Z
      );
      uvs.push(u, ringIndex / Math.max(1, rings.length - 1));
    }
  });

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = ring * segments + i;
      const b = ring * segments + ((i + 1) % segments);
      const c = (ring + 1) * segments + i;
      const d = (ring + 1) * segments + ((i + 1) % segments);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function panelGeometry(points: THREE.Vector3[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap((point) => [point.x, point.y, point.z + GARMENT_SURFACE_OFFSET_Z]), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

function buildProxyOutfit(outfit: AvatarOutfit, skeleton: THREE.Skeleton) {
  const group = new THREE.Group();
  group.name = `outfit-proxy-${outfit.productId}`;
  const base = materialForOutfit(outfit, outfit.materialConfig.baseColor, `${outfit.id}-base`);
  const secondary = materialForOutfit(outfit, outfit.materialConfig.secondaryColor ?? outfit.materialConfig.baseColor, `${outfit.id}-secondary`);
  const trim = materialForOutfit(outfit, outfit.materialConfig.trimColor ?? '#23222a', `${outfit.id}-trim`);

  if (outfit.category === 'top') {
    group.add(makeSkinnedMesh('proxy-top-body', tubeGeometry([
      { y: 0.51, rx: 0.225, rz: 0.145 },
      { y: 0.62, rx: 0.205, rz: 0.148 },
      { y: 0.76, rx: 0.225, rz: 0.142 },
      { y: 0.86, rx: 0.14, rz: 0.105 },
    ]), base, skeleton, outfit));
    group.add(makeSkinnedMesh('proxy-top-left-sleeve', tubeGeometry([
      { y: 0.75, rx: 0.048, rz: 0.052, cx: -0.22, cz: 0.015 },
      { y: 0.66, rx: 0.044, rz: 0.049, cx: -0.275, cz: 0.035 },
      { y: 0.57, rx: 0.035, rz: 0.042, cx: -0.305, cz: 0.06 },
    ], 18), secondary, skeleton, outfit));
    group.add(makeSkinnedMesh('proxy-top-right-sleeve', tubeGeometry([
      { y: 0.75, rx: 0.048, rz: 0.052, cx: 0.22, cz: 0.015 },
      { y: 0.66, rx: 0.044, rz: 0.049, cx: 0.275, cz: 0.035 },
      { y: 0.57, rx: 0.035, rz: 0.042, cx: 0.305, cz: 0.06 },
    ], 18), secondary, skeleton, outfit));
    group.add(makeSkinnedMesh('proxy-top-hem', tubeGeometry([
      { y: 0.505, rx: 0.232, rz: 0.151 },
      { y: 0.535, rx: 0.226, rz: 0.149 },
    ], 28), trim, skeleton, outfit));
  } else if (outfit.category === 'bottom') {
    group.add(makeSkinnedMesh('proxy-bottom-waist', tubeGeometry([
      { y: 0.46, rx: 0.18, rz: 0.118 },
      { y: 0.52, rx: 0.185, rz: 0.12 },
    ], 24), trim, skeleton, outfit));
    [-1, 1].forEach((side) => {
      group.add(makeSkinnedMesh(`proxy-bottom-${side < 0 ? 'left' : 'right'}-leg`, tubeGeometry([
        { y: 0.44, rx: 0.07, rz: 0.075, cx: side * 0.085 },
        { y: 0.32, rx: 0.063, rz: 0.068, cx: side * 0.095, cz: 0.01 },
        { y: 0.19, rx: 0.055, rz: 0.058, cx: side * 0.102, cz: 0.028 },
        { y: 0.075, rx: 0.047, rz: 0.048, cx: side * 0.108, cz: 0.048 },
      ], 20), base, skeleton, outfit));
    });
  } else if (outfit.category === 'outerwear') {
    group.add(makeSkinnedMesh('proxy-outerwear-body', tubeGeometry([
      { y: 0.43, rx: 0.25, rz: 0.16 },
      { y: 0.58, rx: 0.245, rz: 0.168 },
      { y: 0.77, rx: 0.26, rz: 0.16 },
      { y: 0.88, rx: 0.155, rz: 0.115 },
    ]), base, skeleton, outfit));
    [-1, 1].forEach((side) => {
      group.add(makeSkinnedMesh(`proxy-outerwear-${side < 0 ? 'left' : 'right'}-sleeve`, tubeGeometry([
        { y: 0.75, rx: 0.058, rz: 0.061, cx: side * 0.23, cz: 0.016 },
        { y: 0.63, rx: 0.052, rz: 0.056, cx: side * 0.29, cz: 0.043 },
        { y: 0.51, rx: 0.043, rz: 0.049, cx: side * 0.315, cz: 0.074 },
      ], 18), base, skeleton, outfit));
    });
    group.add(makeSkinnedMesh('proxy-outerwear-left-lapel', panelGeometry([
      new THREE.Vector3(-0.03, 0.85, 0.132),
      new THREE.Vector3(-0.15, 0.77, 0.145),
      new THREE.Vector3(-0.085, 0.54, 0.155),
      new THREE.Vector3(-0.01, 0.61, 0.148),
    ]), trim, skeleton, outfit));
    group.add(makeSkinnedMesh('proxy-outerwear-right-lapel', panelGeometry([
      new THREE.Vector3(0.03, 0.85, 0.132),
      new THREE.Vector3(0.15, 0.77, 0.145),
      new THREE.Vector3(0.085, 0.54, 0.155),
      new THREE.Vector3(0.01, 0.61, 0.148),
    ]), trim, skeleton, outfit));
  } else if (outfit.category === 'dress') {
    group.add(makeSkinnedMesh('proxy-dress-bodice', tubeGeometry([
      { y: 0.56, rx: 0.19, rz: 0.13 },
      { y: 0.7, rx: 0.205, rz: 0.135 },
      { y: 0.84, rx: 0.13, rz: 0.105 },
    ]), base, skeleton, outfit));
    group.add(makeSkinnedMesh('proxy-dress-skirt', tubeGeometry([
      { y: 0.55, rx: 0.185, rz: 0.128 },
      { y: 0.42, rx: 0.235, rz: 0.145 },
      { y: 0.29, rx: 0.285, rz: 0.16 },
      { y: 0.19, rx: 0.315, rz: 0.172 },
    ], 32), secondary, skeleton, outfit));
    group.add(makeSkinnedMesh('proxy-dress-waist', tubeGeometry([
      { y: 0.535, rx: 0.19, rz: 0.13 },
      { y: 0.565, rx: 0.195, rz: 0.132 },
    ], 28), trim, skeleton, outfit));
  }

  return group;
}

function Model({
  path,
  renderStyle,
  outfit,
  runtimeMetadata,
  rigApiRef,
  onRigState,
}: {
  path: string;
  renderStyle?: AvatarRenderStyle;
  outfit?: AvatarOutfit | null;
  runtimeMetadata?: VrmReadyMetadata;
  rigApiRef: MutableRefObject<RigApi | null>;
  onRigState: (state: RigState) => void;
}) {
  console.log('[GLB] Loading model:', path);
  const { scene, animations } = useGLTF(path);
  console.log('[GLB] Loaded successfully:', path, '- vertices:', scene.children.length);
  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);
  const bonesRef = useRef<Record<string, THREE.Bone>>({});
  const avatarSkeletonRef = useRef<THREE.Skeleton | null>(null);
  const outfitGroupRef = useRef<THREE.Group | null>(null);
  const expressionProxyRef = useRef<ExpressionProxy | null>(null);
  const expressionRef = useRef<AvatarExpressionName>('neutral');

  useFrame((_, delta) => mixer.update(delta));

  useEffect(() => {
    const bones: Record<string, THREE.Bone> = {};
    const mutedMaterials: string[] = [];
    let skinnedMeshes = 0;
    let avatarSkeleton: THREE.Skeleton | null = null;
    cloned.traverse((child) => {
      if (child instanceof THREE.Bone) bones[child.name] = child;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m) => {
            const toon = toonifyMaterial(m, renderStyle);
            const masked = applyBodyVisibilityMask(toon, Boolean(outfit));
            if (masked) mutedMaterials.push(masked);
            return toon;
          });
        } else {
          child.material = toonifyMaterial(child.material, renderStyle);
          const masked = applyBodyVisibilityMask(child.material, Boolean(outfit));
          if (masked) mutedMaterials.push(masked);
        }
        if (renderStyle?.outline && !child.getObjectByName('comic-outline')) addOutline(child);
      }
      if (child instanceof THREE.SkinnedMesh) {
        skinnedMeshes += 1;
        avatarSkeleton = avatarSkeleton ?? child.skeleton;
      }
    });
    bonesRef.current = bones;
    avatarSkeletonRef.current = avatarSkeleton;
    if (bones.Head && !expressionProxyRef.current) {
      const proxy = createExpressionProxy();
      bones.Head.add(proxy.group);
      expressionProxyRef.current = proxy;
      applyExpression(expressionRef.current, proxy, bones);
    }
    onRigState({
      bones: Object.keys(bones).length,
      skinnedMeshes,
      animations: animations.map((clip) => clip.name),
      outfitMeshes: 0,
      outfitSkinned: false,
      expression: expressionRef.current,
      bodyMask: createBodyMaskReport(mutedMaterials),
    });

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
        applyExpression(expressionRef.current, expressionProxyRef.current, bones);
      },
      raiseLeftArm: () => {
        mixer.stopAllAction();
        resetBones();
        if (bones.LeftUpperArm) bones.LeftUpperArm.rotation.z = -1.05;
        if (bones.LeftLowerArm) bones.LeftLowerArm.rotation.z = -0.25;
        applyExpression(expressionRef.current, expressionProxyRef.current, bones);
      },
      raiseRightArm: () => {
        mixer.stopAllAction();
        resetBones();
        if (bones.RightUpperArm) bones.RightUpperArm.rotation.z = 1.05;
        if (bones.RightLowerArm) bones.RightLowerArm.rotation.z = 0.25;
        applyExpression(expressionRef.current, expressionProxyRef.current, bones);
      },
      setExpression: (expression) => {
        expressionRef.current = expression;
        applyExpression(expression, expressionProxyRef.current, bones);
        onRigState({
          bones: Object.keys(bones).length,
          skinnedMeshes,
          animations: animations.map((clip) => clip.name),
          outfitMeshes: outfitGroupRef.current?.children.length ?? 0,
          outfitSkinned: Boolean(outfitGroupRef.current),
          outfitName: outfit?.name,
          expression,
          bodyMask: createBodyMaskReport(mutedMaterials),
        });
      },
    };
    return () => {
      mixer.stopAllAction();
      rigApiRef.current = null;
    };
  }, [animations, cloned, mixer, onRigState, outfit, renderStyle, rigApiRef]);

  useEffect(() => {
    if (outfitGroupRef.current) {
      cloned.remove(outfitGroupRef.current);
      outfitGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
          else child.material.dispose();
        }
      });
      outfitGroupRef.current = null;
    }

    const skeleton = avatarSkeletonRef.current;
    if (!outfit || !skeleton || outfit.assetFormat !== 'procedural-proxy') return;

    const group = buildProxyOutfit(outfit, skeleton);
    outfitGroupRef.current = group;
    cloned.add(group);

    let outfitMeshes = 0;
    let outfitSkinned = true;
    group.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        outfitMeshes += 1;
        outfitSkinned = outfitSkinned && child.geometry.hasAttribute('skinIndex') && child.geometry.hasAttribute('skinWeight');
      }
    });
    onRigState({
      bones: Object.keys(bonesRef.current).length,
      skinnedMeshes: 1,
      animations: animations.map((clip) => clip.name),
      outfitMeshes,
      outfitSkinned,
      outfitName: outfit.name,
      expression: expressionRef.current,
      bodyMask: createBodyMaskReport([]),
    });
  }, [animations, cloned, onRigState, outfit, runtimeMetadata]);

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

export default function GLBModelViewer({ modelPath, fallbackPath, renderStyle, outfit, runtimeMetadata }: GLBModelViewerProps) {
  const [error, setError] = useState(false);
  const [rigState, setRigState] = useState<RigState>({
    bones: 0,
    skinnedMeshes: 0,
    animations: [],
    outfitMeshes: 0,
    outfitSkinned: false,
    expression: 'neutral',
  });
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
            <Model
              path={path}
              renderStyle={renderStyle}
              outfit={outfit}
              runtimeMetadata={runtimeMetadata}
              rigApiRef={rigApiRef}
              onRigState={setRigState}
            />
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
        bones {rigState.bones} · skinned {rigState.skinnedMeshes} · outfit {rigState.outfitMeshes} · anim {rigState.animations.length}
      </div>
      {rigState.outfitName && (
        <div className="absolute right-3 bottom-12 max-w-[58%] rounded-xl bg-black/55 px-3 py-2 text-right text-[11px] text-white/80 backdrop-blur">
          {rigState.outfitName}
          <span className="block text-white/45">{rigState.outfitSkinned ? 'skinned-compatible' : 'proxy pending'}</span>
        </div>
      )}
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
      {rigState.skinnedMeshes > 0 && (
        <div className="absolute left-3 right-3 top-14 z-20 grid grid-cols-4 gap-1.5">
          {EXPRESSIONS.map((expression) => (
            <button
              key={expression}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold backdrop-blur ${rigState.expression === expression ? 'bg-pink-500 text-white' : 'bg-black/45 text-white/80'}`}
              onClick={() => rigApiRef.current?.setExpression(expression)}
            >
              {expression}
            </button>
          ))}
        </div>
      )}
      {runtimeMetadata && (
        <div className="absolute left-3 bottom-12 max-w-[52%] rounded-xl bg-black/45 px-3 py-2 text-[10px] text-white/55 backdrop-blur">
          VRM-ready · {runtimeMetadata.runtimeLayers.join('/')}
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
