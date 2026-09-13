import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Color } from '../game/types';

interface Dice3DProps {
  value: number | null;
  rolling: boolean;
  /** 現在の手番の色。サイコロの色をその色に合わせるために使う */
  color: Color;
  onClick?: () => void;
}

// サイコロの本体色は手番の色に合わせ、目(pip)の色は本体とのコントラストが出る方を選ぶ
const DICE_COLORS: Record<Color, { body: string; pip: string }> = {
  red: { body: '#e0403f', pip: '#ffffff' },
  blue: { body: '#2f6fd6', pip: '#ffffff' },
  yellow: { body: '#f2c230', pip: '#222222' },
  green: { body: '#3f9450', pip: '#ffffff' },
};

// 各面の目(pip)はローカル軸+Z=1,-Z=6,+X=2,-X=5,+Y=3,-Y=4に配置されている(下のfacePips呼び出し参照)。
// ここでは「その目の面法線をワールド上向き(+Y)に一致させる回転」を単軸回転で指定し、
// 出目の値と実際に上を向く面を一致させる。
const FACE_ROTATIONS: Record<number, [number, number, number]> = {
  1: [-Math.PI / 2, 0, 0],
  2: [0, 0, Math.PI / 2],
  3: [0, 0, 0],
  4: [Math.PI, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI / 2, 0, 0],
};

function Pip({
  x,
  y,
  z,
  rot,
  color,
}: {
  x: number;
  y: number;
  z: number;
  rot: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={[x, y, z]} rotation={rot}>
      <circleGeometry args={[0.09, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

const HALF = 0.313; // 箱の半径(0.31)よりわずかに外側に置き、目の面とのZファイティング(ちらつき)を防ぐ
function facePips(
  n: number,
  rot: [number, number, number],
  axis: 'x' | 'y' | 'z',
  sign: 1 | -1,
  pipColor: string,
) {
  const at = (a: number, b: number): { x: number; y: number; z: number } => {
    if (axis === 'x') return { x: sign * HALF, y: a, z: b };
    if (axis === 'y') return { x: a, y: sign * HALF, z: b };
    return { x: a, y: b, z: sign * HALF };
  };
  const d = 0.16;
  const layouts: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-d, -d], [d, d]],
    3: [[-d, -d], [0, 0], [d, d]],
    4: [[-d, -d], [-d, d], [d, -d], [d, d]],
    5: [[-d, -d], [-d, d], [0, 0], [d, -d], [d, d]],
    6: [[-d, -d], [-d, 0], [-d, d], [d, -d], [d, 0], [d, d]],
  };
  return layouts[n].map(([a, b], i) => {
    const p = at(a, b);
    return <Pip key={i} x={p.x} y={p.y} z={p.z} rot={rot} color={pipColor} />;
  });
}

const REST_Y = 0.35;
const GRAVITY = -30; // 重力加速度(単位/秒^2)
const LAUNCH_VELOCITY = 6; // 投げ上げの初速
const BOUNCE_DAMPING = 0.4; // バウンドのたびに速度がこの倍率に減衰する
const MIN_BOUNCE_VELOCITY = 0.6; // これ未満の跳ね返り速度になったら着地とみなす
const SPIN_DAMPING = 0.55; // バウンドのたびに回転速度がこの倍率に減衰する

/** 立方体のサイコロ。振る際に投げ上げ→落下→バウンドという物理的な着地アニメーションを行い、指定の目(value)が上面に来て停止する */
export function Dice3D({ value, rolling, color, onClick }: Dice3DProps) {
  const { body: bodyColor, pip: pipColor } = DICE_COLORS[color];
  const groupRef = useRef<THREE.Group>(null);
  const velY = useRef(0);
  const settled = useRef(false);
  const spin = useRef({ x: 0, y: 0, z: 0 });
  const lastValue = useRef<number | null>(null);
  if (value != null) lastValue.current = value;

  useEffect(() => {
    if (!rolling || !groupRef.current) return;
    velY.current = LAUNCH_VELOCITY;
    settled.current = false;
    groupRef.current.position.y = REST_Y;
    spin.current = {
      x: 10 + Math.random() * 8,
      y: 7 + Math.random() * 6,
      z: (Math.random() - 0.5) * 6,
    };
  }, [rolling]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 1 / 30); // 大きなdeltaでバウンド判定を飛び越えないようクランプ

    if (rolling) {
      if (!settled.current) {
        // 放物運動(重力による投げ上げ→落下)をシミュレートし、着地時にバウンドさせる
        velY.current += GRAVITY * dt;
        groupRef.current.position.y += velY.current * dt;
        if (groupRef.current.position.y <= REST_Y) {
          groupRef.current.position.y = REST_Y;
          if (Math.abs(velY.current) < MIN_BOUNCE_VELOCITY) {
            settled.current = true;
            velY.current = 0;
          } else {
            velY.current = -velY.current * BOUNCE_DAMPING;
            spin.current.x *= SPIN_DAMPING;
            spin.current.y *= SPIN_DAMPING;
            spin.current.z *= SPIN_DAMPING;
          }
        }
      }
      groupRef.current.rotation.x += spin.current.x * dt;
      groupRef.current.rotation.y += spin.current.y * dt;
      groupRef.current.rotation.z += spin.current.z * dt;
    } else if (lastValue.current != null) {
      // パスやコマ出しなどでgame.diceがnullに戻された後も、直前の出目の面を向いたまま静止させる
      // (ここでvalueがnullだからと何もしないと、バウンド中の中途半端な回転で斜めに固まって見える)
      const target = FACE_ROTATIONS[lastValue.current];
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, target[0], 0.25);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, target[1], 0.25);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, target[2], 0.25);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, REST_Y, 0.2);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[0, REST_Y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <RoundedBox args={[0.62, 0.62, 0.62]} radius={0.07} smoothness={4} castShadow>
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.05} />
      </RoundedBox>
      {/* 面ごとの目(pip)。ローカル座標は立方体表面に固定 */}
      {facePips(1, [0, 0, 0], 'z', 1, pipColor)}
      {facePips(6, [Math.PI, 0, 0], 'z', -1, pipColor)}
      {facePips(2, [0, Math.PI / 2, 0], 'x', 1, pipColor)}
      {facePips(5, [0, -Math.PI / 2, 0], 'x', -1, pipColor)}
      {facePips(3, [-Math.PI / 2, 0, 0], 'y', 1, pipColor)}
      {facePips(4, [Math.PI / 2, 0, 0], 'y', -1, pipColor)}
    </group>
  );
}
