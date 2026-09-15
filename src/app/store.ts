import { create } from 'zustand';
import { playSfx } from '../audio/sounds';
import { chooseCpuMove } from '../game/ai';
import { createInitialState, getCurrentLegalMoves, rollDice, selectMove } from '../game/turn';
import type { Color, GameState, Rules } from '../game/types';
import { clearLastSession, getClientId, loadLastSession, saveLastSession } from '../net/clientId';
import { OnlineClient, type OnlineConnectionStatus } from '../net/onlineClient';
import type { RoomStateDTO, ServerMessage } from '../net/protocol';

export type Screen = 'title' | 'rules' | 'colorSelect' | 'onlineLobby' | 'onlineRoom' | 'game' | 'result';
export type Mode = 'cpu' | 'online';

export const DEFAULT_RULES: Rules = {
  startRule: 'startDice3',
  blockRule: 'off',
  goalRule: 'exact',
  endRule: 'allRanked',
};

/** 直近の弾き飛ばし情報。UI側で「移動先マスに到着するまでは弾かれて見えない」演出の遅延に使う */
export interface LastCapture {
  pieceId: string;
  fromStep: number;
  /** 弾き飛ばした側(動かした)コマのID。到着を検知して弾かれたコマの表示を切り替えるために使う */
  moverId: string;
  atMs: number;
  delayMs: number;
}

interface OnlineState {
  client: OnlineClient | null;
  status: OnlineConnectionStatus;
  playerId: string | null;
  room: RoomStateDTO | null;
  error: string | null;
}

const INITIAL_ONLINE_STATE: OnlineState = {
  client: null,
  status: 'closed',
  playerId: null,
  room: null,
  error: null,
};

/** オンライン対戦で、サーバーの状態更新から検出した「直近に動いたコマ」。到着検知で移動音を鳴らすのに使う */
export interface RemoteMove {
  pieceId: string;
  atMs: number;
}

interface AppStore {
  screen: Screen;
  mode: Mode;
  rules: Rules;
  humanColor: Color;
  game: GameState | null;
  lastCapture: LastCapture | null;
  remoteMove: RemoteMove | null;
  online: OnlineState;

  goTo: (screen: Screen) => void;
  setRules: (rules: Rules) => void;
  startGame: (humanColor: Color) => void;
  roll: () => void;
  move: (pieceId: string) => void;
  backToTitle: () => void;

  connectOnlineCreate: (name: string, rules: Rules) => void;
  connectOnlineJoin: (roomCode: string, name: string) => void;
  reconnectOnline: () => boolean;
  selectOnlineColor: (color: Color) => void;
  setOnlineRules: (rules: Rules) => void;
  startOnlineGame: () => void;
  leaveOnline: () => void;
  clearOnlineError: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  screen: 'title',
  mode: 'cpu',
  rules: DEFAULT_RULES,
  humanColor: 'red',
  game: null,
  lastCapture: null,
  remoteMove: null,
  online: INITIAL_ONLINE_STATE,

  goTo: (screen) => set({ screen }),

  setRules: (rules) => set({ rules }),

  startGame: (humanColor) => {
    const game = createInitialState(get().rules);
    set({ mode: 'cpu', humanColor, game, screen: 'game', lastCapture: null });
  },

  roll: () => {
    const { mode, online } = get();
    if (mode === 'online') {
      online.client?.send({ type: 'roll' });
      return;
    }
    const { game } = get();
    if (!game) return;
    const before = game;
    const next = rollDice(before);
    // コマ出しルールにより自動でコマがスタートマスに出た際の弾き飛ばしも同様に遅延させる
    const moverId = next.pieces.find((p) => {
      if (p.status !== 'active') return false;
      const b = before.pieces.find((q) => q.id === p.id);
      return b?.status === 'home';
    })?.id;
    const lastCapture = moverId ? detectCapture(before, next, moverId) : null;

    if (next.currentPlayerIndex !== before.currentPlayerIndex) {
      // パスなどで手番が相手に移る場合、出た目を確認する間もなく手番とサイコロの色が
      // 切り替わってしまわないよう、一呼吸置いてから実際の手番交代を反映する
      const shown: GameState = {
        ...before,
        phase: 'awaiting_move',
        dice: null,
        lastRoll: next.lastRoll,
        log: next.log,
      };
      set({ game: shown, lastCapture });
      setTimeout(() => {
        if (get().game === shown) {
          set({ game: next });
        }
      }, 700);
    } else {
      set({ game: next, lastCapture });
    }
    maybeFinish(set, next);
  },

  move: (pieceId) => {
    const { mode, online } = get();
    if (mode === 'online') {
      online.client?.send({ type: 'move', pieceId });
      return;
    }
    const { game } = get();
    if (!game) return;
    const before = game;
    const next = selectMove(before, pieceId);
    if (next === before) return;

    const lastCapture = detectCapture(before, next, pieceId);
    set({ game: next, lastCapture });
    playNewFinishChime(before, next);
    playNewRankSounds(before, next);
    maybeFinish(set, next);
  },

  backToTitle: () => {
    get().online.client?.disconnect();
    set({ screen: 'title', mode: 'cpu', game: null, lastCapture: null, online: INITIAL_ONLINE_STATE });
  },

  connectOnlineCreate: (name, rules) => {
    get().online.client?.disconnect();
    const playerId = getClientId();
    const client: OnlineClient = new OnlineClient(
      (message) => handleServerMessage(set, get, message),
      (status) => {
        set((s) => ({ online: { ...s.online, status } }));
        if (status === 'open') client.send({ type: 'create_room', playerId, name, rules });
        if (status === 'closed') scheduleAutoReconnect(get);
      },
    );
    set({ mode: 'online', game: null, lastCapture: null, online: { ...INITIAL_ONLINE_STATE, client, status: 'connecting' } });
    client.connect();
  },

  connectOnlineJoin: (roomCode, name) => {
    get().online.client?.disconnect();
    const playerId = getClientId();
    const client: OnlineClient = new OnlineClient(
      (message) => handleServerMessage(set, get, message),
      (status) => {
        set((s) => ({ online: { ...s.online, status } }));
        if (status === 'open') client.send({ type: 'join_room', playerId, roomCode, name });
        if (status === 'closed') scheduleAutoReconnect(get);
      },
    );
    // game/lastCapture/online.room/online.playerIdはあえてリセットしない: これは新規参加
    // (その時点でどうせ全てnull)と、不意の切断からの自動再接続(進行中のgame/roomをそのまま
    // 保持し、再接続完了までの間もゲーム画面が「対局データなし」で真っ白にならないようにする)
    // の両方から呼ばれるため
    set((s) => ({
      mode: 'online',
      online: { ...INITIAL_ONLINE_STATE, client, status: 'connecting', room: s.online.room, playerId: s.online.playerId },
    }));
    client.connect();
  },

  reconnectOnline: () => {
    const session = loadLastSession();
    if (!session) return false;
    get().connectOnlineJoin(session.roomCode, session.name);
    return true;
  },

  selectOnlineColor: (color) => get().online.client?.send({ type: 'select_color', color }),
  setOnlineRules: (rules) => get().online.client?.send({ type: 'set_rules', rules }),
  startOnlineGame: () => get().online.client?.send({ type: 'start_game' }),

  leaveOnline: () => {
    const { online } = get();
    online.client?.send({ type: 'leave_room' });
    online.client?.disconnect();
    clearLastSession();
    set({ mode: 'cpu', screen: 'title', game: null, lastCapture: null, online: INITIAL_ONLINE_STATE });
  },

  clearOnlineError: () => set((s) => ({ online: { ...s.online, error: null } })),
}));

/**
 * beforeとnextを比較し、moverId以外のコマがactive→homeへ変化していれば弾き飛ばしとみなし、
 * 「動かしたコマが到着するまで遅延させる」ための情報を組み立てる。
 */
function detectCapture(before: GameState, next: GameState, moverId: string): LastCapture | null {
  const capturedPiece = next.pieces.find((p) => {
    if (p.id === moverId || p.status !== 'home') return false;
    const b = before.pieces.find((q) => q.id === p.id);
    return b?.status === 'active';
  });
  if (!capturedPiece) return null;

  const moverBefore = before.pieces.find((p) => p.id === moverId)!;
  const moverAfter = next.pieces.find((p) => p.id === moverId)!;
  // 移動したコマが何マス分ホップするか(ホップ演出の所要時間の見積もりに使う)。
  // home→activeの場合はホップせずグライドするだけなので、短い固定時間にする。
  const delayMs =
    moverBefore.status === 'home'
      ? 320
      : Math.min(1400, Math.max(220, (moverAfter.step - moverBefore.step) * 190));
  const capturedBefore = before.pieces.find((p) => p.id === capturedPiece.id)!;
  return { pieceId: capturedPiece.id, fromStep: capturedBefore.step, moverId, atMs: Date.now(), delayMs };
}

/**
 * オンライン対戦でサーバーから届いたGameStateスナップショット同士を比較し、
 * 「今回のサーバー側の更新でどのコマが動いたか」を推定する。
 * (ローカルでrollDice/selectMoveを呼ばないため、pieceIdを直接知る手段がない)
 * ホームから出て自陣マスに弾き飛ばされたコマ自体は「動かした側」ではないので除外する。
 */
function detectMoverId(before: GameState, next: GameState): string | undefined {
  const beforeById = new Map(before.pieces.map((p) => [p.id, p] as const));
  const moved = next.pieces.find((p) => {
    const b = beforeById.get(p.id);
    if (!b) return false;
    if (b.status === 'active' && p.status === 'home') return false; // 弾き飛ばされた側
    return b.step !== p.step || (b.status === 'home' && p.status === 'active');
  });
  return moved?.id;
}

/**
 * WebSocket接続が(意図した退室ではなく)不意に切れた場合、少し待ってから
 * 直前と同じ部屋への再接続を自動で試みる。モバイル回線の切り替えや、
 * サーバー側のハートビートによる切断検知(server/index.ts参照)などで、
 * 見た目上は繋がっているのに実際には通信できていない状態になった際、
 * ユーザーが手動で「前回の部屋に再接続する」を押さなくても復帰できるようにする。
 */
function scheduleAutoReconnect(get: () => AppStore) {
  setTimeout(() => {
    const s = get();
    // 既にleaveOnline/backToTitleでmodeが変わっていれば、意図した退室なので何もしない。
    // 既に別の接続試行が始まっている(statusがclosed以外)場合も何もしない
    if (s.mode !== 'online' || s.online.status !== 'closed') return;
    s.reconnectOnline();
  }, 1500);
}

/**
 * 1〜3位が新たに確定した分だけ拍手を鳴らす(順位が下がるほど、鳴らす長さを1秒ずつ短くする)。
 * 3位が確定した手番では、残り1人になった4位も同時にrankingsへ確定される仕様上、
 * before→nextでrankingsが1手で2件以上一気に増える(2件→4件)ことがあるため、
 * 新たに埋まった順位を1件ずつ辿って判定する(1件ずつの増分を前提にしない)。
 * この判定はコンポーネントのuseEffectではなくストア側で行う。3位確定と同時に
 * ゲーム終了・結果画面への遷移も起きるため、GameScreenがその場でアンマウントされ
 * useEffectが実行されないまま消えてしまうケースがあったため。
 */
function playNewRankSounds(before: GameState, next: GameState) {
  for (let rank = before.rankings.length + 1; rank <= next.rankings.length; rank++) {
    if (rank <= 3) {
      playSfx('victory', { fadeOutAfterMs: 3000 - (rank - 1) * 1000 });
    }
  }
}

/**
 * 「あがりました」のチャイムを、新たに追加されたログ行から判定して鳴らす。
 * 最後の1コマの「あがり」がそのままゲーム終了(結果画面への遷移)と同じ手で
 * 起きる場合があり、rankと同じ理由でGameScreen側のuseEffectでは検知できないため
 * ここで判定する。
 */
function playNewFinishChime(before: GameState, next: GameState) {
  const newLines = next.log.slice(before.log.length);
  if (newLines.some((line) => line.includes('あがりました'))) {
    playSfx('finish');
  }
}

function maybeFinish(set: (partial: Partial<AppStore>) => void, game: GameState) {
  if (game.phase === 'finished') {
    set({ screen: 'result' });
  }
}

/**
 * サーバーから届いたroom_state/joinedメッセージを反映する。
 * オンライン対戦では盤面の状態は常にサーバーが正であり、クライアントは受け取った
 * GameStateをそのまま表示するだけ(ローカルでrollDice/selectMoveを呼ばない)。
 */
function handleServerMessage(
  set: (updater: (state: AppStore) => Partial<AppStore>) => void,
  get: () => AppStore,
  message: ServerMessage,
) {
  switch (message.type) {
    case 'joined': {
      const me = message.room.players.find((p) => p.id === message.playerId);
      if (me) saveLastSession({ roomCode: message.room.roomCode, name: me.name });
      set((s) => {
        const room = message.room;
        // 対戦中の部屋に再接続した場合はロビーではなくゲーム画面に直接戻す
        const screen = room.phase === 'playing' && room.game ? (room.game.phase === 'finished' ? 'result' : 'game') : 'onlineRoom';
        const myColor = room.players.find((p) => p.id === message.playerId)?.color ?? s.humanColor;
        return {
          online: { ...s.online, playerId: message.playerId, room, error: null },
          game: room.game ?? s.game,
          humanColor: myColor,
          screen,
        };
      });
      return;
    }
    case 'room_state':
      set((s) => {
        const room = message.room;
        const myColor = room.players.find((p) => p.id === s.online.playerId)?.color ?? s.humanColor;
        let screen = s.screen;
        if (room.phase === 'playing' && room.game) {
          screen = room.game.phase === 'finished' ? 'result' : 'game';
        } else if (room.phase === 'lobby' && (s.screen === 'game' || s.screen === 'result')) {
          screen = 'onlineRoom';
        }

        // サーバーから届いた新旧のGameStateを比較し、CPU対戦と同じ「到着タイミングで
        // 効果音を鳴らす」仕組みに乗せられるよう、動いたコマ・弾き飛ばしを検出する
        let lastCapture = s.lastCapture;
        let remoteMove = s.remoteMove;
        if (s.game && room.game && s.game !== room.game) {
          const moverId = detectMoverId(s.game, room.game);
          if (moverId) {
            remoteMove = { pieceId: moverId, atMs: Date.now() };
            lastCapture = detectCapture(s.game, room.game, moverId);
          }
        }

        if (s.game && room.game) {
          playNewFinishChime(s.game, room.game);
          playNewRankSounds(s.game, room.game);
        }

        return {
          online: { ...s.online, room, error: null },
          game: room.game ?? s.game,
          humanColor: myColor,
          lastCapture,
          remoteMove,
          screen,
        };
      });
      return;
    case 'error':
      if (message.code === 'room_not_found' && get().online.room) {
        // 部屋自体がサーバー上から破棄されている(長時間の通信断などで)。
        // これ以上リトライしても無駄なので、自動再接続ループに入らないよう
        // タイトルへ戻し、セッション情報も消す。何も言わずに画面が切り替わるだけだと
        // ユーザーが混乱するため、理由をはっきり伝える。
        // ただし、まだ一度も部屋に入れていない(=部屋に入る画面でコードを
        // 間違えただけ)場合はここに該当させず、下の分岐でその場にエラー表示する
        get().online.client?.disconnect();
        clearLastSession();
        set(() => ({ mode: 'cpu', screen: 'title', game: null, lastCapture: null, online: INITIAL_ONLINE_STATE }));
        if (typeof window !== 'undefined') {
          window.alert('この部屋は既に終了しているため、タイトルへ戻りました。もう一度部屋を作り直してください。');
        }
        return;
      }
      set((s) => {
        // まだ一度も部屋に入れていない状態でのエラーは、再接続情報が古くなっている
        // (部屋が既に無い等)可能性が高いため、次回の再接続候補として案内しないよう消しておく
        if (!s.online.room) clearLastSession();
        return { online: { ...s.online, error: message.message } };
      });
      return;
  }
}

/** CPUの手番なら合法手からAIが選択し、そのpieceIdを返す(UI側でmoveを呼び出す) */
export function pickCpuPieceId(game: GameState): string | undefined {
  const legal = getCurrentLegalMoves(game);
  if (legal.length === 0) return undefined;
  return chooseCpuMove(game, legal).pieceId;
}
