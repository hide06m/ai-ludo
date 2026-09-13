import { absoluteTrackIndex, createInitialPieces, findPieceOnTrack, isGoalMaxed, isInGoal } from './board';
import { getLegalMoves } from './moves';
import { COLORS, type Color, type GameState, type LegalMove, type Rules } from './types';

function randomDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function currentColor(state: GameState): Color {
  return state.players[state.currentPlayerIndex];
}

function maxStartAttempts(rules: Rules): number {
  return rules.startRule === 'startDice3' ? 3 : 1;
}

function needsStartPhase(state: GameState, color: Color): boolean {
  if (state.rules.startRule === 'noDice') return false;
  const pieces = state.pieces.filter((p) => p.color === color);
  const hasActive = pieces.some((p) => p.status === 'active');
  const hasHome = pieces.some((p) => p.status === 'home');
  return !hasActive && hasHome;
}

/** 場にコマがない状態(noDiceルール)で自動的にコマをスタートマスへ出す */
function autoExitIfNoDice(state: GameState, color: Color): GameState {
  if (state.rules.startRule !== 'noDice') return state;
  const pieces = state.pieces.filter((p) => p.color === color);
  const hasActive = pieces.some((p) => p.status === 'active');
  const homePiece = pieces.find((p) => p.status === 'home');
  if (hasActive || !homePiece) return state;

  const absIndex = absoluteTrackIndex(color, 0);
  const occupant = findPieceOnTrack(state.pieces, absIndex);
  const newPieces = state.pieces.map((p) => {
    if (p.id === homePiece.id) return { ...p, status: 'active' as const, step: 0 };
    if (occupant && p.id === occupant.id) return { ...p, status: 'home' as const, step: -1 };
    return p;
  });
  const log = [...state.log, `${color}のコマがスタートマスに出ました${occupant ? `(${occupant.color}を弾き飛ばした)` : ''}`];
  return { ...state, pieces: newPieces, log };
}

/** currentPlayerIndexで示されるプレイヤーのターンを開始する(noDice自動処理・startPhase初期化) */
function beginTurn(state: GameState): GameState {
  const color = currentColor(state);
  let next = autoExitIfNoDice(state, color);
  const startPhase = needsStartPhase(next, color) ? { attemptsLeft: maxStartAttempts(next.rules) } : null;
  next = { ...next, phase: 'awaiting_roll', dice: null, startPhase };
  return next;
}

export function createInitialState(rules: Rules, startingPlayerIndex = 0): GameState {
  const state: GameState = {
    players: COLORS,
    pieces: createInitialPieces(),
    currentPlayerIndex: startingPlayerIndex,
    rules,
    phase: 'awaiting_roll',
    dice: null,
    lastRoll: null,
    startPhase: null,
    rankings: [],
    winner: null,
    log: [],
  };
  return beginTurn(state);
}

function isColorFullyFinished(state: GameState, color: Color): boolean {
  return state.pieces.filter((p) => p.color === color).every((p) => p.status === 'finished');
}

function passTurn(state: GameState): GameState {
  if (state.phase === 'finished') return state;
  const n = state.players.length;
  let nextIndex = state.currentPlayerIndex;
  for (let i = 0; i < n; i++) {
    nextIndex = (nextIndex + 1) % n;
    const color = state.players[nextIndex];
    if (state.rules.endRule === 'allRanked' && isColorFullyFinished(state, color)) continue;
    break;
  }
  const next = { ...state, currentPlayerIndex: nextIndex };
  return beginTurn(next);
}

export function rollDice(state: GameState, diceValue?: number): GameState {
  if (state.phase !== 'awaiting_roll') return state;
  const color = currentColor(state);

  if (state.startPhase) {
    const roll = diceValue ?? randomDice();
    const log = [...state.log, `${color}のスタートダイス: ${roll}`];
    let next: GameState = { ...state, log, dice: roll, lastRoll: roll };

    if (roll === 6) {
      const pieces = next.pieces.filter((p) => p.color === color);
      const homePiece = pieces.find((p) => p.status === 'home')!;
      const absIndex = absoluteTrackIndex(color, 0);
      const occupant = findPieceOnTrack(next.pieces, absIndex);
      const newPieces = next.pieces.map((p) => {
        if (p.id === homePiece.id) return { ...p, status: 'active' as const, step: 0 };
        if (occupant && p.id === occupant.id) return { ...p, status: 'home' as const, step: -1 };
        return p;
      });
      next = {
        ...next,
        pieces: newPieces,
        startPhase: null,
        phase: 'awaiting_roll',
        dice: null,
        log: [...next.log, `${color}のコマがスタートマスに出ました${occupant ? `(${occupant.color}を弾き飛ばした)` : ''}`],
      };
      return next;
    }

    const attemptsLeft = state.startPhase.attemptsLeft - 1;
    if (attemptsLeft > 0) {
      return { ...next, startPhase: { attemptsLeft } };
    }
    return passTurn({ ...next, log: [...next.log, `${color}はスタートできずパス`] });
  }

  const roll = diceValue ?? randomDice();
  const withDice: GameState = {
    ...state,
    dice: roll,
    lastRoll: roll,
    log: [...state.log, `${color}がサイコロを振った: ${roll}`],
  };
  const legal = getLegalMoves(withDice, color, roll);

  if (legal.length === 0) {
    return passTurn({ ...withDice, log: [...withDice.log, `${color}は動かせるコマがなくパス`] });
  }

  return { ...withDice, phase: 'awaiting_move' };
}

export function getCurrentLegalMoves(state: GameState): LegalMove[] {
  if (state.phase !== 'awaiting_move' || state.dice == null) return [];
  return getLegalMoves(state, currentColor(state), state.dice);
}

export function selectMove(state: GameState, pieceId: string): GameState {
  if (state.phase !== 'awaiting_move') return state;
  const color = currentColor(state);
  const legal = getCurrentLegalMoves(state);
  const move = legal.find((m) => m.pieceId === pieceId);
  if (!move) return state;

  let pieces = state.pieces.map((p) => {
    if (p.id === move.pieceId) {
      return { ...p, status: 'active' as const, step: move.toStep };
    }
    if (move.capturesPieceId && p.id === move.capturesPieceId) {
      return { ...p, status: 'home' as const, step: -1 };
    }
    return p;
  });

  // ゴールマス内でこれ以上前進できない(最奥、または自分の別コマに塞がれ続けている)コマを
  // 「あがり」として確定する。ゴールマス4マスに4コマが詰まった状態で全てあがりとなる。
  const newlyFinishedIds: string[] = [];
  pieces = pieces.map((p) => {
    if (p.color !== color || p.status !== 'active' || !isInGoal(p.step)) return p;
    if (isGoalMaxed(pieces, p)) {
      newlyFinishedIds.push(p.id);
      return { ...p, status: 'finished' as const };
    }
    return p;
  });

  let log = [...state.log, `${color}が${pieceId}を${move.fromStep}→${move.toStep}に移動`];
  if (move.capturesPieceId) {
    log = [...log, `${move.capturesPieceId}が弾き飛ばされてスタートに戻った`];
  }
  for (const finishedId of newlyFinishedIds) {
    log = [...log, `${finishedId}があがりました`];
  }

  let next: GameState = { ...state, pieces, log, dice: null };

  if (isColorFullyFinished(next, color)) {
    if (next.rules.endRule === 'firstWins') {
      return { ...next, phase: 'finished', winner: color, rankings: [...next.rankings, color] };
    }
    if (!next.rankings.includes(color)) {
      const rankings = [...next.rankings, color];
      next = { ...next, rankings };
      const remaining = next.players.filter((c) => !rankings.includes(c));
      if (remaining.length <= 1) {
        const finalRankings = remaining.length === 1 ? [...rankings, remaining[0]] : rankings;
        return { ...next, phase: 'finished', winner: finalRankings[0], rankings: finalRankings };
      }
    }
  }

  // 6の目のボーナスは、その色がまだあがりきっていない場合のみ与える
  // (全員あがった直後の色にまで追加ロールを与えると、あがったはずの色がその後も
  // サイコロを振り続けてパスするだけの状態になってしまう)
  if (state.dice === 6 && !isColorFullyFinished(next, color)) {
    return { ...next, phase: 'awaiting_roll' };
  }
  return passTurn(next);
}
