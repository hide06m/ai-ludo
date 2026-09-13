import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLOR_HEX } from './colors';
import { pieceWorldPosition } from './boardLayout';
import type { Color } from '../game/types';

interface Piece3DProps {
  color: Color;
  /** ピースの現在のstep値(-1=home)。周回コース/ゴールマス間の1マスずつのホップ移動に使う */
  step: number;
  x: number;
  z: number;
  selected?: boolean;
  onClick?: () => void;
  /** 選択可能な場合の移動先マスのワールド座標。ホバー時にそのマスをハイライトするために使う */
  previewTarget?: [number, number];
  /** ホバー状態が変化した際に呼ばれる(弾ける敵コマの表示に使う) */
  onHoverChange?: (hovering: boolean) => void;
  /** 選択中のコマがこのコマを弾ける位置にホバーされている場合、目印を表示する */
  threatened?: boolean;
  /** このコマが目標マスに実際に到着した瞬間に呼ばれる(弾き飛ばし演出の同期に使う) */
  onArrived?: () => void;
  /** あがり(ゴール最奥に到達)済みかどうか。あがった瞬間に一度だけ祝福のポップ演出を出す */
  finished?: boolean;
}

const JUMP_DISTANCE_THRESHOLD = 1.5; // これ以上の移動距離は「弾き飛ばし/コマ出し」とみなし演出を出す
const POP_DURATION = 0.5; // 秒
const HOP_DURATION = 0.16; // ホップ1マスあたりの所要時間(秒)。実時間ベースにして山なりの弧を描かせる
const HOP_HEIGHT = 0.14; // ホップの跳ね上がる高さ
const GLIDE_LERP = 0.12; // ホーム復帰・コマ出しなど通常のグライド

/** 円錐台+球で構成する「ペグ型」コマ。光沢のあるプラスチック風マテリアル */
export function Piece3D({
  color,
  step,
  x,
  z,
  selected,
  onClick,
  previewTarget,
  onHoverChange,
  threatened,
  onArrived,
  finished,
}: Piece3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const previewRef = useRef<THREE.Mesh>(null);
  const initialized = useRef(false);
  const prevTarget = useRef<{ x: number; z: number } | null>(null);
  const popElapsed = useRef(Number.POSITIVE_INFINITY);
  const prevStep = useRef<number | null>(null);
  const hopQueue = useRef<[number, number][]>([]);
  const hopFrom = useRef<{ x: number; z: number } | null>(null);
  const hopElapsed = useRef(0);
  const [hovering, setHovering] = useState(false);
  const arrivedNotified = useRef(false);
  const prevFinished = useRef(false);

  // stepが進んだ(周回コース/ゴールマス内)場合は、通過する各マスをホップ移動の経由点として積む
  useEffect(() => {
    const prev = prevStep.current;
    prevStep.current = step;
    if (prev !== null && prev >= 0 && step > prev) {
      const wps: [number, number][] = [];
      for (let s = prev + 1; s <= step; s++) {
        wps.push(pieceWorldPosition(color, s, 0));
      }
      hopQueue.current = wps;
    } else {
      hopQueue.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 大きくジャンプする移動(弾き飛ばし・コマ出し・ホーム復帰)を検知してポップ演出のタイマーを起動する
  useEffect(() => {
    if (prevTarget.current) {
      const dx = x - prevTarget.current.x;
      const dz = z - prevTarget.current.z;
      if (Math.hypot(dx, dz) > JUMP_DISTANCE_THRESHOLD) {
        popElapsed.current = 0;
      }
    }
    if (!prevTarget.current || prevTarget.current.x !== x || prevTarget.current.z !== z) {
      arrivedNotified.current = false;
    }
    prevTarget.current = { x, z };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, z]);

  // あがった瞬間(finishedがfalse→true)に、既存のポップ演出を一度だけ再生する
  useEffect(() => {
    if (finished && !prevFinished.current) {
      popElapsed.current = 0;
    }
    prevFinished.current = !!finished;
  }, [finished]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    let hopT = 0; // 現在のホップの進行度(0→1)。山なりの跳ね上げ高さの計算に使う
    if (!initialized.current) {
      groupRef.current.position.x = x;
      groupRef.current.position.z = z;
      initialized.current = true;
    } else if (hopQueue.current.length > 0) {
      if (!hopFrom.current) {
        hopFrom.current = { x: groupRef.current.position.x, z: groupRef.current.position.z };
        hopElapsed.current = 0;
      }
      hopElapsed.current += delta;
      hopT = Math.min(1, hopElapsed.current / HOP_DURATION);
      const eased = 1 - (1 - hopT) * (1 - hopT); // ease-out: 着地際に減速する
      const [tx, tz] = hopQueue.current[0];
      groupRef.current.position.x = THREE.MathUtils.lerp(hopFrom.current.x, tx, eased);
      groupRef.current.position.z = THREE.MathUtils.lerp(hopFrom.current.z, tz, eased);
      if (hopT >= 1) {
        hopQueue.current.shift();
        hopFrom.current = null; // 次のホップは今の着地点を起点に開始する
      }
    } else {
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, x, GLIDE_LERP);
      groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, z, GLIDE_LERP);
    }

    // 実際に目標マスへ到着した瞬間を検知する(弾き飛ばし演出をタイマーではなく実到着に同期させるため)
    if (
      onArrived &&
      !arrivedNotified.current &&
      hopQueue.current.length === 0 &&
      Math.hypot(groupRef.current.position.x - x, groupRef.current.position.z - z) < 0.05
    ) {
      arrivedNotified.current = true;
      onArrived();
    }

    // ホップ中は実際の移動進行度に同期した山なりの弧を描き、単調な上下動にならないようにする
    const hopBounce = hopQueue.current.length > 0 || hopFrom.current ? Math.sin(Math.PI * hopT) * HOP_HEIGHT : 0;
    const targetY = selected ? 0.15 + Math.sin(state.clock.elapsedTime * 4) * 0.05 : hopBounce;
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.5);

    if (bodyRef.current) {
      if (popElapsed.current <= POP_DURATION) {
        popElapsed.current += delta;
        const t = popElapsed.current / POP_DURATION;
        const bounce = Math.sin(Math.min(t, 1) * Math.PI) * 0.5;
        bodyRef.current.scale.setScalar(1 + bounce);
      } else {
        bodyRef.current.scale.setScalar(1);
      }
    }

    if (previewRef.current) {
      const show = hovering && !!previewTarget;
      const targetOpacity = show ? 0.55 + Math.sin(state.clock.elapsedTime * 5) * 0.15 : 0;
      const mat = previewRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.3);
      previewRef.current.visible = mat.opacity > 0.02;
    }
  });

  const hex = COLOR_HEX[color];

  return (
    <>
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          setHovering(true);
          onHoverChange?.(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          setHovering(false);
          onHoverChange?.(false);
          document.body.style.cursor = 'auto';
        }}
      >
        {onClick && (
          // 見た目のサイズは変えず、タップ判定だけ一回り大きくする(特にスマホでの誤タップ対策)
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.38, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        )}
        <group ref={bodyRef}>
          <mesh position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.22, 0.28, 16]} />
            <meshPhysicalMaterial color={hex} roughness={0.22} metalness={0.05} clearcoat={0.8} clearcoatRoughness={0.15} />
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshPhysicalMaterial color={hex} roughness={0.18} metalness={0.05} clearcoat={0.9} clearcoatRoughness={0.1} />
          </mesh>
        </group>
        {threatened && (
          // 非選択(バウンドしない)コマにも確実に見えるよう、盤面より高い位置に配置する
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.36, 24]} />
            <meshBasicMaterial color="#ff5252" transparent opacity={0.9} depthTest={false} />
          </mesh>
        )}
        {selected && (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.4, 24]} />
            <meshBasicMaterial color="white" transparent opacity={0.8} />
          </mesh>
        )}
      </group>
      {previewTarget && (
        <mesh
          ref={previewRef}
          position={[previewTarget[0], 0.015, previewTarget[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[0.85, 0.85]} />
          <meshBasicMaterial color="white" transparent opacity={0} />
        </mesh>
      )}
    </>
  );
}
