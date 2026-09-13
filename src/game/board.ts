import { COLORS, type Color, type Piece } from './types';

/** 共通周回コースの総マス数 */
export const TRACK_LENGTH = 40;
/** ゴールマス(中央専用レーン)のマス数 */
export const HOME_STRETCH_LENGTH = 4;
/**
 * 1色が共通周回コース上に滞在するステップ数(0..STEPS_ON_TRACK-1)。
 * 周回コースはTRACK_LENGTHマスすべてを経由してから自分のゴールマスへ折れる
 * (最後の1マス=自分のスタートマスの手前は、他色のゴールマスへの分岐点であり、
 * ここを経由しないとゴールマスの入口に隣接しなくなる=マス飛びして見えるため)。
 */
export const STEPS_ON_TRACK = TRACK_LENGTH;
/** あがりに到達するステップ値(ゴールマス最奥) */
export const FINISH_STEP = STEPS_ON_TRACK + HOME_STRETCH_LENGTH - 1;

/** 各色が共通周回コース上のどのマスからスタートするか */
export function startOffset(color: Color): number {
  const perColor = TRACK_LENGTH / COLORS.length;
  return COLORS.indexOf(color) * perColor;
}

export function isOnTrack(step: number): boolean {
  return step >= 0 && step < STEPS_ON_TRACK;
}

export function isInGoal(step: number): boolean {
  return step >= STEPS_ON_TRACK && step <= FINISH_STEP;
}

export function isFinishStep(step: number): boolean {
  return step === FINISH_STEP;
}

/** 周回コース上のステップを、盤面全体で共通の絶対マス番号に変換する */
export function absoluteTrackIndex(color: Color, step: number): number {
  if (!isOnTrack(step)) {
    throw new Error(`step ${step} is not on the shared track`);
  }
  return (startOffset(color) + step) % TRACK_LENGTH;
}

/** 指定した絶対マス番号(周回コース)に止まっているコマを探す */
export function findPieceOnTrack(pieces: Piece[], absoluteIndex: number): Piece | undefined {
  return pieces.find(
    (p) => p.status === 'active' && isOnTrack(p.step) && absoluteTrackIndex(p.color, p.step) === absoluteIndex,
  );
}

/** 指定した色のゴールマス内の指定ステップに止まっているコマを探す(あがり済みのコマも対象) */
export function findPieceInGoal(pieces: Piece[], color: Color, step: number): Piece | undefined {
  return pieces.find((p) => p.color === color && p.status !== 'home' && p.step === step);
}

/**
 * ゴールマス内のコマが、これ以上前進できない(自分の別コマに塞がれ続けている、または
 * 既に最奥マスにいる)状態かどうかを判定する。ゴールマス4マスに4コマが詰まった状態を
 * 「あがり」とみなすための判定に使う。
 */
export function isGoalMaxed(pieces: Piece[], piece: Piece): boolean {
  if (piece.step === FINISH_STEP) return true;
  for (let s = piece.step + 1; s <= FINISH_STEP; s++) {
    if (!findPieceInGoal(pieces, piece.color, s)) return false;
  }
  return true;
}

export function createInitialPieces(): Piece[] {
  const pieces: Piece[] = [];
  for (const color of COLORS) {
    for (let i = 0; i < 4; i++) {
      pieces.push({ id: `${color}-${i}`, color, status: 'home', step: -1 });
    }
  }
  return pieces;
}
