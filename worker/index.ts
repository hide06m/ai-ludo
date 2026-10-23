import { DurableObject } from 'cloudflare:workers';
import { connectionCount, handleClose, handleMessage, handleOpen, sweepDeadClients } from '../server/hub';

/**
 * Cloudflare上でのオンライン対戦サーバー。
 * 部屋の状態はserver/hub.ts・roomManager.tsがメモリ上に持つため、全接続を1つの
 * Durable Object(idFromName('global'))に集めて、Node.js版(server/index.ts)と
 * 同じ1プロセス構成を再現している。フロントエンドの静的ファイルは同じWorkerの
 * Static Assetsから配信し、/ws だけがこのWorkerを通る(wrangler.jsonc参照)。
 */

/**
 * 生存確認の間隔。ブラウザ側(onlineClient.ts)は20秒ごとにpingを送ってくるため、
 * この間に1通も届かなければ実質切れている接続とみなして閉じる。
 */
const HEARTBEAT_INTERVAL_MS = 45 * 1000;

interface Env {
  LUDO_SERVER: DurableObjectNamespace<LudoServer>;
}

export class LudoServer extends DurableObject<Env> {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    const [browserSide, serverSide] = Object.values(new WebSocketPair());
    serverSide.accept();

    const client = handleOpen({
      isOpen: () => serverSide.readyState === WebSocket.READY_STATE_OPEN,
      send: (data) => serverSide.send(data),
      terminate: () => {
        try {
          serverSide.close(1011, 'connection replaced or timed out');
        } catch {
          // 既に閉じている接続は無視する
        }
      },
    });

    serverSide.addEventListener('message', (event) => {
      // WorkersではWebSocketのping/pongフレームを観測できないため、
      // アプリ層のpingを含む任意のメッセージを生存の証拠として扱う
      client.isAlive = true;
      const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
      handleMessage(client, raw);
    });
    const onClose = () => {
      handleClose(client);
      this.stopHeartbeatIfIdle();
    };
    serverSide.addEventListener('close', onClose);
    serverSide.addEventListener('error', onClose);

    this.startHeartbeat();
    return new Response(null, { status: 101, webSocket: browserSide });
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      sweepDeadClients();
      this.stopHeartbeatIfIdle();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeatIfIdle() {
    if (this.heartbeatTimer && connectionCount() === 0) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const stub = env.LUDO_SERVER.get(env.LUDO_SERVER.idFromName('global'));
      return stub.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
