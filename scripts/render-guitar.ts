/**
 * Renders a short gallop riff with the offline guitar synth to a WAV for listening checks.
 * Usage: node scripts/render-guitar.ts [out.wav]
 * (The realtime cabinet EQ is approximated here with the same one-pole filters.)
 */
import { writeFileSync } from 'node:fs';
import { renderLeadNote, renderPowerChord } from '../src/audio/guitar.ts';

const SR = 44100;
const BPM = 140;
const STEP = 60 / BPM / 4;
const out = process.argv[2] ?? 'guitar-demo.wav';

// Earth gallop: E2 chugs, then open G2 / A2 / B2 chords, then a lead phrase.
const riff: [number, boolean, number][] = [];
for (let bar = 0; bar < 2; bar++) {
  for (const s of [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]) riff.push([bar * 16 + s, true, 40]);
}
riff.push([32, false, 43], [36, false, 45], [40, false, 47], [44, false, 40]);
const lead: [number, number, number][] = [
  [48, 64, 2],
  [50, 67, 2],
  [52, 71, 4],
  [56, 69, 2],
  [58, 67, 2],
  [60, 64, 4],
];

const total = Math.round(66 * STEP * SR);
const left = new Float32Array(total);
const right = new Float32Array(total);

function add(buf: Float32Array, dest: Float32Array, start: number, len: number, gain: number): void {
  const n = Math.min(buf.length, len, dest.length - start);
  const release = Math.min(n, Math.round(0.02 * SR));
  for (let i = 0; i < n; i++) dest[start + i]! += buf[i]! * gain * (i > n - release ? (n - i) / release : 1);
}

for (const [step, mute, midi] of riff) {
  const start = Math.round(step * STEP * SR);
  const len = Math.round((mute ? 0.8 : 4) * STEP * SR);
  for (const [take, dest] of [
    [0, left],
    [1, right],
  ] as const) {
    add(renderPowerChord(midi, { sampleRate: SR, mute, take, seconds: mute ? 0.35 : 1.2 }), dest, start, len, 0.45);
  }
}
for (const [step, midi, steps] of lead) {
  const note = renderLeadNote(midi, { sampleRate: SR, take: 0, seconds: 1 });
  const start = Math.round(step * STEP * SR);
  add(note, left, start, Math.round(steps * STEP * SR), 0.25);
  add(note, right, start, Math.round(steps * STEP * SR), 0.25);
}

// Rough cabinet: 2 × one-pole low-pass at 5 kHz (≈ −12 dB/oct) — the game uses steeper biquads.
for (const ch of [left, right]) {
  for (let pass = 0; pass < 2; pass++) {
    const k = 1 - Math.exp((-2 * Math.PI * 5000) / SR);
    let y = 0;
    for (let i = 0; i < ch.length; i++) ch[i] = y += k * (ch[i]! - y);
  }
}

let peak = 0;
let nan = 0;
for (const ch of [left, right]) for (const v of ch) Number.isFinite(v) ? (peak = Math.max(peak, Math.abs(v))) : nan++;

const data = Buffer.alloc(44 + total * 4);
data.write('RIFF', 0);
data.writeUInt32LE(36 + total * 4, 4);
data.write('WAVEfmt ', 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28);
data.writeUInt16LE(4, 32);
data.writeUInt16LE(16, 34);
data.write('data', 36);
data.writeUInt32LE(total * 4, 40);
const scale = peak > 0 ? 0.9 / peak : 1;
for (let i = 0; i < total; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i]! * scale)) * 32767), 44 + i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i]! * scale)) * 32767), 46 + i * 4);
}
writeFileSync(out, data);
console.log(`wrote ${out}: ${(total / SR).toFixed(2)} s, peak ${peak.toFixed(2)}, non-finite ${nan}`);
