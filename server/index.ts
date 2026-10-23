import { WebSocketServer } from 'ws';
import { handleClose, handleMessage, handleOpen, sweepDeadClients, type Client } from './hub';

const PORT = Number(process.env.PORT ?? 8787);
/**
 * pingを送る間隔。前回のpingにpongが返っていなければ切断済みとみなして強制終了する
 * (判定自体はhub.tsのsweepDeadClients)。
 */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

const wss = new WebSocketServer({ port: PORT });
const pingers = new Map<Client, () => void>();

wss.on('connection', (ws) => {
  const client = handleOpen({
    isOpen: () => ws.readyState === ws.OPEN,
    send: (data) => ws.send(data),
    terminate: () => ws.terminate(),
  });
  pingers.set(client, () => ws.ping());

  ws.on('message', (data) => handleMessage(client, data.toString()));
  ws.on('pong', () => {
    client.isAlive = true;
  });
  ws.on('close', () => {
    pingers.delete(client);
    handleClose(client);
  });
});

setInterval(() => {
  sweepDeadClients((client) => pingers.get(client)?.());
}, HEARTBEAT_INTERVAL_MS);

console.log(`[ai-ludo server] listening on ws://localhost:${PORT}`);
