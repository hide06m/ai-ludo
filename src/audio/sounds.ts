/**
 * 効果音・BGMの再生管理。
 * ブラウザの自動再生制限があるため、BGMはユーザー操作(サイコロを振る等)の後に開始する。
 */

export type SfxName = 'roll' | 'move' | 'capture' | 'finish' | 'victory';

const SFX_FILES: Record<SfxName, string> = {
  roll: '/sounds/roll.wav',
  move: '/sounds/move.wav',
  capture: '/sounds/capture.wav',
  finish: '/sounds/finish.wav',
  victory: '/sounds/victory.mp3',
};

let muted = false;
const sfxCache = new Map<SfxName, HTMLAudioElement>();
let bgmEl: HTMLAudioElement | null = null;

function getSfxElement(name: SfxName): HTMLAudioElement {
  let el = sfxCache.get(name);
  if (!el) {
    el = new Audio(SFX_FILES[name]);
    sfxCache.set(name, el);
  }
  return el;
}

export interface PlaySfxOptions {
  /** 再生開始から何ミリ秒後にフェードアウトを始めるか */
  fadeOutAfterMs?: number;
  /** フェードアウトにかける時間(ミリ秒) */
  fadeDurationMs?: number;
}

export function playSfx(name: SfxName, options?: PlaySfxOptions) {
  if (muted) return;
  // 短時間に連続再生できるよう、都度複製して再生する(同じコマ移動音が連打されても途切れない)
  const base = getSfxElement(name);
  const el = base.cloneNode(true) as HTMLAudioElement;
  const startVolume = 0.6;
  el.volume = startVolume;
  el.play().catch(() => {
    // ユーザー操作前の自動再生ブロックなどは無視する
  });

  if (options?.fadeOutAfterMs != null) {
    const fadeDuration = options.fadeDurationMs ?? 1000;
    const steps = 20;
    const stepTime = fadeDuration / steps;
    setTimeout(() => {
      let i = 0;
      const timer = setInterval(() => {
        i++;
        el.volume = Math.max(0, startVolume * (1 - i / steps));
        if (i >= steps) {
          clearInterval(timer);
          el.pause();
        }
      }, stepTime);
    }, options.fadeOutAfterMs);
  }
}

export function startBgm() {
  if (!bgmEl) {
    bgmEl = new Audio('/sounds/bgm.wav');
    bgmEl.loop = true;
    bgmEl.volume = 0.25;
  }
  if (muted) return;
  bgmEl.play().catch(() => {});
}

export function stopBgm() {
  bgmEl?.pause();
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  if (muted) {
    bgmEl?.pause();
  } else {
    bgmEl?.play().catch(() => {});
  }
}
