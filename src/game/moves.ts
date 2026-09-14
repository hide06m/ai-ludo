import { FINISH_STEP, STEPS_ON_TRACK, absoluteTrackIndex, findPieceInGoal, findPieceOnTrack, isOnTrack } from './board';
import type { Color, GameState, LegalMove, Piece } from './types';

/**
 * 現在のプレイヤー(color)が、指定のサイコロの目(dice)で行える合法手を全て算出する。
 * 「場にコマがない」状態での特殊スタートダイスフェーズはここでは扱わない(turn.ts側で処理)。
 */
export function getLegalMoves(state: GameState, color: Color, dice: number): LegalMove[] {
  const moves: LegalMove[] = [];
  const myPieces = state.pieces.filter((p) => p.color === color);

  for (const piece of myPieces) {
    if (piece.status === 'finished') continue;

    if (piece.status === 'home') {
      const exitMove = getHomeExitMove(state.pieces, piece, dice);
      if (exitMove) moves.push(exitMove);
      continue;
    }

    const move = getActivePieceMove(state, piece, dice);
    if (move) moves.push(move);
  }

  return moves;
}

function getHomeExitMove(allPieces: Piece[], piece: Piece, dice: number): LegalMove | undefined {
  if (dice !== 6) return undefined;
  const startStep = 0;
  const absIndex = absoluteTrackIndex(piece.color, startStep);
  const occupant = findPieceOnTrack(allPieces, absIndex);
  if (occupant && occupant.color === piece.color) return undefined; // 自分のコマがスタートマスにいる
  return {
    pieceId: piece.id,
    fromStep: -1,
    toStep: startStep,
    capturesPieceId: occupant ? occupant.id : undefined,
  };
}

function getActivePieceMove(state: GameState, piece: Piece, dice: number): LegalMove | undefined {
  const rawStep = piece.step + dice;
  let toStep: number;
  if (rawStep > FINISH_STEP) {
    if (state.rules.goalRule === 'exact') return undefined; // ピッタリでないと動けない
    toStep = FINISH_STEP; // 大きい目でもOK: 出目で届く上限(=最奥)を仮の着地点にし、下で空きマスを探す
  } else {
    toStep = rawStep;
  }

  if (!isOnTrack(toStep)) {
    // ゴールマス内: 自分の別コマ(あがり済み含む)が既に止まっているマスには止まれない。
    // goalRule=overOkの場合は、そこより手前(出目で届く範囲内=toStep以下)に空いているマスが
    // あれば、そこまで進んであがれる。残りマス数にぴったり一致する出目でなくても、
    // またオーバーする出目でなくても、動ける分だけ進められるようにする
    // (例: 最奥3マスが自コマで埋まっていて、矢印マスの手前のコマが2〜6のどれを出しても、
    //  唯一空いている一番外側のゴールマスまで進んであがれる)
    while (toStep > piece.step && findPieceInGoal(state.pieces, piece.color, toStep)) {
      if (state.rules.goalRule !== 'overOk') return undefined;
      toStep--;
    }
    if (toStep <= piece.step) return undefined; // 空いているマスがない、または進めない
  }

  if (state.rules.blockRule === 'on' && isOnTrack(piece.step)) {
    // ゴールへ折れ込む移動でも、そこに至るまでに通過する共通コース上のマスは
    // ブロック判定の対象にする(ゴールに入るからといって相手コマを飛び越えられるわけではない)
    const lastTrackStep = Math.min(toStep - 1, STEPS_ON_TRACK - 1);
    for (let s = piece.step + 1; s <= lastTrackStep; s++) {
      const midIndex = absoluteTrackIndex(piece.color, s);
      const midOccupant = findPieceOnTrack(state.pieces, midIndex);
      if (midOccupant && midOccupant.color !== piece.color) {
        return undefined; // 相手コマに阻まれて通過できない
      }
    }
  }

  let capturesPieceId: string | undefined;

  if (isOnTrack(toStep)) {
    const destIndex = absoluteTrackIndex(piece.color, toStep);
    const occupant = findPieceOnTrack(state.pieces, destIndex);
    if (occupant) {
      if (occupant.color === piece.color) return undefined; // 自分のコマには止まれない
      capturesPieceId = occupant.id;
    }
  }
  // ゴールマス内の着地先が自分の別コマで塞がれていないことは、上の空きマス探索で
  // 既に保証されている(相手コマがゴールマスに存在することはない)

  return { pieceId: piece.id, fromStep: piece.step, toStep, capturesPieceId };
}
