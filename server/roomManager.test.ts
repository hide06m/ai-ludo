import { describe, expect, it } from 'vitest';
import type { Rules } from '../src/game/types';
import {
  advanceCpuTurn,
  createRoom,
  disconnectPlayer,
  isCpuTurn,
  isRoomEmpty,
  joinRoom,
  move,
  roll,
  selectColor,
  setRules,
  startGame,
  toDTO,
  type Room,
} from './roomManager';

const rules: Rules = {
  startRule: 'noDice',
  blockRule: 'off',
  goalRule: 'exact',
  endRule: 'allRanked',
};

function makeRoom(): Room {
  return createRoom('host-1', 'ホスト', rules);
}

describe('createRoom / joinRoom', () => {
  it('ホストが1人だけの部屋を作る', () => {
    const room = makeRoom();
    expect(room.phase).toBe('lobby');
    expect(room.players.size).toBe(1);
    expect(room.hostId).toBe('host-1');
  });

  it('存在しない部屋コードへの参加は失敗する', () => {
    const result = joinRoom('ZZZZ', 'guest-1', 'ゲスト');
    expect(result.ok).toBe(false);
  });

  it('参加すると人数が増える', () => {
    const room = makeRoom();
    const result = joinRoom(room.code, 'guest-1', 'ゲスト');
    expect(result.ok).toBe(true);
    expect(room.players.size).toBe(2);
  });

  it('4人を超えると参加できない', () => {
    const room = makeRoom();
    joinRoom(room.code, 'p2', 'p2');
    joinRoom(room.code, 'p3', 'p3');
    joinRoom(room.code, 'p4', 'p4');
    const result = joinRoom(room.code, 'p5', 'p5');
    expect(result.ok).toBe(false);
  });

  it('開始後に新規プレイヤーは参加できない', () => {
    const room = makeRoom();
    selectColor(room, 'host-1', 'red');
    startGame(room, 'host-1');
    const result = joinRoom(room.code, 'guest-1', 'ゲスト');
    expect(result.ok).toBe(false);
  });

  it('同じplayerIdでの再参加(再接続)は、開始後でも座席・色を保ったまま復帰できる', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'host-1', 'red');
    selectColor(room, 'guest-1', 'blue');
    startGame(room, 'host-1');

    disconnectPlayer(room, 'guest-1');
    expect(room.players.get('guest-1')?.connected).toBe(false);

    const result = joinRoom(room.code, 'guest-1', 'ゲスト');
    expect(result.ok).toBe(true);
    const guest = room.players.get('guest-1');
    expect(guest?.connected).toBe(true);
    expect(guest?.color).toBe('blue'); // 色は保持される
  });
});

describe('selectColor', () => {
  it('他人が選んだ色は選べない', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'host-1', 'red');
    const result = selectColor(room, 'guest-1', 'red');
    expect(result.ok).toBe(false);
  });

  it('開始後は色を変更できない', () => {
    const room = makeRoom();
    selectColor(room, 'host-1', 'red');
    startGame(room, 'host-1');
    const result = selectColor(room, 'host-1', 'blue');
    expect(result.ok).toBe(false);
  });
});

describe('setRules / startGame', () => {
  it('ホスト以外はルールを変更できない', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    const result = setRules(room, 'guest-1', { ...rules, blockRule: 'on' });
    expect(result.ok).toBe(false);
  });

  it('ホスト以外は開始できない', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'guest-1', 'blue');
    const result = startGame(room, 'guest-1');
    expect(result.ok).toBe(false);
  });

  it('誰も色を選んでいないと開始できない', () => {
    const room = makeRoom();
    const result = startGame(room, 'host-1');
    expect(result.ok).toBe(false);
  });

  it('誰か1人でも色を選べば開始でき、game状態が生成される', () => {
    const room = makeRoom();
    selectColor(room, 'host-1', 'red');
    const result = startGame(room, 'host-1');
    expect(result.ok).toBe(true);
    expect(room.phase).toBe('playing');
    expect(room.game).not.toBeNull();
  });
});

describe('roll / move', () => {
  function startedRoom(): Room {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'host-1', 'red');
    selectColor(room, 'guest-1', 'blue');
    startGame(room, 'host-1');
    return room;
  }

  it('自分の手番でない場合はrollできない', () => {
    const room = startedRoom();
    // noDiceルールでredが自動的にコマを出しているので、現在の手番はred(host-1)
    const result = roll(room, 'guest-1');
    expect(result.ok).toBe(false);
  });

  it('自分の手番ならrollできる', () => {
    const room = startedRoom();
    const result = roll(room, 'host-1');
    expect(result.ok).toBe(true);
    expect(room.game?.dice).not.toBeNull();
  });

  it('自分の手番でない場合はmoveできない', () => {
    const room = startedRoom();
    roll(room, 'host-1');
    const result = move(room, 'guest-1', 'red-0');
    expect(result.ok).toBe(false);
  });

  it('選べないコマは指定できない', () => {
    const room = startedRoom();
    roll(room, 'host-1');
    const result = move(room, 'host-1', 'blue-0'); // 自分のコマではない
    expect(result.ok).toBe(false);
  });

  it('合法な手ならmoveできる', () => {
    const room = startedRoom();
    roll(room, 'host-1');
    const result = move(room, 'host-1', 'red-0');
    expect(result.ok).toBe(true);
  });
});

describe('isCpuTurn / advanceCpuTurn', () => {
  it('色が誰にも割り当てられていない場合はCPUの手番と判定する', () => {
    const room = makeRoom();
    selectColor(room, 'host-1', 'red');
    startGame(room, 'host-1'); // blue/yellow/greenは誰も座っていない

    expect(isCpuTurn(room)).toBe(false); // 現在はredの手番(host-1が担当)
    // 手番をblue(誰も座っていない色)に直接進めて判定する
    room.game = { ...room.game!, currentPlayerIndex: room.game!.players.indexOf('blue') };
    expect(isCpuTurn(room)).toBe(true);
  });

  it('切断済みの人間プレイヤーの手番もCPU扱いになる', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'host-1', 'red');
    selectColor(room, 'guest-1', 'blue');
    startGame(room, 'host-1');

    // 手番をblue(guest-1が担当)に直接進めてから切断させる
    room.game = { ...room.game!, currentPlayerIndex: room.game!.players.indexOf('blue') };
    expect(isCpuTurn(room)).toBe(false); // まだ接続中なのでCPU扱いではない

    disconnectPlayer(room, 'guest-1');
    expect(isCpuTurn(room)).toBe(true);
  });

  it('advanceCpuTurnはawaiting_rollの手番でロールする(ログが1行以上増える)', () => {
    const room = makeRoom();
    selectColor(room, 'host-1', 'red');
    startGame(room, 'host-1');
    const beforeLogLength = room.game!.log.length;
    expect(room.game!.phase).toBe('awaiting_roll');

    advanceCpuTurn(room);
    // 出た目次第でawaiting_move/次の色のawaiting_rollのどちらにも遷移しうるため、
    // 出た目に依存しない不変条件(ロールした事実がログに残る)で判定する
    expect(room.game!.log.length).toBeGreaterThan(beforeLogLength);
  });

  it('advanceCpuTurnはawaiting_moveの手番で合法手を選んで実際にコマを動かす', () => {
    const room = makeRoom();
    selectColor(room, 'host-1', 'red');
    startGame(room, 'host-1');
    // 合法手が1つしかない状態を直接組み立てる(乱数に依存しないようにするため)
    room.game = {
      ...room.game!,
      phase: 'awaiting_move',
      dice: 3,
      pieces: room.game!.pieces.map((p) => (p.id === 'red-0' ? { ...p, status: 'active' as const, step: 0 } : p)),
    };

    advanceCpuTurn(room);
    const red0 = room.game!.pieces.find((p) => p.id === 'red-0')!;
    expect(red0.step).toBe(3);
  });
});

describe('disconnectPlayer / isRoomEmpty', () => {
  it('ロビー中に切断すると座席から削除され、ホストなら次の人に引き継がれる', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    disconnectPlayer(room, 'host-1');
    expect(room.players.has('host-1')).toBe(false);
    expect(room.hostId).toBe('guest-1');
  });

  it('対戦中に切断しても座席と色は保たれる(connectedのみfalseになる)', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'host-1', 'red');
    selectColor(room, 'guest-1', 'blue');
    startGame(room, 'host-1');

    disconnectPlayer(room, 'guest-1');
    const guest = room.players.get('guest-1');
    expect(guest).toBeDefined();
    expect(guest?.connected).toBe(false);
    expect(guest?.color).toBe('blue');
  });

  it('全員切断するとisRoomEmptyがtrueになる', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'host-1', 'red');
    selectColor(room, 'guest-1', 'blue');
    startGame(room, 'host-1');

    expect(isRoomEmpty(room)).toBe(false);
    disconnectPlayer(room, 'host-1');
    disconnectPlayer(room, 'guest-1');
    expect(isRoomEmpty(room)).toBe(true);
  });
});

describe('toDTO', () => {
  it('ホスト判定・座席情報を正しく変換する', () => {
    const room = makeRoom();
    joinRoom(room.code, 'guest-1', 'ゲスト');
    selectColor(room, 'host-1', 'red');
    const dto = toDTO(room);
    expect(dto.roomCode).toBe(room.code);
    expect(dto.players.find((p) => p.id === 'host-1')?.isHost).toBe(true);
    expect(dto.players.find((p) => p.id === 'guest-1')?.isHost).toBe(false);
    expect(dto.players.find((p) => p.id === 'host-1')?.color).toBe('red');
    expect(dto.game).toBeNull();
  });
});

