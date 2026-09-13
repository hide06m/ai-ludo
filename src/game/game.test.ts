import { describe, expect, it } from 'vitest';
import { FINISH_STEP, TRACK_LENGTH, absoluteTrackIndex, startOffset } from './board';
import { getLegalMoves } from './moves';
import { createInitialState, currentColor, rollDice, selectMove } from './turn';
import type { GameState, Rules } from './types';

const baseRules: Rules = {
  startRule: 'noDice',
  blockRule: 'on',
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

describe('createInitialState', () => {
  it('全コマがhomeで始まる(noDiceルールは自動でスタートマスに1つ出る)', () => {
    const state = createInitialState(baseRules);
    const redPieces = state.pieces.filter((p) => p.color === 'red');
    expect(redPieces.filter((p) => p.status === 'active')).toHaveLength(1);
    expect(redPieces.filter((p) => p.status === 'home')).toHaveLength(3);
    expect(state.phase).toBe('awaiting_roll');
  });
});

describe('startRule: noDiceでないルール', () => {
  it('startDice3で6が出るまでパスせず、3回とも失敗するとパスする', () => {
    let state = createInitialState({ ...baseRules, startRule: 'startDice3' });
    expect(currentColor(state)).toBe('red');
    state = rollDice(state, 2);
    expect(currentColor(state)).toBe('red');
    state = rollDice(state, 3);
    expect(currentColor(state)).toBe('red');
    state = rollDice(state, 4);
    // 3回失敗 -> 次のプレイヤーへ
    expect(currentColor(state)).toBe('blue');
  });

  it('startDice1で6が出れば場に出て、そのまま通常ロールに進める', () => {
    let state = createInitialState({ ...baseRules, startRule: 'startDice1' });
    state = rollDice(state, 6);
    const redActive = state.pieces.filter((p) => p.color === 'red' && p.status === 'active');
    expect(redActive).toHaveLength(1);
    expect(state.phase).toBe('awaiting_roll');
    expect(currentColor(state)).toBe('red');
  });
});

describe('コマの移動', () => {
  it('通常の移動で合法手が算出される', () => {
    let state = createInitialState(baseRules);
    state = rollDice(state, 3);
    const moves = getLegalMoves(state, 'red', 3);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('相手のコマに止まると弾き飛ばす', () => {
    // noDiceだと弾き飛ばされた直後に青のターンで自動的に再度スタートに出てしまい検証しづらいため、
    // startDice3ルールでこのケースを検証する
    let state = createInitialState({ ...baseRules, startRule: 'startDice3' });
    state = rollDice(state, 6); // redを場に出す
    const redStart = absoluteTrackIndex('red', 0);
    // blueのabsoluteTrackIndexがredStart+2になるようblueのstepを逆算
    const blueStep = ((redStart + 2 - startOffset('blue')) % TRACK_LENGTH + TRACK_LENGTH) % TRACK_LENGTH;
    state = withPieces(state, [{ id: 'blue-0', status: 'active', step: blueStep } as never]);
    state = rollDice(state, 2);
    state = selectMove(state, 'red-0');
    const blue0 = state.pieces.find((p) => p.id === 'blue-0')!;
    expect(blue0.status).toBe('home');
    expect(blue0.step).toBe(-1);
  });

  it('blockRule=onのとき相手コマを飛び越えられない', () => {
    let state = createInitialState({ ...baseRules, blockRule: 'on' });
    const redStart = absoluteTrackIndex('red', 0);
    // redの1マス先にblueを配置(ブロック)
    const blueStep = ((redStart + 1 - startOffset('blue')) % TRACK_LENGTH + TRACK_LENGTH) % TRACK_LENGTH;
    state = withPieces(state, [{ id: 'blue-0', status: 'active', step: blueStep } as never]);
    state = { ...state, phase: 'awaiting_roll', dice: null };
    state = rollDice(state, 3); // ブロックされているマスを飛び越える動き
    const moves = getLegalMoves(state, 'red', 3);
    expect(moves.find((m) => m.pieceId === 'red-0')).toBeUndefined();
  });

  it('blockRule=offなら相手コマを素通りできる(ピッタリでない限り弾き飛ばさない)', () => {
    let state = createInitialState({ ...baseRules, blockRule: 'off' });
    const redStart = absoluteTrackIndex('red', 0);
    const blueStep = ((redStart + 1 - startOffset('blue')) % TRACK_LENGTH + TRACK_LENGTH) % TRACK_LENGTH;
    state = withPieces(state, [{ id: 'blue-0', status: 'active', step: blueStep } as never]);
    state = { ...state, phase: 'awaiting_roll', dice: null };
    const moves = getLegalMoves({ ...state, dice: 3 }, 'red', 3);
    const move = moves.find((m) => m.pieceId === 'red-0');
    expect(move).toBeDefined();
    expect(move?.capturesPieceId).toBeUndefined();
  });

  it('goalRule=exactではオーバーする目で動かせない', () => {
    let state = createInitialState(baseRules);
    state = withPieces(state, [{ id: 'red-0', status: 'active', step: FINISH_STEP - 1 } as never]);
    const moves = getLegalMoves({ ...state, dice: 3 }, 'red', 3);
    expect(moves.find((m) => m.pieceId === 'red-0')).toBeUndefined();
  });

  it('goalRule=overOkではオーバーする目でもあがれる', () => {
    let state = createInitialState({ ...baseRules, goalRule: 'overOk' });
    state = withPieces(state, [{ id: 'red-0', status: 'active', step: FINISH_STEP - 1 } as never]);
    const moves = getLegalMoves({ ...state, dice: 3 }, 'red', 3);
    const move = moves.find((m) => m.pieceId === 'red-0');
    expect(move?.toStep).toBe(FINISH_STEP);
  });

  it('6を出すと同じプレイヤーが続けてサイコロを振れる', () => {
    let state = createInitialState(baseRules);
    state = rollDice(state, 6);
    state = selectMove(state, getCurrentMovablePieceId(state));
    expect(currentColor(state)).toBe('red');
    expect(state.phase).toBe('awaiting_roll');
  });

  it('6以外を出すとターンが相手に渡る', () => {
    let state = createInitialState(baseRules);
    state = rollDice(state, 3);
    state = selectMove(state, getCurrentMovablePieceId(state));
    expect(currentColor(state)).toBe('blue');
  });

  it('動かせるコマがない場合はパスする', () => {
    let state = createInitialState({ ...baseRules, startRule: 'noDice' });
    // redの唯一のactiveコマをhomeに戻し、home状態のみにする(dice!=6なら動かせない)
    state = withPieces(state, [{ id: 'red-0', status: 'home', step: -1 } as never]);
    state = rollDice(state, 3);
    expect(currentColor(state)).toBe('blue');
  });
});

function getCurrentMovablePieceId(state: GameState): string {
  const moves = getLegalMoves(state, currentColor(state), state.dice!);
  return moves[0].pieceId;
}

describe('ゴールマス内の複数コマ', () => {
  it('先に最奥にいる自分のコマには止まれないが、飛び越えて進める', () => {
    let state = createInitialState(baseRules);
    state = withPieces(state, [
      { id: 'red-0', status: 'active', step: FINISH_STEP } as never,
      { id: 'red-1', status: 'active', step: FINISH_STEP - 3 } as never,
    ]);
    const moves = getLegalMoves({ ...state, dice: 3 }, 'red', 3);
    // ちょうどFINISH_STEPに重なる目は自分のコマがいるため無効
    expect(moves.find((m) => m.pieceId === 'red-1')).toBeUndefined();
  });

  it('overOkでは最奥が塞がっていれば、その手前の空きマスまで進んであがる', () => {
    let state = createInitialState({ ...baseRules, goalRule: 'overOk' });
    state = withPieces(state, [
      { id: 'red-0', status: 'finished', step: FINISH_STEP } as never,
      { id: 'red-1', status: 'active', step: FINISH_STEP - 2 } as never,
    ]);
    // dice=3: FINISH_STEP-2+3 = FINISH_STEP+1 でオーバーシュート。最奥(FINISH_STEP)はred-0が
    // 占有しているため、その手前(FINISH_STEP-1)まで進んであがる。
    const moves = getLegalMoves({ ...state, dice: 3 }, 'red', 3);
    const move = moves.find((m) => m.pieceId === 'red-1');
    expect(move?.toStep).toBe(FINISH_STEP - 1);
  });

  it('自分の別コマに完全に塞がれて前進できなくなったコマがいると合法手がなくパスする', () => {
    let state = createInitialState(baseRules);
    state = withPieces(state, [
      { id: 'red-0', status: 'active', step: FINISH_STEP } as never,
      { id: 'red-1', status: 'active', step: FINISH_STEP - 1 } as never,
    ]);
    state = { ...state, phase: 'awaiting_roll', dice: null };
    state = rollDice(state, 1); // red-1はFINISH_STEPをred-0に塞がれ動けず、red-0も動けないためパス
    expect(currentColor(state)).toBe('blue');
  });

  it('ゴールマス4マスに4コマが詰まると、その色は全員あがり(fullyFinished)になる', () => {
    let state = createInitialState(baseRules);
    state = withPieces(state, [
      { id: 'red-0', status: 'active', step: FINISH_STEP } as never,
      { id: 'red-1', status: 'active', step: FINISH_STEP - 1 } as never,
      { id: 'red-2', status: 'active', step: FINISH_STEP - 2 } as never,
      { id: 'red-3', status: 'active', step: FINISH_STEP - 5 } as never,
    ]);
    state = { ...state, phase: 'awaiting_roll', dice: null };
    state = rollDice(state, 2); // red-3がFINISH_STEP-3(唯一の空きマス)にちょうど到達する
    state = selectMove(state, 'red-3');
    const red3 = state.pieces.find((p) => p.id === 'red-3')!;
    expect(red3.step).toBe(FINISH_STEP - 3);
    expect(red3.status).toBe('finished'); // これ以上前進できない(手前以外は全て自分のコマ)ためあがり扱い
    // 同時に処理されるred-0〜red-2も、これ以上進めないためあがり済みになっている
    expect(state.pieces.find((p) => p.id === 'red-0')!.status).toBe('finished');
    expect(state.pieces.find((p) => p.id === 'red-1')!.status).toBe('finished');
    expect(state.pieces.find((p) => p.id === 'red-2')!.status).toBe('finished');
  });
});

describe('ブロックルール × ゴールへの折れ込み', () => {
  it('ブロックありの場合、ゴールへ入る手前の共通コース上に相手コマがいると通過できず動かせない', () => {
    let state = createInitialState(baseRules); // baseRulesはblockRule: 'on'
    state = withPieces(state, [
      { id: 'red-0', status: 'active', step: 35 } as never,
      { id: 'blue-0', status: 'active', step: 27 } as never, // 絶対マス37(red-0が通過する経路)に位置する
    ]);
    // dice=6: 35+6=41(ゴールマス内)へ折れ込むが、経路上の絶対マス37に相手コマがいるため通過できない
    const moves = getLegalMoves({ ...state, dice: 6 }, 'red', 6);
    expect(moves.find((m) => m.pieceId === 'red-0')).toBeUndefined();
  });

  it('ブロックなしの場合、同じ配置でも相手コマを飛び越えてゴールへ入れる', () => {
    let state = createInitialState({ ...baseRules, blockRule: 'off' });
    state = withPieces(state, [
      { id: 'red-0', status: 'active', step: 35 } as never,
      { id: 'blue-0', status: 'active', step: 27 } as never,
    ]);
    const moves = getLegalMoves({ ...state, dice: 6 }, 'red', 6);
    const move = moves.find((m) => m.pieceId === 'red-0');
    expect(move?.toStep).toBe(41);
  });

  it('ブロックありでも、経路上に相手コマがいなければゴールへ入れる', () => {
    let state = createInitialState(baseRules);
    state = withPieces(state, [{ id: 'red-0', status: 'active', step: 35 } as never]);
    const moves = getLegalMoves({ ...state, dice: 6 }, 'red', 6);
    const move = moves.find((m) => m.pieceId === 'red-0');
    expect(move?.toStep).toBe(41);
  });
});

describe('全員あがり後の手番処理(6の目ボーナス)', () => {
  it('overOkで最後のコマが6の目(オーバー)であがっても、あがった色に追加ロールを与えず次の色へ手番を渡す', () => {
    let state = createInitialState({ ...baseRules, goalRule: 'overOk' });
    state = withPieces(state, [
      { id: 'red-0', status: 'finished', step: FINISH_STEP } as never,
      { id: 'red-1', status: 'finished', step: FINISH_STEP - 1 } as never,
      { id: 'red-2', status: 'finished', step: FINISH_STEP - 2 } as never,
      { id: 'red-3', status: 'active', step: FINISH_STEP - 5 } as never, // dice=6でFINISH_STEPを超える(唯一の空きマスFINISH_STEP-3へ)
    ]);
    state = { ...state, phase: 'awaiting_roll', dice: null };
    state = rollDice(state, 6); // オーバーする目だがoverOkのため唯一の空きマス(FINISH_STEP-3)へ進める
    expect(state.phase).toBe('awaiting_move');
    state = selectMove(state, 'red-3');
    const red3 = state.pieces.find((p) => p.id === 'red-3')!;
    expect(red3.status).toBe('finished'); // 4コマ目もあがり、redは全員あがり
    // 6の目を出してあがったが、redは既に全員あがっているため追加ロールは与えられず、次の色(blue)の手番になる
    expect(currentColor(state)).toBe('blue');
  });

  it('通常の6の目ボーナス(あがっていない色)は従来通り同じ色にもう一度ロールさせる', () => {
    let state = createInitialState(baseRules);
    state = withPieces(state, [{ id: 'red-0', status: 'active', step: 10 } as never]);
    state = { ...state, phase: 'awaiting_roll', dice: null };
    state = rollDice(state, 6);
    state = selectMove(state, 'red-0');
    expect(currentColor(state)).toBe('red'); // まだ全員あがっていないので6のボーナスは有効
    expect(state.phase).toBe('awaiting_roll');
  });
});
