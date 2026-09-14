import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { COLOR_HEX } from './colors';
import { COLORS } from '../game/types';

/**
 * トップ画面の演出用、Switch版「世界のアソビ大全51」のルドーアイコンにある
 * 「4色のコマが輪になって並ぶ」アイドルアニメーションを模した軽量な3D装飾。
 * ゲームロジックには一切依存しない見た目だけのコンポーネント。
 * スマホでも重くならないよう、影・複雑なライティングは使わない。
 */
const RADIUS = 0.85;

function BobbingPeg({ colorIndex, angle }: { colorIndex: number; angle: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const x = Math.sin(angle) * RADIUS;
  const z = Math.cos(angle) * RADIUS;
  const hex = COLOR_HEX[COLORS[colorIndex]];
  // コマごとに位相をずらし、順番に上下する波のような動きにする
  const phase = colorIndex * 1.4;

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = 0.06 + Math.sin(state.clock.elapsedTime * 2.2 + phase) * 0.07;
  });

  return (
    <group ref={groupRef} position={[x, 0.06, z]}>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.14, 0.22, 0.28, 16]} />
        <meshStandardMaterial color={hex} roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={hex} roughness={0.25} metalness={0.1} />
      </mesh>
    </group>
  );
}

export function TitlePieceSpinner() {
  return (
    <Canvas
      camera={{ position: [0, 2.6, 2.4], fov: 40 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 3, 2]} intensity={0.6} />
      {COLORS.map((_, i) => (
        <BobbingPeg key={i} colorIndex={i} angle={(i / COLORS.length) * Math.PI * 2} />
      ))}
    </Canvas>
  );
}
