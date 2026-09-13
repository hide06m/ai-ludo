import { useAppStore } from '../app/store';
import { COLOR_HEX } from '../render/colors';
import { COLORS, type BlockRule, type Color, type EndRule, type GoalRule, type Rules, type StartRule } from '../game/types';
import { RadioGroup } from './RuleSelectScreen';

const COLOR_LABEL: Record<Color, string> = { red: '赤', blue: '青', yellow: '黄', green: '緑' };

export function OnlineRoomScreen() {
  const room = useAppStore((s) => s.online.room);
  const playerId = useAppStore((s) => s.online.playerId);
  const error = useAppStore((s) => s.online.error);
  const selectOnlineColor = useAppStore((s) => s.selectOnlineColor);
  const setOnlineRules = useAppStore((s) => s.setOnlineRules);
  const startOnlineGame = useAppStore((s) => s.startOnlineGame);
  const leaveOnline = useAppStore((s) => s.leaveOnline);

  if (!room) return null;

  const me = room.players.find((p) => p.id === playerId);
  const isHost = me?.isHost ?? false;
  const takenColors = new Set(room.players.map((p) => p.color).filter((c): c is Color => c != null));
  const canStart = isHost && room.players.some((p) => p.color != null);

  const update = (patch: Partial<Rules>) => setOnlineRules({ ...room.rules, ...patch });

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>部屋コード: {room.roomCode}</h2>
      </div>
      <p className="subtitle">このコードを友達に伝えて「部屋に入る」から参加してもらいましょう</p>

      <div className="online-player-list">
        {room.players.map((p) => (
          <div key={p.id} className={`online-player-row ${p.id === playerId ? 'is-me' : ''}`}>
            <span className="dot" style={{ backgroundColor: p.color ? COLOR_HEX[p.color] : '#555' }} />
            <span className="online-player-name">
              {p.name}
              {p.isHost ? '(ホスト)' : ''}
              {p.id === playerId ? '(あなた)' : ''}
              {!p.connected ? '(切断)' : ''}
            </span>
            <span className="online-player-color">{p.color ? COLOR_LABEL[p.color] : '未選択'}</span>
          </div>
        ))}
      </div>

      {me && (
        <fieldset className="rule-group">
          <legend>自分の色</legend>
          <div className="color-grid online-color-grid">
            {COLORS.map((c) => {
              const takenByOther = takenColors.has(c) && me.color !== c;
              return (
                <button
                  key={c}
                  type="button"
                  className="color-swatch"
                  disabled={takenByOther}
                  style={{
                    backgroundColor: COLOR_HEX[c],
                    opacity: takenByOther ? 0.3 : 1,
                    outline: me.color === c ? '3px solid white' : 'none',
                  }}
                  onClick={() => selectOnlineColor(c)}
                >
                  {COLOR_LABEL[c]}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {isHost ? (
        <>
          <RadioGroup
            label="コマ出しルール"
            description="場にコマが1つもない時、サイコロで6を出すとスタートマスに出せます。"
            value={room.rules.startRule}
            options={[
              ['startDice3', 'スタートダイス3回'],
              ['startDice1', 'スタートダイス1回'],
              ['noDice', 'サイコロなし'],
            ]}
            onChange={(v: StartRule) => update({ startRule: v })}
          />
          <RadioGroup
            label="ブロック"
            description="相手のコマが止まっているマスを通過できるかどうかです。"
            value={room.rules.blockRule}
            options={[
              ['on', 'あり'],
              ['off', 'なし'],
            ]}
            onChange={(v: BlockRule) => update({ blockRule: v })}
          />
          <RadioGroup
            label="ゴール条件"
            description="ゴールマス最奥への到達条件です。"
            value={room.rules.goalRule}
            options={[
              ['exact', 'ピッタリ'],
              ['overOk', '大きい目でもOK'],
            ]}
            onChange={(v: GoalRule) => update({ goalRule: v })}
          />
          <RadioGroup
            label="ゲーム終了条件"
            description="全員の順位を決めるか、1位が決まったら終了するかです。"
            value={room.rules.endRule}
            options={[
              ['allRanked', '全員順位決定'],
              ['firstWins', '1位決定で終了'],
            ]}
            onChange={(v: EndRule) => update({ endRule: v })}
          />
        </>
      ) : (
        <p className="subtitle">ルールはホストが設定します。ホストの開始を待っています…</p>
      )}

      {error && <p className="online-error">{error}</p>}

      <div className="screen-actions">
        <button type="button" onClick={leaveOnline}>
          退室する
        </button>
        {isHost && (
          <button type="button" className="primary-button" disabled={!canStart} onClick={startOnlineGame}>
            ゲーム開始
          </button>
        )}
      </div>
    </div>
  );
}
