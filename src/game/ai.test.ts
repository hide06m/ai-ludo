import { describe, expect, it } from 'vitest';
import { chooseCpuMove } from './ai';
import { createInitialState } from './turn';
import type { GameState, LegalMove, Rules } from './types';

const baseRules: Rules = {
  startRule: 'noDice',
  blockRule: 'off',
  goalRule: 'exact',
  endRule: 'allRanked',
};

function withPieces(state: GameState, overrides: Partial<GameState['pieces'][number]>[]): GameState {
  const pieces = state.pieces.map((p) => {
    const o = overrides.find((x) => x.id === p.id);
    return o ? { ...p, ...o } : p;
  });
  return { ...state, pieces };
}

function baseState(overrides: Partial<GameState['pieces'][number]>[] = []): GameState {
  return withPieces(createInitialState(baseRules), overrides);
}

describe('chooseCpuMove', () => {
  it('合法手が1つしかない場合はそれをそのまま選ぶ', () => {
    const state = baseState();
    const onlyMove: LegalMove = { pieceId: 'red-0', fromStep: -1, toStep: 0 };
    expect(chooseCpuMove(state, [onlyMove])).toBe(onlyMove);
  });

  it('優先度1: 弾き飛ばせる手があれば、リスクの低い他の手より優先する', () => {
    const state = baseState([
      { id: 'red-0', color: 'red', status: 'active', step: 0 },
      { id: 'red-1', color: 'red', status: 'active', step: 0 },
    ]);
    const safeMove: LegalMove = { pieceId: 'red-0', fromStep: 0, toStep: 5 };
    const capturingMove: LegalMove = { pieceId: 'red-1', fromStep: 0, toStep: 3, capturesPieceId: 'blue-0' };
    expect(chooseCpuMove(state, [safeMove, capturingMove])).toBe(capturingMove);
  });

  it('優先度1: 弾き飛ばせる手が複数ある場合、ゴールに近い(toStepが大きい)方を選ぶ', () => {
    const state = baseState();
    const captureNear: LegalMove = { pieceId: 'red-0', fromStep: 0, toStep: 5, capturesPieceId: 'blue-0' };
    const captureFar: LegalMove = { pieceId: 'red-1', fromStep: 0, toStep: 10, capturesPieceId: 'blue-1' };
    expect(chooseCpuMove(state, [captureNear, captureFar])).toBe(captureFar);
  });

  it('優先度2: 弾き飛ばせる手がない場合、次の相手ターンで弾かれるリスクが低い手を選ぶ', () => {
    // blue-0はabsoluteIndex6にいるため、destIndex10(距離4)は次のターンに弾かれうるが、destIndex20は安全
    const state = baseState([{ id: 'blue-0', color: 'blue', status: 'active', step: 36 }]);
    const riskyMove: LegalMove = { pieceId: 'red-0', fromStep: 0, toStep: 10 };
    const safeMove: LegalMove = { pieceId: 'red-1', fromStep: 0, toStep: 20 };
    expect(chooseCpuMove(state, [riskyMove, safeMove])).toBe(safeMove);
  });

  it('優先度3: リスクが同等の場合はゴールに近い(toStepが大きい)手を選ぶ', () => {
    const state = baseState();
    const nearMove: LegalMove = { pieceId: 'red-0', fromStep: 0, toStep: 5 };
    const farMove: LegalMove = { pieceId: 'red-1', fromStep: 0, toStep: 15 };
    expect(chooseCpuMove(state, [nearMove, farMove])).toBe(farMove);
  });

  it('ゴールマス内への移動はリスク評価の対象外(常に安全)として扱う', () => {
    // yellow-0(絶対マス0)はoutMoveの着地マス(絶対マス3)を次ターンの目3で狙えるためoutMoveはリスクあり。
    // 一方intoGoalMoveはゴールマス内(isOnTrackがfalseの範囲)への移動のため、相手の位置に関係なく安全とみなされる
    const state = baseState([{ id: 'yellow-0', color: 'yellow', status: 'active', step: 20 }]);
    const outMove: LegalMove = { pieceId: 'red-0', fromStep: 0, toStep: 3 };
    const intoGoalMove: LegalMove = { pieceId: 'red-1', fromStep: 38, toStep: 41 };
    expect(chooseCpuMove(state, [outMove, intoGoalMove])).toBe(intoGoalMove);
  });
});
