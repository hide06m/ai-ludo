import { TRACK_LENGTH, absoluteTrackIndex, isOnTrack } from './board';
import type { GameState, LegalMove } from './types';

/**
 * CPUの基本戦略AI:
 * 優先度1: 相手のコマを弾き飛ばせる手があれば選ぶ
 * 優先度2: 自分のコマが次の相手ターンで弾き飛ばされるリスクを避ける
 * 優先度3: それ以外はゴールに近いコマを優先
 */
export function chooseCpuMove(state: GameState, legalMoves: LegalMove[]): LegalMove {
  if (legalMoves.length === 1) return legalMoves[0];

  const capturingMoves = legalMoves.filter((m) => m.capturesPieceId);
  if (capturingMoves.length > 0) {
    return capturingMoves.sort((a, b) => b.toStep - a.toStep)[0];
  }

  const scored = legalMoves.map((move) => ({ move, risk: estimateRisk(state, move) }));
  const minRisk = Math.min(...scored.map((s) => s.risk));
  const safest = scored.filter((s) => s.risk === minRisk).map((s) => s.move);

  return safest.sort((a, b) => b.toStep - a.toStep)[0];
}

/** 移動後の着地マスが、次の相手の1回のサイコロ(1〜6)で弾き飛ばされうるかを数える簡易リスク評価 */
function estimateRisk(state: GameState, move: LegalMove): number {
  if (!isOnTrack(move.toStep)) return 0; // ゴールマス内は安全

  const mover = state.pieces.find((p) => p.id === move.pieceId)!;
  const destIndex = absoluteTrackIndex(mover.color, move.toStep);

  let risk = 0;
  for (const opponent of state.pieces) {
    if (opponent.color === mover.color) continue;
    if (opponent.status !== 'active' || !isOnTrack(opponent.step)) continue;
    const opponentIndex = absoluteTrackIndex(opponent.color, opponent.step);
    const distance = (destIndex - opponentIndex + TRACK_LENGTH) % TRACK_LENGTH;
    if (distance >= 1 && distance <= 6) risk += 1;
  }
  return risk;
}
