import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from './store';
import type { GameState, Piece, Rules } from '../game/types';

const noDiceRules: Rules = { startRule: 'noDice', blockRule: 'off', goalRule: 'exact', endRule: 'allRanked' };
const startDice1Rules: Rules = { startRule: 'startDice1', blockRule: 'off', goalRule: 'exact', endRule: 'allRanked' };

/** Math.random()の返り値から `floor(r*6)+1` で決まる出目を狙って固定する */
function mockDiceRoll(value: number) {
  const r = (value - 1) / 6 + 0.01;
  vi.spyOn(Math, 'random').mockReturnValue(r);
}

function makePieces(overrides: Record<string, Piece>): Piece[] {
  const colors = ['red', 'blue', 'yellow', 'green'] as const;
  const pieces: Piece[] = [];
  for (const c of colors) {
    for (let i = 0; i < 4; i++) {
      const id = `${c}-${i}`;
      pieces.push(overrides[id] ?? { id, color: c, status: 'home', step: -1 });
    }
  }
  return pieces;
}

describe('useAppStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('roll(): パスにならない通常の移動では手番を即座に反映する', () => {
    useAppStore.setState({ rules: noDiceRules });
    useAppStore.getState().startGame('red');

    mockDiceRoll(3);
    useAppStore.getState().roll();

    const { game } = useAppStore.getState();
    expect(game?.dice).toBe(3);
    expect(game?.lastRoll).toBe(3);
    expect(game?.currentPlayerIndex).toBe(0);
    expect(game?.phase).toBe('awaiting_move');
  });

  it('roll(): パスになる場合、出目を確認できるよう一呼吸置いてから手番を切り替える', () => {
    useAppStore.setState({ rules: startDice1Rules });
    useAppStore.getState().startGame('red');

    mockDiceRoll(2); // 6以外なのでstartDice1では即パス
    useAppStore.getState().roll();

    // 切り替え前: まだ赤の手番のまま、出目だけが見える状態
    let state = useAppStore.getState();
    expect(state.game?.currentPlayerIndex).toBe(0);
    expect(state.game?.lastRoll).toBe(2);
    expect(state.game?.log.at(-1)).toContain('パス');

    vi.advanceTimersByTime(700);

    // 切り替え後: 次のプレイヤー(青)の手番に移っている
    state = useAppStore.getState();
    expect(state.game?.currentPlayerIndex).toBe(1);
    expect(state.game?.phase).toBe('awaiting_roll');
  });

  it('move(): 弾き飛ばしを検知してlastCaptureに移動距離に応じた遅延時間を設定する', () => {
    const pieces = makePieces({
      'red-0': { id: 'red-0', color: 'red', status: 'active', step: 0 },
      'blue-0': { id: 'blue-0', color: 'blue', status: 'active', step: 36 }, // 絶対マス6でred-0の着地先と一致
    });
    const game: GameState = {
      players: ['red', 'blue', 'yellow', 'green'],
      pieces,
      currentPlayerIndex: 0,
      rules: noDiceRules,
      phase: 'awaiting_move',
      dice: 6,
      lastRoll: 6,
      startPhase: null,
      rankings: [],
      winner: null,
      log: [],
    };
    useAppStore.setState({ game, lastCapture: null, humanColor: 'red', screen: 'game' });

    useAppStore.getState().move('red-0');

    const { game: next, lastCapture } = useAppStore.getState();
    const blue0 = next?.pieces.find((p) => p.id === 'blue-0');
    expect(blue0?.status).toBe('home');
    expect(blue0?.step).toBe(-1);
    expect(lastCapture).toMatchObject({ pieceId: 'blue-0', moverId: 'red-0', fromStep: 36, delayMs: 1140 });
  });
});
