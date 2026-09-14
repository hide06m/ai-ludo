import { chooseCpuMove } from '../src/game/ai';
import { createInitialState, currentColor, getCurrentLegalMoves, rollDice, selectMove } from '../src/game/turn';
import { COLORS, type Color, type GameState, type Rules } from '../src/game/types';
import type { RoomPhase, RoomStateDTO } from '../src/net/protocol';

interface RoomPlayerInternal {
  id: string;
  name: string;
  color: Color | null;
  connected: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  rules: Rules;
  phase: RoomPhase;
  players: Map<string, RoomPlayerInternal>;
  game: GameState | null;
  /** 空席(CPU)の手番を進めるための遅延タイマー */
  cpuTimer: ReturnType<typeof setTimeout> | null;
  /** 全員切断中に、再接続の猶予を待ってから部屋を破棄するためのタイマー */
  emptyTimer: ReturnType<typeof setTimeout> | null;
}

export type ActionResult =
  | { ok: true; room: Room }
  | { ok: false; error: string; code?: 'room_not_found' };

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい0/O/1/Iを除外
const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join(
      '',
    );
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostId: string, hostName: string, rules: Rules): Room {
  const code = generateRoomCode();
  const room: Room = {
    code,
    hostId,
    rules,
    phase: 'lobby',
    players: new Map([[hostId, { id: hostId, name: hostName, color: null, connected: true }]]),
    game: null,
    cpuTimer: null,
    emptyTimer: null,
  };
  rooms.set(code, room);
  return room;
}

export function findRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(code: string, playerId: string, name: string): ActionResult {
  const room = findRoom(code);
  if (!room) return { ok: false, error: '部屋が見つかりません', code: 'room_not_found' };

  // 既に同じplayerIdで参加済み(再接続)の場合は、進行中のゲームでも座席・色を保ったまま
  // 復帰させる(切断時にdisconnectPlayerがconnectedをfalseにするだけで座席を消さないため)
  const existing = room.players.get(playerId);
  if (existing) {
    existing.connected = true;
    if (name) existing.name = name;
    return { ok: true, room };
  }

  if (room.phase !== 'lobby') return { ok: false, error: 'このゲームはすでに開始されています' };
  if (room.players.size >= 4) return { ok: false, error: '部屋が満員です' };
  room.players.set(playerId, { id: playerId, name, color: null, connected: true });
  return { ok: true, room };
}

export function selectColor(room: Room, playerId: string, color: Color): ActionResult {
  if (room.phase !== 'lobby') return { ok: false, error: 'ゲーム開始後は色を変更できません' };
  const taken = [...room.players.values()].some((p) => p.id !== playerId && p.color === color);
  if (taken) return { ok: false, error: 'その色はすでに選ばれています' };
  const player = room.players.get(playerId);
  if (!player) return { ok: false, error: 'プレイヤーが見つかりません' };
  player.color = color;
  return { ok: true, room };
}

export function setRules(room: Room, playerId: string, rules: Rules): ActionResult {
  if (playerId !== room.hostId) return { ok: false, error: 'ホストのみルールを変更できます' };
  if (room.phase !== 'lobby') return { ok: false, error: 'ゲーム開始後はルールを変更できません' };
  room.rules = rules;
  return { ok: true, room };
}

export function startGame(room: Room, playerId: string): ActionResult {
  if (playerId !== room.hostId) return { ok: false, error: 'ホストのみ開始できます' };
  if (room.phase !== 'lobby') return { ok: false, error: 'すでに開始されています' };
  const chosenColors = [...room.players.values()].filter((p) => p.color != null);
  if (chosenColors.length === 0) return { ok: false, error: '誰も色を選んでいません' };
  room.game = createInitialState(room.rules);
  room.phase = 'playing';
  return { ok: true, room };
}

function colorOwner(room: Room, color: Color): RoomPlayerInternal | undefined {
  return [...room.players.values()].find((p) => p.color === color);
}

export function roll(room: Room, playerId: string): ActionResult {
  if (!room.game) return { ok: false, error: 'ゲームが開始されていません' };
  const player = room.players.get(playerId);
  const color = currentColor(room.game);
  if (!player || player.color !== color) return { ok: false, error: 'あなたの手番ではありません' };
  room.game = rollDice(room.game);
  return { ok: true, room };
}

export function move(room: Room, playerId: string, pieceId: string): ActionResult {
  if (!room.game) return { ok: false, error: 'ゲームが開始されていません' };
  const player = room.players.get(playerId);
  const color = currentColor(room.game);
  if (!player || player.color !== color) return { ok: false, error: 'あなたの手番ではありません' };
  const legal = getCurrentLegalMoves(room.game).some((m) => m.pieceId === pieceId);
  if (!legal) return { ok: false, error: '選べないコマです' };
  room.game = selectMove(room.game, pieceId);
  return { ok: true, room };
}

/**
 * 誰も座っていない色(CPU)の手番かどうかを判定する。
 * 対戦中に人間プレイヤーが切断した席もCPU扱いにする(disconnectPlayer参照)。
 */
export function isCpuTurn(room: Room): boolean {
  if (!room.game || room.phase !== 'playing' || room.game.phase === 'finished') return false;
  const color = currentColor(room.game);
  const owner = colorOwner(room, color);
  return !owner || !owner.connected;
}

/** CPUの手番を1手進める(ロール→合法手があればAIが選択して移動)。呼び出し側でsetTimeoutループさせる想定 */
export function advanceCpuTurn(room: Room): void {
  if (!room.game) return;
  if (room.game.phase === 'awaiting_roll') {
    room.game = rollDice(room.game);
    return;
  }
  if (room.game.phase === 'awaiting_move') {
    const legal = getCurrentLegalMoves(room.game);
    if (legal.length === 0) return;
    const chosen = chooseCpuMove(room.game, legal);
    room.game = selectMove(room.game, chosen.pieceId);
  }
}

export function disconnectPlayer(room: Room, playerId: string): void {
  const player = room.players.get(playerId);
  if (player) player.connected = false;
  if (room.phase === 'lobby') {
    // ロビー中は座席を保持する意味が薄いため削除するが、部屋自体の破棄は
    // (再接続の猶予を持たせるため)呼び出し側のisRoomEmpty判定に委ねる
    room.players.delete(playerId);
    if (room.players.size > 0 && playerId === room.hostId) {
      room.hostId = [...room.players.keys()][0];
    }
  }
}

export function isRoomEmpty(room: Room): boolean {
  return [...room.players.values()].every((p) => !p.connected);
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

export function toDTO(room: Room): RoomStateDTO {
  return {
    roomCode: room.code,
    phase: room.phase,
    rules: room.rules,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isHost: p.id === room.hostId,
      connected: p.connected,
    })),
    game: room.game,
  };
}

export const ALL_COLORS = COLORS;
