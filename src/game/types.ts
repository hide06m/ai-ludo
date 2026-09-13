export type Color = 'red' | 'blue' | 'yellow' | 'green';

export const COLORS: Color[] = ['red', 'blue', 'yellow', 'green'];

/** コマ出しルール */
export type StartRule = 'startDice3' | 'startDice1' | 'noDice';
/** ブロックルール */
export type BlockRule = 'on' | 'off';
/** ゴール条件ルール */
export type GoalRule = 'exact' | 'overOk';
/** ゲーム終了条件ルール */
export type EndRule = 'allRanked' | 'firstWins';

export interface Rules {
  startRule: StartRule;
  blockRule: BlockRule;
  goalRule: GoalRule;
  endRule: EndRule;
}

export type PieceStatus = 'home' | 'active' | 'finished';

export interface Piece {
  id: string;
  color: Color;
  status: PieceStatus;
  /**
   * home: -1
   * active: 0..FINISH_STEP (0..50 は共通周回コース、51..54 はゴールマス内)
   * finished: FINISH_STEP に固定
   */
  step: number;
}

export interface LegalMove {
  pieceId: string;
  fromStep: number;
  toStep: number;
  /** この移動で弾き飛ばす相手コマのID（あれば） */
  capturesPieceId?: string;
}

export type TurnPhase = 'awaiting_roll' | 'awaiting_move' | 'finished';

export interface StartPhaseState {
  attemptsLeft: number;
}

export interface GameState {
  /** ターン順(常に4色フル参加) */
  players: Color[];
  pieces: Piece[];
  currentPlayerIndex: number;
  rules: Rules;
  phase: TurnPhase;
  /** 直近にロールしたサイコロの目(移動待ちの場合に使用) */
  dice: number | null;
  /** 直近に出た目そのもの(dice表示用)。パスや連続ロールでdiceがnullに戻された後も、
   * サイコロの見た目を最後に出た目のまま保持するために使う */
  lastRoll: number | null;
  /** startRuleが3回/1回のとき、場にコマがない状態での再挑戦回数管理 */
  startPhase: StartPhaseState | null;
  /** ゴール順(allRanked用)。firstWinsの場合は最初の1人が入った時点でfinished */
  rankings: Color[];
  winner: Color | null;
  log: string[];
}
