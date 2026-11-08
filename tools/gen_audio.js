// 動物えさやりバトル用の効果音・BGMをチップチューン風に合成してWAV出力するスクリプト
// 使い方: node tools/gen_audio.js assets/audio
const fs = require('fs');
const path = require('path');

const SR = 22050;
const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node gen_audio.js <outDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

function writeWav(name, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  const file = path.join(outDir, name);
  fs.writeFileSync(file, buf);
  console.log(`${name}: ${(buf.length / 1024).toFixed(1)} KB`);
}

// 波形
const square = (ph) => (ph % 1 < 0.5 ? 1 : -1);
const triangle = (ph) => 4 * Math.abs(((ph % 1) + 0.75) % 1 - 0.5) - 1;
const saw = (ph) => 2 * (ph % 1) - 1;
const noise = () => Math.random() * 2 - 1;

// tone: 単音を samples に加算する
function addTone(samples, startSec, durSec, freqFn, wave, vol, attack = 0.005, release = 0.05) {
  const start = Math.floor(startSec * SR);
  const dur = Math.floor(durSec * SR);
  let ph = 0;
  for (let i = 0; i < dur; i++) {
    const t = i / SR;
    ph += freqFn(t / durSec) / SR;
    let env = 1;
    if (t < attack) env = t / attack;
    const remain = durSec - t;
    if (remain < release) env = Math.min(env, remain / release);
    const idx = start + i;
    if (idx < samples.length) samples[idx] += wave(ph) * vol * env;
  }
}

function addNoise(samples, startSec, durSec, vol) {
  const start = Math.floor(startSec * SR);
  const dur = Math.floor(durSec * SR);
  for (let i = 0; i < dur; i++) {
    const t = i / dur;
    const idx = start + i;
    if (idx < samples.length) samples[idx] += noise() * vol * (1 - t);
  }
}

function make(durSec) {
  return new Float64Array(Math.ceil(durSec * SR));
}

// --- click: メニュー用の短いポップ音 ---
{
  const s = make(0.07);
  addTone(s, 0, 0.06, () => 900, square, 0.22, 0.002, 0.03);
  writeWav('click.wav', s);
}

// --- count: カウントダウンのビープ ---
{
  const s = make(0.16);
  addTone(s, 0, 0.14, () => 660, square, 0.25, 0.003, 0.05);
  writeWav('count.wav', s);
}

// --- go: 開始の上昇2音 ---
{
  const s = make(0.45);
  addTone(s, 0, 0.14, () => 660, square, 0.26, 0.003, 0.03);
  addTone(s, 0.15, 0.28, () => 990, square, 0.28, 0.003, 0.1);
  writeWav('go.wav', s);
}

// --- launch: 玉を発射する「ピュン」(下降スイープ) ---
{
  const s = make(0.16);
  addTone(s, 0, 0.14, (k) => 900 - 620 * k, saw, 0.3, 0.002, 0.04);
  writeWav('launch.wav', s);
}

// --- goal: コイン風の2音(得点) ---
{
  const s = make(0.34);
  addTone(s, 0, 0.07, () => 988, square, 0.26, 0.002, 0.01);
  addTone(s, 0.07, 0.25, () => 1319, square, 0.26, 0.002, 0.12);
  writeWav('goal.wav', s);
}

// --- win: 勝利ファンファーレ(アルペジオ+和音) ---
{
  const s = make(1.3);
  const seq = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  seq.forEach((f, i) => addTone(s, i * 0.13, 0.14, () => f, square, 0.24, 0.002, 0.03));
  // 最後にC majorの和音を伸ばす
  addTone(s, 0.55, 0.7, () => 523.25, triangle, 0.2, 0.01, 0.3);
  addTone(s, 0.55, 0.7, () => 659.25, triangle, 0.18, 0.01, 0.3);
  addTone(s, 0.55, 0.7, () => 1046.5, square, 0.16, 0.01, 0.3);
  writeWav('win.wav', s);
}

// --- draw: ひきわけ(ふしぎな2音) ---
{
  const s = make(0.6);
  addTone(s, 0, 0.2, () => 587.33, triangle, 0.26, 0.005, 0.06);
  addTone(s, 0.22, 0.34, () => 523.25, triangle, 0.26, 0.005, 0.15);
  writeWav('draw.wav', s);
}

// --- special: 必殺技発動(上昇アルペジオのパワーアップ音) ---
{
  const s = make(0.7);
  const seq = [392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5]; // G4→E6
  seq.forEach((f, i) => addTone(s, i * 0.07, 0.1, () => f, square, 0.22, 0.002, 0.03));
  addTone(s, 0.42, 0.26, () => 1568, triangle, 0.18, 0.005, 0.12);
  writeWav('special.wav', s);
}

// --- alarm: 空腹突進の警告(2回の低いブザー) ---
{
  const s = make(0.5);
  addTone(s, 0, 0.18, () => 220, square, 0.24, 0.005, 0.05);
  addTone(s, 0.26, 0.18, () => 220, square, 0.24, 0.005, 0.05);
  writeWav('alarm.wav', s);
}

// --- crash: 突進を食らった衝突音(ノイズ+下降バズ) ---
{
  const s = make(0.4);
  addNoise(s, 0, 0.25, 0.3);
  addTone(s, 0, 0.35, (k) => 180 - 110 * k, saw, 0.28, 0.002, 0.12);
  writeWav('crash.wav', s);
}

// --- bgm: 4小節の明るいループ(BPM130) ---
{
  const bpm = 130;
  const eighth = 60 / bpm / 2; // 8分音符
  const bars = 4;
  const total = bars * 8 * eighth;
  const s = make(total);

  const N = {
    C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5,
    C3: 130.81, G2: 98.0, A2: 110.0, E3: 164.81, G3: 196.0,
  };
  // メロディ(8分音符x32、nullは休符)
  const melody = [
    N.C5, N.E5, N.G5, N.E5, N.C6, null, N.G5, null,
    N.A5, N.G5, N.E5, N.G5, N.A5, null, N.G5, null,
    N.D5, N.E5, N.G5, N.E5, N.D5, null, N.C5, null,
    N.E5, N.G5, N.A5, N.G5, N.E5, N.D5, N.C5, null,
  ];
  melody.forEach((f, i) => {
    if (f) addTone(s, i * eighth, eighth * 0.92, () => f, square, 0.13, 0.004, 0.04);
  });
  // ベース(4分音符x16)
  const bass = [
    N.C3, N.C3, N.C3, N.C3,
    N.A2, N.A2, N.A2, N.A2,
    N.G2, N.G2, N.G2, N.G2,
    N.G2, N.G2, N.C3, N.C3,
  ];
  bass.forEach((f, i) => {
    addTone(s, i * eighth * 2, eighth * 1.6, () => f, triangle, 0.16, 0.005, 0.08);
  });
  // ハイハット(8分ごと、表拍を強く)
  for (let i = 0; i < 32; i++) {
    addNoise(s, i * eighth, 0.03, i % 2 === 0 ? 0.06 : 0.03);
  }
  writeWav('bgm.wav', s);
}

console.log('done');
