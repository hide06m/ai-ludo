import type { ClientMessage, ServerMessage } from './protocol';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8787';

export type OnlineConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

/**
 * オンライン対戦用のWebSocketクライアント。
 * 接続状態とサーバーからのメッセージをコールバックで通知するだけの薄いラッパー
 * (状態の保持自体はapp/store.ts側のzustandストアが担う)。
 */
export class OnlineClient {
  private ws: WebSocket | null = null;
  private readonly onMessage: (message: ServerMessage) => void;
  private readonly onStatusChange: (status: OnlineConnectionStatus) => void;

  constructor(onMessage: (message: ServerMessage) => void, onStatusChange: (status: OnlineConnectionStatus) => void) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect() {
    this.onStatusChange('connecting');
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => this.onStatusChange('open');
    ws.onclose = () => this.onStatusChange('closed');
    ws.onerror = () => this.onStatusChange('error');
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        this.onMessage(message);
      } catch {
        // 不正なメッセージは無視する
      }
    };
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
