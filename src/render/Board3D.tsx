import { Text } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { HOME_STRETCH_LENGTH, TRACK_LENGTH, startOffset } from '../game/board';
import { COLORS, type Color } from '../game/types';
import {
  CELL_SIZE,
  GRID_SIZE,
  armRotationY,
  goalWorldPosition,
  preGoalWorldPosition,
  startLabelTransform,
  trackWorldPosition,
  yardWorldPosition,
} from './boardLayout';
import { COLOR_HEX } from './colors';

function lighten(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#ffffff'), amount);
  return `#${c.getHexString()}`;
}

// ゴールへ折れる手前マスの塗りつぶし色。白い矢印との対比が強すぎないよう、通常色より明度を上げている
const ARROW_CELL_HEX: Record<Color, string> = Object.fromEntries(
  COLORS.map((c) => [c, lighten(COLOR_HEX[c], 0.22)]),
) as Record<Color, string>;

// 自陣待機マスの塗りつぶし色。ゴールマス(通常色)と矢印マス(0.22)の中間の明度にする
const YARD_CELL_HEX: Record<Color, string> = Object.fromEntries(
  COLORS.map((c) => [c, lighten(COLOR_HEX[c], 0.11)]),
) as Record<Color, string>;

// 盤面ベース(boxGeometry, y=0.005, 高さ0.05)の上面のワールドY座標
const BOARD_TOP_Y = 0.005 + 0.05 / 2;

// 盤面ベースの上に重ねて描くマス目・格子線・矢印等の間隔。近すぎると深度バッファの
// 精度不足でちらつく(Z-fighting、特にAndroid端末で顕著だった)ため、
// 見た目では気にならない範囲で十分な間隔を空けている

function Cell({ x, z, color, size = 0.92 }: { x: number; z: number; color: string; size?: number }) {
  return (
    <mesh position={[x, BOARD_TOP_Y + 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

/** 盤面全体(13x13マス)に格子線を引き、1マスずつの区画が視認できるようにする */
function GridLines() {
  const lineWidth = 0.02;
  const lineColor = '#c7bfa8';
  const half = GRID_SIZE / 2;
  const lines = [];
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = -half + i;
    lines.push(
      <mesh key={`v-${i}`} position={[pos, BOARD_TOP_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lineWidth, GRID_SIZE]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>,
    );
    lines.push(
      <mesh key={`h-${i}`} position={[0, BOARD_TOP_Y + 0.01, pos]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GRID_SIZE, lineWidth]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>,
    );
  }
  return <group>{lines}</group>;
}

/** 木目調テーブル: 色味のわずかに異なる板を並べ、画像テクスチャなしで板張り感を出す */
function TableTop({ size }: { size: number }) {
  const plankCount = 9;
  const plankWidth = size / plankCount;
  const tones = ['#6b4530', '#71492f', '#664128', '#6f4a31'];
  return (
    <group position={[0, -0.06, 0]}>
      {Array.from({ length: plankCount }, (_, i) => (
        <mesh key={i} position={[-size / 2 + plankWidth * (i + 0.5), 0, 0]} receiveShadow>
          <boxGeometry args={[plankWidth * 0.98, 0.1, size]} />
          <meshStandardMaterial color={tones[i % tones.length]} roughness={0.85} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

/** 各色のスタートマスに表示する[START]文字。文字の下側が盤の最寄りの端を向くよう回転する */
function StartLabel({ color }: { color: Color }) {
  const { x, z, rotationY } = startLabelTransform(color);
  return (
    <group position={[x, BOARD_TOP_Y + 0.1, z]} rotation={[0, rotationY, 0]}>
      <Text rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color="#222" anchorX="center" anchorY="middle">
        START
      </Text>
    </group>
  );
}

// 折れ矢印(入ってくる側+z、ゴールへ折れる側+xの1本のL字ポリゴン)の頂点を組み立てる。
// マスからはみ出さないよう小さめに作り、外接矩形の中心をマスの中心に合わせる
function buildArrowGeometry(): THREE.BufferGeometry {
  const w = 0.08; // 脚の太さの半分
  const shaftInEnd = 0.32; // 入ってくる側の脚の先端(+z)
  const shaftOutEnd = 0.2; // ゴール側の脚の先端(矢じりの根元, +x)
  const headHalfWidth = 0.19;
  const headTip = 0.42;

  // 曲がり角で段差が出ないよう、2本の脚をどちらも中心の[-w,w]四方まで届かせて
  // 同じ正方形の角で正しく重なるようにする(縦棒・横棒どちらかだけ手前で止まらないようにする)
  const raw: [number, number][] = [
    // 入ってくる側の脚(+z方向)
    [-w, shaftInEnd],
    [w, shaftInEnd],
    [w, -w],
    [-w, -w],
    // ゴールへ折れる側の脚(+x方向)
    [-w, w],
    [shaftOutEnd, w],
    [shaftOutEnd, -w],
    [-w, -w],
    // 矢じり
    [shaftOutEnd, -headHalfWidth],
    [shaftOutEnd, headHalfWidth],
    [headTip, 0],
  ];

  const xs = raw.map(([px]) => px);
  const zs = raw.map(([, pz]) => pz);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;

  const positions = new Float32Array(raw.length * 3);
  raw.forEach(([px, pz], i) => {
    positions[i * 3] = px - cx;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = pz - cz;
  });
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** ゴールマス手前のマスに表示する、折れ曲がった矢印(このマスから自分のゴールへ折れることを示す)。
 * マス自体をその色で塗りつぶし(周回コースのCell描画側で処理)、その上に白い矢印を重ねて視認性を出す。 */
function TurnArrow({ color }: { color: Color }) {
  const [x, z] = preGoalWorldPosition(color);
  const rotationY = armRotationY(color);
  const geometry = useMemo(() => buildArrowGeometry(), []);
  return (
    <mesh geometry={geometry} position={[x, BOARD_TOP_Y + 0.06, z]} rotation={[0, rotationY, 0]}>
      <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
    </mesh>
  );
}

/** 木目調テーブル + 青い縁取りの盤面 + 周回コース/ゴールマス/待機エリアのマス目 */
export function Board3D() {
  const boardHalf = (GRID_SIZE / 2 + 0.5) * CELL_SIZE;

  return (
    <group>
      <TableTop size={boardHalf * 3.4} />

      {/* 盤面ベース(青い縁取り) */}
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry args={[boardHalf * 2 + 0.6, 0.06, boardHalf * 2 + 0.6]} />
        <meshStandardMaterial color="#1a3a8f" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[boardHalf * 2, 0.05, boardHalf * 2]} />
        <meshStandardMaterial color="#f5f0e6" roughness={0.55} />
      </mesh>

      <GridLines />

      {/* 周回コース40マス(スタートマス、および自分のゴールへ折れる手前のマスは、その色で塗りつぶす) */}
      {Array.from({ length: TRACK_LENGTH }, (_, i) => {
        const [x, z] = trackWorldPosition(i);
        const startOwner = COLORS.find((c) => i === startOffset(c));
        const preGoalOwner = COLORS.find((c) => i === (startOffset(c) - 1 + TRACK_LENGTH) % TRACK_LENGTH);
        const color = startOwner
          ? COLOR_HEX[startOwner]
          : preGoalOwner
            ? ARROW_CELL_HEX[preGoalOwner]
            : '#e8e2d0';
        return <Cell key={`track-${i}`} x={x} z={z} color={color} />;
      })}

      {/* 各色のゴールマス */}
      {COLORS.map((color) =>
        Array.from({ length: HOME_STRETCH_LENGTH }, (_, i) => {
          const [x, z] = goalWorldPosition(color, i);
          return <Cell key={`goal-${color}-${i}`} x={x} z={z} color={COLOR_HEX[color]} />;
        }),
      )}

      {/* 各色の待機エリア(4スロット) */}
      {COLORS.map((color) =>
        Array.from({ length: 4 }, (_, i) => {
          const [x, z] = yardWorldPosition(color, i);
          return <Cell key={`yard-${color}-${i}`} x={x} z={z} color={YARD_CELL_HEX[color]} size={0.7} />;
        }),
      )}

      {COLORS.map((color) => (
        <StartLabel key={`start-label-${color}`} color={color} />
      ))}
      {COLORS.map((color) => (
        <TurnArrow key={`turn-arrow-${color}`} color={color} />
      ))}
    </group>
  );
}
