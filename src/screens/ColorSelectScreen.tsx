import { useAppStore } from '../app/store';
import { COLOR_HEX } from '../render/colors';
import { COLORS, type Color } from '../game/types';

const COLOR_LABEL: Record<Color, string> = { red: '赤', blue: '青', yellow: '黄', green: '緑' };

export function ColorSelectScreen() {
  const goTo = useAppStore((s) => s.goTo);
  const startGame = useAppStore((s) => s.startGame);

  return (
    <div className="screen screen-center">
      <h2>自分の色を選んでください</h2>
      <p className="subtitle">残り3色はCPUが担当します</p>
      <div className="color-grid">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="color-swatch"
            style={{ backgroundColor: COLOR_HEX[c] }}
            onClick={() => startGame(c)}
          >
            {COLOR_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="screen-actions">
        <button type="button" onClick={() => goTo('rules')}>
          戻る
        </button>
      </div>
    </div>
  );
}
