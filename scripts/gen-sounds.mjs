// 効果音・BGMのプレースホルダーを合成生成するスクリプト(外部音源ファイルを使わず、
// Node.jsだけで簡易的なPCM波形を書き出す)。本番用の音源に差し替える前提の仮素材。
import { writeFileSync, mkdirSync } from 'node:fs';

const SAMPLE_RATE = 44100;

function writeWav(path, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, buffer);
}

function seconds(n) {
  return Math.floor(n * SAMPLE_RATE);
}

function envelope(t, attack, decay) {
  if (t < attack) return t / attack;
  return Math.max(0, 1 - (t - attack) / decay);
}

// --- move.wav: 短い「コトッ」という単発音 ---
function genMove() {
  const dur = 0.09;
  const n = seconds(dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, 0.002, dur - 0.002);
    out[i] = Math.sin(2 * Math.PI * 520 * t) * env * 0.5;
  }
  return out;
}

// --- roll.wav: サイコロがカップの中で転がり、弾みながら着地する音。
// ノイズバーストを「カチッ」という硬質な打音として使い、間隔をだんだん詰めて弾みが収まる様子を表現する ---
function genRoll() {
  const dur = 0.5;
  const n = seconds(dur);
  const out = new Float32Array(n);

  let t = 0.02;
  let interval = 0.075;
  let amp = 1;
  while (t < dur - 0.06) {
    const start = seconds(t);
    const clickLen = seconds(0.014 + Math.random() * 0.006);
    for (let i = 0; i < clickLen && start + i < n; i++) {
      const tt = i / SAMPLE_RATE;
      const env = Math.exp(-tt * 480); // 硬質な打音になるよう速く減衰させる
      const noise = Math.random() * 2 - 1;
      out[start + i] += noise * env * amp * 0.55;
    }
    t += interval;
    interval *= 0.72; // 弾みが収まるにつれ間隔が詰まる
    amp *= 0.86;
    if (interval < 0.018) break;
  }

  // 最後にやや低め・長めの着地音を重ねる
  const landStart = seconds(t);
  const landLen = seconds(0.07);
  for (let i = 0; i < landLen && landStart + i < n; i++) {
    const tt = i / SAMPLE_RATE;
    const env = Math.exp(-tt * 90);
    const noise = Math.random() * 2 - 1;
    out[landStart + i] += noise * env * 0.5 + Math.sin(2 * Math.PI * 180 * tt) * env * 0.25;
  }
  return out;
}

// --- capture.wav: 弾き飛ばし。下降する「ボヨン」 ---
function genCapture() {
  const dur = 0.32;
  const n = seconds(dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 700 - 500 * (t / dur);
    const env = envelope(t, 0.01, dur - 0.01);
    out[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.55;
  }
  return out;
}

// --- finish.wav: あがり。上昇する3音のチャイム ---
function genFinish() {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteDur = 0.16;
  const n = seconds(noteDur * notes.length + 0.1);
  const out = new Float32Array(n);
  notes.forEach((freq, idx) => {
    const start = seconds(idx * noteDur);
    const len = seconds(noteDur + 0.08);
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / SAMPLE_RATE;
      const env = envelope(t, 0.01, noteDur + 0.07);
      out[start + i] += Math.sin(2 * Math.PI * freq * t) * env * 0.4;
    }
  });
  return out;
}

// --- bgm.wav: ゆったりした持続和音のループ(プレースホルダー) ---
function genBgm() {
  const dur = 12;
  const n = seconds(dur);
  const out = new Float32Array(n);
  const chordFreqs = [130.81, 164.81, 196.0]; // C3,E3,G3
  // ループ境界でクリックが出ないよう、周期がループ長を割り切れる周波数だけを使う
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const f of chordFreqs) {
      s += Math.sin(2 * Math.PI * f * t);
    }
    const tremolo = 0.85 + 0.15 * Math.sin(2 * Math.PI * (1 / dur) * t);
    out[i] = (s / chordFreqs.length) * 0.12 * tremolo;
  }
  return out;
}

mkdirSync('public/sounds', { recursive: true });
writeWav('public/sounds/move.wav', genMove());
writeWav('public/sounds/roll.wav', genRoll());
writeWav('public/sounds/capture.wav', genCapture());
writeWav('public/sounds/finish.wav', genFinish());
writeWav('public/sounds/bgm.wav', genBgm());
console.log('done');
