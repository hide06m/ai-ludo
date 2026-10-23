import type { ClientMessage, ServerMessage } from '../src/net/protocol';
import {
  advanceCpuTurn,
  disconnectPlayer,
  findRoom,
  isCpuTurn,
  isRoomEmpty,
  createRoom,
  deleteRoom,
  joinRoom,
  move,
  roll,
  selectColor,
  setRules,
  startGame,
  toDTO,
  type ActionResult,
  type Room,
} from './roomManager';

/** 通信切断(リロード・回線切れ等)から再接続するための猶予時間 */
const ROOM_EMPTY_GRACE_MS = 10 * 60 * 1000;

/**
 * 接続1本分の送受信口。Node.js(ws)とCloudflare Durable Objectsの両方で
 * 同じ部屋管理ロジックを使えるよう、実行環境ごとのWebSocket実装をこの形に包んで渡す。
 */
export interface Socket {
  isOpen(): boolean;
  send(data: string): void;
  /** 強制切断。closeイベント相当の処理は呼び出し側がhandleCloseで行う */
  terminate(): void;
}

export interface Client {
  /**
   * プレイヤーID。接続時ではなく、create_room/join_roomメッセージでクライアントが
   * 指定した値をそのまま採用する(ブラウザのlocalStorageに永続化されたIDを使うことで、
   * リロードや再接続後も同じ座席に戻れるようにするため)。
   */
  id: string | null;
  socket: Socket;
  roomCode: string | null;
  /** 直前のハートビート確認以降に生存の証拠(pongや任意のメッセージ)があったか */
  isAlive: boolean;
}

const clients = new Map<Socket, Client>();
/**
 * playerIdごとに「現在有効な」接続を1つだけ覚えておく。
 * 不意の切断からの再接続では、古い(実は死んでいる)接続のcloseイベントが
 * 新しい接続の確立より後に届くことがある。その場合に備えず古い接続のcloseを
 * そのまま処理してしまうと、せっかく再接続した直後にconnected=falseへ
 * 巻き戻されてしまい、CPU代行が復活して「勝手に操作が続く」ように見えるバグになる。
 * このマップと照合し、既に新しい接続に取って代わられたcloseイベントは無視する。
 */
const activeConnectionByPlayerId = new Map<string, Socket>();

function send(socket: Socket, message: ServerMessage) {
  if (socket.isOpen()) socket.send(JSON.stringify(message));
}

function broadcastRoom(room: Room) {
  const message: ServerMessage = { type: 'room_state', room: toDTO(room) };
  for (const client of clients.values()) {
    if (client.roomCode === room.code) send(client.socket, message);
  }
}

/** CPU(空席、または切断済み)の手番を、人間の手番になるかゲーム終了まで自動で進め続ける */
function scheduleCpuIfNeeded(room: Room) {
  if (room.cpuTimer) {
    clearTimeout(room.cpuTimer);
    room.cpuTimer = null;
  }
  if (!isCpuTurn(room)) return;
  room.cpuTimer = setTimeout(() => {
    room.cpuTimer = null;
    advanceCpuTurn(room);
    broadcastRoom(room);
    scheduleCpuIfNeeded(room);
  }, 700);
}

/**
 * 通信切断で全員いなくなった部屋を、再接続の猶予(ROOM_EMPTY_GRACE_MS)を待ってから破棄する。
 * 明示的な退室(leave_room)ではなく、リロードや回線切れによる不意の切断でのみ使う
 * (再接続してくる可能性があるため即座には消さない)。
 */
function scheduleRoomCleanup(room: Room) {
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }
  if (!isRoomEmpty(room)) return;
  room.emptyTimer = setTimeout(() => {
    if (isRoomEmpty(room)) deleteRoom(room.code);
  }, ROOM_EMPTY_GRACE_MS);
}

/**
 * この接続を、client.idの「現在有効な接続」として登録する。
 * 同じplayerIdの古い接続が残っていれば、それを強制的に閉じる
 * (そのcloseイベントは下のガードによりdisconnectPlayerを呼ばなくなる)。
 */
function claimConnection(client: Client) {
  if (!client.id) return;
  const previous = activeConnectionByPlayerId.get(client.id);
  if (previous && previous !== client.socket) {
    previous.terminate();
  }
  activeConnectionByPlayerId.set(client.id, client.socket);
}

function releaseConnection(client: Client) {
  if (client.id && activeConnectionByPlayerId.get(client.id) === client.socket) {
    activeConnectionByPlayerId.delete(client.id);
  }
}

function handleResult(client: Client, result: ActionResult) {
  if (!result.ok) {
    send(client.socket, { type: 'error', message: result.error });
    return;
  }
  broadcastRoom(result.room);
  scheduleCpuIfNeeded(result.room);
}

export function handleOpen(socket: Socket): Client {
  const client: Client = { id: null, socket, roomCode: null, isAlive: true };
  clients.set(socket, client);
  return client;
}

export function handleMessage(client: Client, raw: string) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    send(client.socket, { type: 'error', message: '不正なメッセージです' });
    return;
  }

  switch (msg.type) {
    case 'ping':
      send(client.socket, { type: 'pong' });
      return;
    case 'create_room': {
      client.id = msg.playerId;
      claimConnection(client);
      const room = createRoom(client.id, msg.name.slice(0, 20), msg.rules);
      client.roomCode = room.code;
      send(client.socket, { type: 'joined', playerId: client.id, room: toDTO(room) });
      broadcastRoom(room);
      return;
    }
    case 'join_room': {
      client.id = msg.playerId;
      claimConnection(client); // 同じplayerIdの古い接続があれば切り、この接続を正としてマークする
      const result = joinRoom(msg.roomCode, client.id, msg.name.slice(0, 20));
      if (!result.ok) {
        send(client.socket, { type: 'error', message: result.error, code: result.code });
        return;
      }
      client.roomCode = result.room.code;
      send(client.socket, { type: 'joined', playerId: client.id, room: toDTO(result.room) });
      broadcastRoom(result.room);
      scheduleCpuIfNeeded(result.room); // 再接続でCPU代行中だった自席を取り戻した場合、進行中のCPUループを止める
      scheduleRoomCleanup(result.room); // 再接続できたので、破棄猶予タイマーが動いていれば解除する
      return;
    }
    case 'select_color':
    case 'set_rules':
    case 'start_game':
    case 'roll':
    case 'move':
    case 'leave_room': {
      if (!client.roomCode || !client.id) {
        send(client.socket, { type: 'error', message: 'まだ部屋に参加していません' });
        return;
      }
      const room = findRoom(client.roomCode);
      if (!room) {
        send(client.socket, { type: 'error', message: '部屋が見つかりません', code: 'room_not_found' });
        return;
      }
      applyRoomAction(client, room, msg);
      return;
    }
    default:
      return;
  }
}

function applyRoomAction(
  client: Client,
  room: Room,
  msg: Extract<ClientMessage, { type: 'select_color' | 'set_rules' | 'start_game' | 'roll' | 'move' | 'leave_room' }>,
) {
  const playerId = client.id!;
  switch (msg.type) {
    case 'select_color':
      handleResult(client, selectColor(room, playerId, msg.color));
      return;
    case 'set_rules':
      handleResult(client, setRules(room, playerId, msg.rules));
      return;
    case 'start_game':
      handleResult(client, startGame(room, playerId));
      return;
    case 'roll':
      handleResult(client, roll(room, playerId));
      return;
    case 'move':
      handleResult(client, move(room, playerId, msg.pieceId));
      return;
    case 'leave_room':
      disconnectPlayer(room, playerId);
      client.roomCode = null;
      releaseConnection(client);
      if (isRoomEmpty(room)) {
        deleteRoom(room.code);
      } else {
        broadcastRoom(room);
        scheduleCpuIfNeeded(room);
      }
      return;
  }
}

export function handleClose(client: Client) {
  if (!clients.has(client.socket)) return; // 二重に届いたcloseは無視する
  clients.delete(client.socket);
  // 既に同じplayerIdの新しい接続に取って代わられている場合、このcloseイベントは
  // 古い(実質死んでいた)接続のものなので、新しい接続の状態を壊さないよう無視する
  if (client.id && activeConnectionByPlayerId.get(client.id) !== client.socket) return;
  releaseConnection(client);
  if (client.roomCode && client.id) {
    const room = findRoom(client.roomCode);
    if (room) {
      disconnectPlayer(room, client.id);
      broadcastRoom(room);
      scheduleCpuIfNeeded(room);
      scheduleRoomCleanup(room);
    }
  }
}

/**
 * ハートビート1回分。前回からの間に生存の証拠がなかった接続を切断済みとみなして閉じ、
 * 残りは次回までに証拠が届くかを見るためisAliveを倒す。
 * TCP接続が(モバイル回線の切り替えやプロキシのタイムアウトなどで)見た目上は
 * 繋がったまま中身だけ死んでいる状態を検出するためのもの。
 */
export function sweepDeadClients(onAlive: (client: Client) => void = () => {}) {
  for (const client of [...clients.values()]) {
    if (!client.isAlive) {
      client.socket.terminate();
      handleClose(client);
      continue;
    }
    client.isAlive = false;
    onAlive(client);
  }
}

export function connectionCount(): number {
  return clients.size;
}
