import { useEffect, useMemo, useRef, useState } from 'react';
import { pickCpuPieceId, useAppStore } from '../app/store';
import { playSfx, startBgm, stopBgm } from '../audio/sounds';
import { RulesInfoButton } from '../components/RulesInfoButton';
import { SoundToggleButton } from '../components/SoundToggleButton';
import { currentColor, getCurrentLegalMoves } from '../game/turn';
import { COLORS, type Color } from '../game/types';
import { COLOR_HEX } from '../render/colors';
import { Scene } from '../render/Scene';

const COLOR_LABEL: Record<Color, string> = { red: '赤', blue: '青', yellow: '黄', green: '緑' };
const LOG_HISTORY_LIMIT = 30;

/** ログ行の先頭にある色名(またはcolor-Nのコマid)から、行頭に添える色を判定する */
function detectLogColor(line: string): Color | undefined {
  return COLORS.find((c) => line.startsWith(c));
}

export function GameScreen() {
  const game = useAppStore((s) => s.game);
  const mode = useAppStore((s) => s.mode);
  const humanColor = useAppStore((s) => s.humanColor);
  const rules = useAppStore((s) => s.rules);
  const roll = useAppStore((s) => s.roll);
  const move = useAppStore((s) => s.move);
  const backToTitle = useAppStore((s) => s.backToTitle);
  const leaveOnline = useAppStore((s) => s.leaveOnline);
  const onlineRoom = useAppStore((s) => s.online.room);
  const onlinePlayerId = useAppStore((s) => s.online.playerId);
  const lastCapture = useAppStore((s) => s.lastCapture);
  const remoteMove = useAppStore((s) => s.remoteMove);
  const onlineStatus = useAppStore((s) => s.online.status);

  const [diceRolling, setDiceRolling] = useState(false);
  const [captureOverride, setCaptureOverride] = useState<{ pieceId: string; fromStep: number; moverId: string } | null>(
    null,
  );
  const [pendingMovePieceId, setPendingMovePieceId] = useState<string | null>(null);
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollingRef = useRef(false); // state更新の非同期性に関係なく多重ロールを防ぐ同期ガード
  const captureSoundPlayed = useRef(false); // 到着検知とフォールバックタイマーで弾き飛ばし音が二重に鳴らないようにする
  const logRef = useRef<HTMLDivElement>(null);

  // 対戦画面の間だけBGMを再生する
  useEffect(() => {
    startBgm();
    return () => stopBgm();
  }, []);

  // ログが増えるたびに末尾(最新行)へ自動スクロールする
  // (「あがり」チャイム・1〜3位の拍手はstore.ts側で判定・再生している。
  //  最後のコマの「あがり」やゲーム終了は結果画面への遷移と同じ手で起きるため、
  //  このコンポーネントのuseEffectでは間に合わずアンマウントされてしまうことがあるため)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game?.log.length]);

  // オンライン対戦: サーバーの状態更新から検出した「動いたコマ」を、CPU対戦と同じ
  // 到着検知の仕組みに乗せる(下のpendingMovePieceId/onPieceArrived参照)
  useEffect(() => {
    if (mode !== 'online' || !remoteMove) return;
    setPendingMovePieceId(remoteMove.pieceId);
  }, [mode, remoteMove]);

  // 弾き飛ばし発生時、動かしたコマが実際にそのマスへ到着するまでは
  // 弾かれたコマを元の位置に留めて見せ、到着と同時に自陣へ戻す。
  // 到着検知(onMoverArrived)を主とし、万一発火しなかった場合の保険として推定時間のタイマーも張る
  useEffect(() => {
    if (!lastCapture) return;
    captureSoundPlayed.current = false;
    setCaptureOverride({ pieceId: lastCapture.pieceId, fromStep: lastCapture.fromStep, moverId: lastCapture.moverId });
    const remaining = lastCapture.atMs + lastCapture.delayMs - Date.now();
    const timer = setTimeout(() => {
      if (!captureSoundPlayed.current) {
        captureSoundPlayed.current = true;
        playSfx('capture');
      }
      setCaptureOverride(null);
    }, Math.max(0, remaining) + 500);
    return () => {
      clearTimeout(timer);
      // 次の弾き飛ばしが短時間で連続発生し、この弾き飛ばしの到着検知・保険タイマーが
      // 発火する前にエフェクトが再実行された場合、音が鳴らないまま消えてしまうのを防ぐ
      if (!captureSoundPlayed.current) {
        captureSoundPlayed.current = true;
        playSfx('capture');
      }
    };
  }, [lastCapture]);

  // 弾いたコマが実際に敵のマスへ到着した瞬間に弾き飛ばし音を鳴らす(動き始めではなく弾いた時)
  const handleMoverArrived = () => {
    if (!captureSoundPlayed.current) {
      captureSoundPlayed.current = true;
      playSfx('capture');
    }
    setCaptureOverride(null);
  };

  // 動かしたコマが実際にマスへ到着した瞬間に移動音を鳴らす(動き始めではなく止まった時)
  const handlePieceArrived = (pieceId: string) => {
    if (pieceId !== pendingMovePieceId) return;
    playSfx('move');
    setPendingMovePieceId(null);
  };

  const isHumanTurn = game != null && currentColor(game) === humanColor;

  const rollWithAnimation = () => {
    if (rollingRef.current) return;
    rollingRef.current = true;
    setTimeout(() => playSfx('roll'), 400); // 投げ始めの動きと音のタイミングを合わせるための遅延
    setDiceRolling(true);
    setTimeout(() => {
      roll();
      rollingRef.current = false;
      setDiceRolling(false);
    }, 700); // Dice3Dの投げ上げ→バウンド演出が収まるまでの時間に合わせる
  };

  const handleMove = (pieceId: string) => {
    // オンライン対戦ではサーバーの応答(room_state)を起点にremoteMoveのuseEffectが
    // pendingMovePieceIdを設定するため、クリック時点ではローカルで設定しない
    if (mode !== 'online') setPendingMovePieceId(pieceId);
    move(pieceId);
  };

  // CPUの手番を自動進行する(オンライン対戦では空席のCPU進行もサーバー側が担うため対象外)
  useEffect(() => {
    if (mode === 'online') return;
    if (!game || game.phase === 'finished') return;
    if (isHumanTurn) return;

    cpuTimer.current = setTimeout(() => {
      if (game.phase === 'awaiting_roll') {
        rollWithAnimation();
      } else if (game.phase === 'awaiting_move') {
        const pieceId = pickCpuPieceId(game);
        if (pieceId) handleMove(pieceId);
      }
    }, 700);

    return () => {
      if (cpuTimer.current) clearTimeout(cpuTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, isHumanTurn, mode]);

  // 自分の手番でも、動かせるコマが1つしかない場合はコマ選択を待たず自動的に進める
  useEffect(() => {
    if (!game || !isHumanTurn || game.phase !== 'awaiting_move') return;
    const moves = getCurrentLegalMoves(game);
    if (moves.length !== 1) return;

    const onlyPieceId = moves[0].pieceId;
    autoMoveTimer.current = setTimeout(() => {
      handleMove(onlyPieceId);
    }, 400);

    return () => {
      if (autoMoveTimer.current) clearTimeout(autoMoveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, isHumanTurn]);

  const legalMoves = useMemo(() => (game ? getCurrentLegalMoves(game) : []), [game]);
  const selectablePieceIds = useMemo(
    () => new Set(isHumanTurn && game?.phase === 'awaiting_move' ? legalMoves.map((m) => m.pieceId) : []),
    [isHumanTurn, game?.phase, legalMoves],
  );

  if (!game) return null;

  const color = currentColor(game);
  const turnLabel = (() => {
    if (mode !== 'online') return color === humanColor ? '(あなた)' : '(CPU)';
    const owner = onlineRoom?.players.find((p) => p.color === color);
    if (!owner) return '(CPU)';
    return owner.id === onlinePlayerId ? '(あなた)' : `(${owner.name})`;
  })();

  return (
    <div className="game-screen">
      <div className="scene-wrap">
        <Scene
          game={game}
          diceRolling={diceRolling}
          selectablePieceIds={selectablePieceIds}
          legalMoves={legalMoves}
          captureOverride={captureOverride}
          moverPieceId={captureOverride?.moverId}
          onMoverArrived={captureOverride ? handleMoverArrived : undefined}
          pendingMovePieceId={pendingMovePieceId}
          onPieceArrived={handlePieceArrived}
          onSelectPiece={(pieceId) => handleMove(pieceId)}
          onDiceClick={isHumanTurn && game.phase === 'awaiting_roll' && !diceRolling ? rollWithAnimation : undefined}
        />
      </div>

      {mode === 'online' && onlineStatus !== 'open' && (
        <div className="online-connection-banner">
          {onlineStatus === 'connecting' ? '再接続しています…' : '接続が切れました。再接続を試みています…'}
        </div>
      )}

      <div className="overlay-top">
        <div className="turn-indicator" style={{ borderColor: COLOR_HEX[color] }}>
          <span className="turn-color" style={{ backgroundColor: COLOR_HEX[color] }} />
          {COLOR_LABEL[color]}の番{turnLabel}
          {game.startPhase ? ` / スタートダイス残り${game.startPhase.attemptsLeft}回` : ''}
        </div>
        <div className="overlay-top-actions">
          <RulesInfoButton rules={rules} />
          <button type="button" className="link-button" onClick={mode === 'online' ? leaveOnline : backToTitle}>
            {mode === 'online' ? '退室する' : 'タイトルへ'}
          </button>
        </div>
      </div>

      <SoundToggleButton className="sound-toggle-button-game" />

      <div className="overlay-bottom">
        <div className="controls">
          <button
            type="button"
            className="primary-button"
            disabled={!isHumanTurn || game.phase !== 'awaiting_roll' || diceRolling}
            onClick={rollWithAnimation}
          >
            サイコロを振る
          </button>
          {isHumanTurn && game.phase === 'awaiting_move' && legalMoves.length > 0 && (
            <div className="move-hint">盤面のコマをクリックして選んでください</div>
          )}
        </div>

        <div className="log-panel" ref={logRef}>
          {game.log.slice(-LOG_HISTORY_LIMIT).map((line, i) => {
            const lineColor = detectLogColor(line);
            return (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="log-line">
                {lineColor && <span className="log-dot" style={{ backgroundColor: COLOR_HEX[lineColor] }} />}
                <span>{line}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
