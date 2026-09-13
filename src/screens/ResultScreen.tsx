import { useAppStore } from '../app/store';
import { describeRules } from '../game/ruleLabels';
import { COLOR_HEX } from '../render/colors';
import type { Color } from '../game/types';

const COLOR_LABEL: Record<Color, string> = { red: '赤', blue: '青', yellow: '黄', green: '緑' };

export function ResultScreen() {
  const game = useAppStore((s) => s.game);
  const mode = useAppStore((s) => s.mode);
  const humanColor = useAppStore((s) => s.humanColor);
  const rules = useAppStore((s) => s.rules);
  const startGame = useAppStore((s) => s.startGame);
  const backToTitle = useAppStore((s) => s.backToTitle);
  const leaveOnline = useAppStore((s) => s.leaveOnline);
  const onlineRoom = useAppStore((s) => s.online.room);
  const onlinePlayerId = useAppStore((s) => s.online.playerId);

  if (!game) return null;

  const rankLabel = (c: Color) => {
    if (mode !== 'online') return c === humanColor ? '(あなた)' : '(CPU)';
    const owner = onlineRoom?.players.find((p) => p.color === c);
    if (!owner) return '(CPU)';
    return owner.id === onlinePlayerId ? '(あなた)' : `(${owner.name})`;
  };

  return (
    <div className="screen screen-center">
      <h2>ゲーム終了</h2>
      <ol className="ranking-list">
        {game.rankings.map((c, i) => (
          <li
            key={c}
            className={`${c === humanColor ? 'is-human' : ''} ${i === 0 ? 'rank-1' : ''}`}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            {i === 0 && <span className="rank-crown">👑</span>}
            <span className="dot" style={{ backgroundColor: COLOR_HEX[c] }} />
            {i + 1}位: {COLOR_LABEL[c]}
            {rankLabel(c)}
          </li>
        ))}
      </ol>
      <div className="screen-actions">
        {mode === 'online' ? (
          <button type="button" className="primary-button" onClick={leaveOnline}>
            退室する
          </button>
        ) : (
          <>
            <button type="button" className="primary-button" onClick={() => startGame(humanColor)}>
              もう一度遊ぶ(同じ設定)
            </button>
            <button type="button" onClick={backToTitle}>
              タイトルへ
            </button>
          </>
        )}
      </div>
      <p className="subtitle">
        ルール: {describeRules(rules).map(({ value }) => value).join(' / ')}
      </p>
    </div>
  );
}
