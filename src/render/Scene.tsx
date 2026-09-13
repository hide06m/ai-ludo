import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useState } from 'react';
import { Board3D } from './Board3D';
import { Piece3D } from './Piece3D';
import { Dice3D } from './Dice3D';
import { pieceWorldPosition, yardAreaCenter } from './boardLayout';
import { currentColor } from '../game/turn';
import { COLORS, type GameState, type LegalMove } from '../game/types';

interface SceneProps {
  game: GameState;
  diceRolling: boolean;
  selectablePieceIds: Set<string>;
  /** 選択可能なコマにカーソルを当てた際、移動先マスをプレビュー表示するために使う */
  legalMoves: LegalMove[];
  /** 弾き飛ばされたコマを、動かしたコマが到着するまで元の位置に留めて表示するための一時的な上書き */
  captureOverride?: { pieceId: string; fromStep: number; moverId: string } | null;
  /** captureOverride発生時、実際に弾き飛ばしたコマ(到着検知の対象)のID */
  moverPieceId?: string;
  /** moverPieceIdのコマが目標マスへ実際に到着した際に呼ばれる */
  onMoverArrived?: () => void;
  /** 直近に動かしたコマ(移動音のタイミング検知の対象)のID */
  pendingMovePieceId?: string | null;
  /** pendingMovePieceIdのコマが目標マスへ実際に到着した際に呼ばれる(移動音の再生に使う) */
  onPieceArrived?: (pieceId: string) => void;
  onSelectPiece: (pieceId: string) => void;
  onDiceClick?: () => void;
}

/**
 * 画面の縦横比(特にスマホの縦長画面)に合わせてカメラの初期距離を調整し、
 * 盤面全体が画面内に収まるようにする。Canvasのcameraプロパティは初回生成時のみ
 * 使われるため、マウント時点のwindowサイズから一度だけ計算する。
 */
function getInitialCameraPosition(): [number, number, number] {
  if (typeof window === 'undefined') return [0, 14.5, 11.3];
  const aspect = window.innerWidth / window.innerHeight;
  const scale = aspect < 1 ? Math.min(1.8, 1 / aspect) : 1;
  return [0, 14.5 * scale, 11.3 * scale];
}

export function Scene({
  game,
  diceRolling,
  selectablePieceIds,
  legalMoves,
  captureOverride,
  moverPieceId,
  onMoverArrived,
  pendingMovePieceId,
  onPieceArrived,
  onSelectPiece,
  onDiceClick,
}: SceneProps) {
  // ホバー中の自コマがどの敵コマを弾けるかを追跡し、その敵コマにも目印を表示する
  const [hoveredPieceId, setHoveredPieceId] = useState<string | null>(null);
  const threatenedPieceId = hoveredPieceId
    ? legalMoves.find((m) => m.pieceId === hoveredPieceId)?.capturesPieceId
    : undefined;

  // 6の目で自陣からコマを出せる場合、自陣のどこをクリックしても反応するようにする
  const homeExitByColor = new Map(
    COLORS.map((c) => {
      const piece = game.pieces.find((p) => p.color === c && p.status === 'home' && selectablePieceIds.has(p.id));
      return [c, piece] as const;
    }),
  );

  return (
    <Canvas shadows camera={{ position: getInitialCameraPosition(), fov: 42 }}>
      <color attach="background" args={['#151515']} />
      <ambientLight intensity={0.4} />
      {/* キーライト: 主光源。影を落とす */}
      <directionalLight
        position={[6, 11, 4]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
      >
        <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 0.1, 30]} />
      </directionalLight>
      {/* フィルライト: 主光源と反対側から弱く当て、影を潰しすぎないようにする */}
      <directionalLight position={[-7, 6, -5]} intensity={0.35} color="#cfe0ff" />
      {/* リムライト: 盤面奥からの逆光でコマの輪郭を際立たせる */}
      <pointLight position={[0, 5, -8]} intensity={0.3} color="#fff3d6" />
      <Board3D />
      {game.pieces.map((p) => {
        // 待機スロットは自分のコマ番号(id末尾の数字)で固定し、他のコマの出入りで並び替わらないようにする
        const slotIndex = Number(p.id.split('-')[1]);
        // 弾き飛ばされた直後は、動かした側のコマが到着するまで元のマスに留めて表示する
        const displayStep = captureOverride?.pieceId === p.id ? captureOverride.fromStep : p.step;
        const [x, z] = pieceWorldPosition(p.color, displayStep, slotIndex);
        const isSelectable = selectablePieceIds.has(p.id);
        const move = isSelectable ? legalMoves.find((m) => m.pieceId === p.id) : undefined;
        const previewTarget = move ? pieceWorldPosition(p.color, move.toStep, 0) : undefined;
        const needsArrivalCallback = p.id === moverPieceId || p.id === pendingMovePieceId;
        return (
          <Piece3D
            key={p.id}
            color={p.color}
            step={displayStep}
            x={x}
            z={z}
            selected={isSelectable}
            previewTarget={previewTarget}
            finished={p.status === 'finished'}
            threatened={p.id === threatenedPieceId}
            onHoverChange={isSelectable ? (h) => setHoveredPieceId(h ? p.id : null) : undefined}
            onArrived={
              needsArrivalCallback
                ? () => {
                    if (p.id === moverPieceId) onMoverArrived?.();
                    if (p.id === pendingMovePieceId) onPieceArrived?.(p.id);
                  }
                : undefined
            }
            onClick={isSelectable ? () => onSelectPiece(p.id) : undefined}
          />
        );
      })}
      {COLORS.map((c) => {
        const homePiece = homeExitByColor.get(c);
        if (!homePiece) return null;
        const [cx, cz] = yardAreaCenter(c);
        return (
          <mesh
            key={`yard-click-${c}`}
            position={[cx, 0.02, cz]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPiece(homePiece.id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'auto';
            }}
          >
            <planeGeometry args={[4, 4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}
      <group position={[0, 0.4, 0]}>
        <Dice3D value={game.lastRoll} rolling={diceRolling} color={currentColor(game)} onClick={onDiceClick} />
      </group>
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
        minDistance={9}
        maxDistance={26}
        minPolarAngle={Math.PI / 7}
        maxPolarAngle={Math.PI / 2.3}
      />
    </Canvas>
  );
}
