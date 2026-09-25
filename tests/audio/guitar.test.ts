import { describe, expect, it } from 'vitest';
import { addRecorded, pluck, renderLeadNote, renderPowerChord } from '../../src/audio/guitar';

const SR = 44100;

/** Fundamental period in samples via autocorrelation over a plausible range. */
function period(x: Float32Array, min: number, max: number): number {
  let best = min;
  let bestScore = -Infinity;
  for (let lag = min; lag <= max; lag++) {
    let s = 0;
    for (let i = 2000; i < 2000 + 4096; i++) s += x[i]! * x[i + lag]!;
    if (s > bestScore) {
      bestScore = s;
      best = lag;
    }
  }
  return best;
}

function rms(x: Float32Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i]! ** 2;
  return Math.sqrt(s / (to - from));
}

describe('pluck', () => {
  it('rings at the requested pitch', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = new Float32Array(SR);
    pluck(out, SR, 110, 0, 1, 0.8, 3, random);
    const p = period(out, 300, 500);
    expect(Math.abs(SR / p - 110) / 110).toBeLessThan(0.01);
  });
});

describe('renderPowerChord', () => {
  const open = renderPowerChord(40, { sampleRate: SR, mute: false, take: 0, seconds: 1 });
  const mute = renderPowerChord(40, { sampleRate: SR, mute: true, take: 0, seconds: 1 });

  it('is finite and within ±1', () => {
    for (const buf of [open, mute]) {
      expect(buf.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
    }
  });

  it('sustains when open and chokes when palm-muted', () => {
    const late = (x: Float32Array) => rms(x, Math.round(0.4 * SR), Math.round(0.5 * SR));
    expect(late(open)).toBeGreaterThan(0.2);
    expect(late(mute)).toBeLessThan(late(open) / 4);
  });

  it('differs between left and right takes', () => {
    const other = renderPowerChord(40, { sampleRate: SR, mute: false, take: 1, seconds: 1 });
    expect(other.some((v, i) => v !== open[i])).toBe(true);
  });

  it('fades out at the end of the buffer', () => {
    expect(Math.abs(open[open.length - 1]!)).toBeLessThan(0.01);
  });
});

describe('renderLeadNote', () => {
  it('sustains through the note', () => {
    const lead = renderLeadNote(64, { sampleRate: SR, take: 0, seconds: 1.5 });
    expect(rms(lead, Math.round(1.0 * SR), Math.round(1.2 * SR))).toBeGreaterThan(0.2);
  });
});

describe('recorded strings', () => {
  // A 110 Hz sine "recording" played at A2 (midi 45).
  const rec = { data: Float32Array.from({ length: SR }, (_, i) => Math.sin((2 * Math.PI * 110 * i) / SR)), sampleRate: SR, midi: 45 };

  it('resamples a recording to the target pitch', () => {
    const out = new Float32Array(SR / 2);
    addRecorded(out, SR, 110 * 2 ** (2 / 12), 0, 1, rec);
    const p = period(out, 300, 500);
    expect(Math.abs(SR / p - 110 * 2 ** (2 / 12)) / 123.5).toBeLessThan(0.01);
  });

  it('renders chords from recordings and damps palm mutes', () => {
    const source = () => rec;
    const open = renderPowerChord(45, { sampleRate: SR, mute: false, take: 0, seconds: 1, source });
    const mute = renderPowerChord(45, { sampleRate: SR, mute: true, take: 0, seconds: 1, source });
    const late = (x: Float32Array) => rms(x, Math.round(0.4 * SR), Math.round(0.5 * SR));
    expect(open.every((v) => Number.isFinite(v))).toBe(true);
    expect(late(mute)).toBeLessThan(late(open) / 4);
  });
});
