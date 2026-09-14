import type { Color, GameState, Rules } from '../game/types';

/** ロビー(対戦開始前)での1プレイヤー情報。座席未選択の場合colorはnull */
export interface RoomPlayer {
  id: string;
  name: string;
  color: Color | null;
  isHost: boolean;
  connected: boolean;
}

export type RoomPhase = 'lobby' | 'playing' | 'finished';

/** ロビー/待機画面に表示するための部屋の状態(ゲーム進行中はgameも含む) */
export interface RoomStateDTO {
  roomCode: string;
  phase: RoomPhase;
  rules: Rules;
  players: RoomPlayer[];
  game: GameState | null;
}

export type ClientMessage =
  | { type: 'create_room'; playerId: string; name: string; rules: Rules }
  | { type: 'join_room'; playerId: string; roomCode: string; name: string }
  | { type: 'select_color'; color: Color }
  | { type: 'set_rules'; rules: Rules }
  | { type: 'start_game' }
  | { type: 'roll' }
  | { type: 'move'; pieceId: string }
  | { type: 'leave_room' }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'joined'; playerId: string; room: RoomStateDTO }
  | { type: 'room_state'; room: RoomStateDTO }
  /**
   * codeが'room_not_found'の場合、部屋自体がサーバー上に存在しない(破棄済み)ことを表す。
   * この場合はリトライしても無駄なので、クライアント側は自動再接続を諦めて
   * タイトルに戻すなど、明確にユーザーへ伝える対応をとる
   */
  | { type: 'error'; message: string; code?: 'room_not_found' }
  | { type: 'pong' };
