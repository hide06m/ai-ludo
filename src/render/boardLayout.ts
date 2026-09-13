import { HOME_STRETCH_LENGTH, STEPS_ON_TRACK, TRACK_LENGTH, startOffset } from '../game/board';
import { COLORS, type Color } from '../game/types';

/**
 * ゲームロジック層(絶対マス番号・色ごとのステップ)を3D空間上の座標に変換する、
 * レンダリング層専用のレイアウト定義。ゲームロジックには一切依存を返さない(片方向)。
 *
 * 盤面は11x11マスの十字型(classic Ludo風)。1マス=1ユニット、中心(5,5)を原点(0,0)とする。
 * 各色は4アームのうち1本を担当し、周回コース40マスは4アーム×10マスで構成される。
 */

export const CELL_SIZE = 1;
export const GRID_SIZE = 11;
const CENTER = 5; // 0..10 のうち中心インデックス

export interface GridPos {
  col: number; // 0..10
  row: number; // 0..10
}

function toWorld({ col, row }: GridPos): [number, number] {
  return [(col - CENTER) * CELL_SIZE, (row - CENTER) * CELL_SIZE];
}

// (row,col)を中心(CENTER,CENTER)周りに90度時計回り回転
const rotateCW = (p: GridPos): GridPos => ({ row: CENTER + (p.col - CENTER), col: CENTER + (CENTER - p.row) });

/**
 * 周回コース(40マス, 4アーム×10マス)のグリッド座標を生成する。
 * 赤のアームは指定座標(B8→C8→D8→E8→F8→F9→F10→F11→F12→G12, 次のH12で青に引き継ぐ)
 * に基づき、「スタート地点(自陣の隣, row5)から中心寄りの列(col5)へ右へ進み、
 * col5を先端(row1)まで上ってから隣の列(col6)へ1マス移動する」L字型の経路とする。
 * これを90度ずつ回転させて右(blue)・下(yellow)・左(green)の各アームを機械的に生成する。
 */
function buildTrackCells(): GridPos[] {
  const topArm: GridPos[] = [
    ...Array.from({ length: 5 }, (_, i) => ({ col: i, row: 4 })), // B8→F8: 右へ
    ...Array.from({ length: 4 }, (_, i) => ({ col: 4, row: 3 - i })), // F8→F12: 上へ
    { col: 5, row: 0 }, // G12
  ];

  const rightArm = topArm.map(rotateCW); // blue
  const bottomArm = rightArm.map(rotateCW); // yellow
  const leftArm = bottomArm.map(rotateCW); // green

  return [...topArm, ...rightArm, ...bottomArm, ...leftArm];
}

const TRACK_CELLS = buildTrackCells();

if (TRACK_CELLS.length !== TRACK_LENGTH) {
  throw new Error(`track cell count mismatch: ${TRACK_CELLS.length} !== ${TRACK_LENGTH}`);
}

/**
 * 各色のゴールマス(中央へ向かう専用レーン, 4マス)のグリッド座標。
 * 赤のゴールは指定座標(C7→D7→E7→F7、F7が中心に一番近い最奥)に基づき、
 * row6でcol2..5とする。これを90度ずつ回転させて残り3色分を機械的に生成する。
 */
const topGoal: GridPos[] = Array.from({ length: HOME_STRETCH_LENGTH }, (_, i) => ({ col: 1 + i, row: CENTER }));
const rightGoal = topGoal.map(rotateCW);
const bottomGoal = rightGoal.map(rotateCW);
const leftGoal = bottomGoal.map(rotateCW);

const GOAL_CELLS: Record<Color, GridPos[]> = {
  red: topGoal,
  blue: rightGoal,
  yellow: bottomGoal,
  green: leftGoal,
};

/**
 * 各色の待機エリア(自陣, 4体分のスロット)のグリッド座標。
 * 盤面四隅の5x5エリアのうち、自色の周回コースが通る1行1列(中心寄りの辺)を除いた
 * 4x4の空きエリアいっぱいに4隅へ配置し、中心に寄らずバランスよく散らす。
 */
// 4x4空きエリアの原点: 上アーム色→左上, 右アーム色→右上, 下アーム色→右下, 左アーム色→左下
const YARD_AREA_ORIGINS = [
  { col0: 0, row0: 0 }, // 左上
  { col0: 7, row0: 0 }, // 右上
  { col0: 7, row0: 7 }, // 右下
  { col0: 0, row0: 7 }, // 左下
];

function buildYardSlots(color: Color): GridPos[] {
  const o = YARD_AREA_ORIGINS[COLORS.indexOf(color)];
  // 4x4空きエリアを2x2の小ブロック4つに分け、各小ブロックの中心の交差点に配置する
  return [
    { col: o.col0 + 0.5, row: o.row0 + 0.5 },
    { col: o.col0 + 2.5, row: o.row0 + 0.5 },
    { col: o.col0 + 0.5, row: o.row0 + 2.5 },
    { col: o.col0 + 2.5, row: o.row0 + 2.5 },
  ];
}

/** 自陣4x4エリア全体の中心座標(自陣内どこをクリックしても反応させるための当たり判定に使う) */
export function yardAreaCenter(color: Color): [number, number] {
  const o = YARD_AREA_ORIGINS[COLORS.indexOf(color)];
  return toWorld({ col: o.col0 + 1.5, row: o.row0 + 1.5 });
}

const YARD_SLOTS: Record<Color, GridPos[]> = Object.fromEntries(
  COLORS.map((c) => [c, buildYardSlots(c)]),
) as Record<Color, GridPos[]>;

/** 各アームの基準(赤=0)からの回転量。rotateCWによるグリッド回転と対応するワールドY軸回転で、
 * 赤用に定義した図形をそのままこの角度だけ回せば他色のアームに正しく重なる。 */
export function armRotationY(color: Color): number {
  return -(COLORS.indexOf(color) * Math.PI) / 2;
}

/** ゴールマス手前、自分のゴールへ折れ曲がる直前の共通コースマスの3D座標 */
export function preGoalWorldPosition(color: Color): [number, number] {
  const index = (startOffset(color) - 1 + TRACK_LENGTH) % TRACK_LENGTH;
  return trackWorldPosition(index);
}

/** スタートマスに[START]文字を表示するための座標とY軸回転(文字の下側が盤の最寄りの端を向く) */
export function startLabelTransform(color: Color): { x: number; z: number; rotationY: number } {
  const [x, z] = trackWorldPosition(startOffset(color));
  return { x, z, rotationY: armRotationY(color) - Math.PI / 2 };
}

/** 周回コース上の絶対マス番号(0..TRACK_LENGTH-1)から3D座標(x,z)を得る */
export function trackWorldPosition(absoluteIndex: number): [number, number] {
  return toWorld(TRACK_CELLS[absoluteIndex]);
}

/** 色とゴールマス内ステップ(0..HOME_STRETCH_LENGTH-1)から3D座標(x,z)を得る */
export function goalWorldPosition(color: Color, goalIndex: number): [number, number] {
  return toWorld(GOAL_CELLS[color][goalIndex]);
}

/** 色と待機スロット番号(0..3)から3D座標(x,z)を得る */
export function yardWorldPosition(color: Color, slotIndex: number): [number, number] {
  return toWorld(YARD_SLOTS[color][slotIndex]);
}

/**
 * ピースのstep値(-1=home, 0..STEPS_ON_TRACK-1=周回コース, それ以降=ゴールマス)から
 * 3D座標を得る。homeの場合はyardSlotIndexで待機スロットを指定する。
 */
export function pieceWorldPosition(color: Color, step: number, yardSlotIndex: number): [number, number] {
  if (step < 0) return yardWorldPosition(color, yardSlotIndex);
  if (step < STEPS_ON_TRACK) {
    const absoluteIndex = (startOffset(color) + step) % TRACK_LENGTH;
    return trackWorldPosition(absoluteIndex);
  }
  return goalWorldPosition(color, step - STEPS_ON_TRACK);
}
