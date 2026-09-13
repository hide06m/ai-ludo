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
// タブがバックグラウンドの間にBGMが鳴り続けないようにするため、
// 「対戦画面にいる間はBGMを流すべきか」を覚えておく(ミュートとは独立)
let bgmShouldBePlaying = false;

function getSfxElement(name: SfxName): HTMLAudioElement {
  let el = sfxCache.get(name);
  if (!el) {
    el = new Audio(SFX_FILES[name]);
    sfxCache.set(name, el);
  }
  return el;
}

function getBgmElement(): HTMLAudioElement {
  if (!bgmEl) {
    bgmEl = new Audio('/sounds/bgm.wav');
    bgmEl.loop = true;
    bgmEl.volume = 0.25;
  }
  return bgmEl;
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
  el.play().catch((err) => {
    // スマホでの自動再生制限などで失敗することがある。無視して構わないが、
    // 診断しやすいようコンソールには残しておく
    console.warn(`[audio] playSfx(${name}) failed`, err);
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
  bgmShouldBePlaying = true;
  const el = getBgmElement();
  if (muted) return;
  el.play().catch((err) => console.warn('[audio] startBgm failed', err));
}

export function stopBgm() {
  bgmShouldBePlaying = false;
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
    bgmEl?.play().catch((err) => console.warn('[audio] setMuted(false) resume failed', err));
  }
}

/**
 * スマホ(特にiOS Safari)では、ページ内で一度もユーザー操作を経ていない状態で
 * 音声を再生しようとすると自動再生制限で無音のまま失敗することがある。
 * この制限の解除は要素ごとに個別に必要になる場合があるため、実際に鳴らす可能性のある
 * 全てのAudio要素それぞれに対して、最初のユーザー操作のタイミングで一度再生→即座に
 * 停止しておくことで、以降(setTimeoutなどで遅延させて呼ぶ場合も含め)の再生が
 * 安定するようにする。
 */
function unlockAllAudioElements() {
  const targets = [...(Object.keys(SFX_FILES) as SfxName[]).map(getSfxElement), getBgmElement()];
  for (const el of targets) {
    const wasPlaying = !el.paused;
    el.play()
      .then(() => {
        if (!wasPlaying) {
          el.pause();
          el.currentTime = 0;
        }
      })
      .catch(() => {
        // ここで失敗しても、各playSfx呼び出し自体が(ユーザー操作を経た後の)
        // 通常の再生試行を行うため、致命的ではない
      });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAllAudioElements, { once: true });
  window.addEventListener('touchstart', unlockAllAudioElements, { once: true });

  // スマホでブラウザをバックグラウンドに回してもBGMが鳴り続けてしまわないよう、
  // 非表示になったら一時停止し、再び表示されたら(対戦画面にいた場合のみ)再開する
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      bgmEl?.pause();
    } else if (bgmShouldBePlaying && !muted) {
      bgmEl?.play().catch((err) => console.warn('[audio] resume on visible failed', err));
    }
  });
}
