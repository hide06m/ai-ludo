import { useState } from 'react';
import { isMuted, setMuted } from '../audio/sounds';

/** どの画面にも置ける、効果音・BGMのミュート切り替えボタン */
export function SoundToggleButton({ className }: { className?: string }) {
  const [muted, setMutedState] = useState(isMuted());

  return (
    <button
      type="button"
      className={`sound-toggle-button${className ? ` ${className}` : ''}`}
      aria-label={muted ? 'サウンドOFF(タップでON)' : 'サウンドON(タップでOFF)'}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
