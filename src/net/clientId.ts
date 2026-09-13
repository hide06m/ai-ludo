/**
 * オンライン対戦用の永続クライアントID・直近セッション情報。
 * アカウント機能がないため、リロードや通信切断からの再接続を
 * 「同じブラウザから同じIDで再度join_roomする」ことで実現する。
 */
const CLIENT_ID_KEY = 'ludo_client_id';
const LAST_SESSION_KEY = 'ludo_last_session';

export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export interface LastSession {
  roomCode: string;
  name: string;
}

export function saveLastSession(session: LastSession) {
  localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
}

export function loadLastSession(): LastSession | null {
  const raw = localStorage.getItem(LAST_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastSession>;
    if (typeof parsed.roomCode !== 'string' || typeof parsed.name !== 'string') return null;
    return { roomCode: parsed.roomCode, name: parsed.name };
  } catch {
    return null;
  }
}

export function clearLastSession() {
  localStorage.removeItem(LAST_SESSION_KEY);
}
