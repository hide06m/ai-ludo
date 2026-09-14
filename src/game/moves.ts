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
  if (rawStep >= FINISH_STEP && state.rules.goalRule === 'overOk') {
    // 大きい目でもOK: 残り数以上の目が出た場合(ちょうど最奥に届く場合も含む)、
    // 最奥から順に、自分の別コマ(あがり済み含む)に塞がれていない一番奥のマスを探して進む
    // (ちょうど最奥に届く出目でも、そこが自分の別コマで塞がっていれば手前の空きマスまで進める。
    //  ここをrawStep > FINISH_STEPだけに限定していたため、ぴったり最奥に届く出目のときだけ
    //  この救済が働かず、塞がっていると本来動けるはずなのにパス扱いになるバグがあった)
    let candidate = FINISH_STEP;
    while (candidate > piece.step && findPieceInGoal(state.pieces, piece.color, candidate)) {
      candidate--;
    }
    if (candidate <= piece.step) return undefined; // 空いているマスがない
    toStep = candidate;
  } else if (rawStep > FINISH_STEP) {
    return undefined; // ピッタリでないと動けない(goalRule=exact)
  } else {
    toStep = rawStep;
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
  } else {
    // ゴールマス内: 自分の別コマが既に止まっているマスには止まれない(相手は存在しえない)
    const occupant = findPieceInGoal(state.pieces, piece.color, toStep);
    if (occupant && occupant.id !== piece.id) return undefined;
  }

  return { pieceId: piece.id, fromStep: piece.step, toStep, capturesPieceId };
}
