import { WebSocketServer, type WebSocket } from 'ws';
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

const PORT = Number(process.env.PORT ?? 8787);
/** 通信切断(リロード・回線切れ等)から再接続するための猶予時間 */
const ROOM_EMPTY_GRACE_MS = 2 * 60 * 1000;

interface Client {
  /**
   * プレイヤーID。接続時ではなく、create_room/join_roomメッセージでクライアントが
   * 指定した値をそのまま採用する(ブラウザのlocalStorageに永続化されたIDを使うことで、
   * リロードや再接続後も同じ座席に戻れるようにするため)。
   */
  id: string | null;
  ws: WebSocket;
  roomCode: string | null;
}

const clients = new Map<WebSocket, Client>();

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcastRoom(room: Room) {
  const message: ServerMessage = { type: 'room_state', room: toDTO(room) };
  for (const client of clients.values()) {
    if (client.roomCode === room.code) send(client.ws, message);
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

function handleResult(client: Client, result: ActionResult) {
  if (!result.ok) {
    send(client.ws, { type: 'error', message: result.error });
    return;
  }
  broadcastRoom(result.room);
  scheduleCpuIfNeeded(result.room);
}

function handleMessage(client: Client, raw: string) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    send(client.ws, { type: 'error', message: '不正なメッセージです' });
    return;
  }

  switch (msg.type) {
    case 'create_room': {
      client.id = msg.playerId;
      const room = createRoom(client.id, msg.name.slice(0, 20), msg.rules);
      client.roomCode = room.code;
      send(client.ws, { type: 'joined', playerId: client.id, room: toDTO(room) });
      broadcastRoom(room);
      return;
    }
    case 'join_room': {
      client.id = msg.playerId;
      const result = joinRoom(msg.roomCode, client.id, msg.name.slice(0, 20));
      if (!result.ok) {
        send(client.ws, { type: 'error', message: result.error });
        return;
      }
      client.roomCode = result.room.code;
      send(client.ws, { type: 'joined', playerId: client.id, room: toDTO(result.room) });
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
        send(client.ws, { type: 'error', message: 'まだ部屋に参加していません' });
        return;
      }
      const room = findRoom(client.roomCode);
      if (!room) {
        send(client.ws, { type: 'error', message: '部屋が見つかりません' });
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
      if (isRoomEmpty(room)) {
        deleteRoom(room.code);
      } else {
        broadcastRoom(room);
        scheduleCpuIfNeeded(room);
      }
      return;
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const client: Client = { id: null, ws, roomCode: null };
  clients.set(ws, client);

  ws.on('message', (data) => handleMessage(client, data.toString()));

  ws.on('close', () => {
    clients.delete(ws);
    if (client.roomCode && client.id) {
      const room = findRoom(client.roomCode);
      if (room) {
        disconnectPlayer(room, client.id);
        broadcastRoom(room);
        scheduleCpuIfNeeded(room);
        scheduleRoomCleanup(room);
      }
    }
  });
});

console.log(`[ai-ludo server] listening on ws://localhost:${PORT}`);
