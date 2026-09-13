import type { ClientMessage, ServerMessage } from './protocol';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8787';

export type OnlineConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

const PING_INTERVAL_MS = 20_000;
const PONG_TIMEOUT_MS = 10_000;

/**
 * オンライン対戦用のWebSocketクライアント。
 * 接続状態とサーバーからのメッセージをコールバックで通知するだけの薄いラッパー
 * (状態の保持自体はapp/store.ts側のzustandストアが担う)。
 *
 * モバイル回線の切り替えやスリープ復帰などで、見た目上は繋がっているのに実際には
 * 通信できていない(TCP接続だけが死んでいる)状態になることがある。ブラウザの
 * WebSocketはping/pongフレームをJS側から観測できないため、アプリケーション層で
 * 自前のping/pongを送り合い、一定時間pongが返らなければ切断とみなして
 * 強制的にcloseする(呼び出し側のonStatusChange('closed')経由で再接続処理に繋がる)。
 */
export class OnlineClient {
  private ws: WebSocket | null = null;
  private readonly onMessage: (message: ServerMessage) => void;
  private readonly onStatusChange: (status: OnlineConnectionStatus) => void;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(onMessage: (message: ServerMessage) => void, onStatusChange: (status: OnlineConnectionStatus) => void) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    this.onStatusChange('connecting');
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.onStatusChange('open');
      this.startHeartbeat();
    };
    ws.onclose = () => {
      this.stopHeartbeat();
      this.onStatusChange('closed');
    };
    ws.onerror = () => this.onStatusChange('error');
    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return; // 不正なメッセージは無視する
      }
      if (message.type === 'pong') {
        if (this.pongTimeoutTimer) {
          clearTimeout(this.pongTimeoutTimer);
          this.pongTimeoutTimer = null;
        }
        return;
      }
      this.onMessage(message);
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
      if (this.pongTimeoutTimer) clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = setTimeout(() => {
        // pongが一定時間返ってこない = 実質的に切れている接続とみなし、強制的に閉じて
        // 呼び出し側の再接続フローに委ねる
        this.ws?.close();
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }
}
