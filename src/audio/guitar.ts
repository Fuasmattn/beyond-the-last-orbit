/**
 * Offline guitar synthesis: Karplus-Strong plucked strings through a two-stage tube-style drive.
 * Pure sample math (no Web Audio), so notes are rendered once into buffers and cached; the realtime
 * graph only adds the speaker-cabinet EQ and envelopes. No imports so it can run in plain Node.
 */

/** A recorded DI note: mono samples, their sample rate and the MIDI pitch they were played at. */
export interface RecordedString {
  data: Float32Array;
  sampleRate: number;
  midi: number;
}

/** Looks up a recording for `midi` (take = double-tracking variant); null → synthesize the string. */
export type StringSource = (midi: number, take: number) => RecordedString | null;

/** Farthest a recording is pitch-shifted before falling back to synthesis. */
export const MAX_STRING_SHIFT = 4;

/** Recorded takes by the MIDI pitch they were played at. */
export type StringLibrary = ReadonlyMap<number, readonly Float32Array[]>;

/** Nearest recording to `midi` within MAX_STRING_SHIFT semitones, for this take; null if none. */
export function nearestString(lib: StringLibrary, sampleRate: number, midi: number, take: number): RecordedString | null {
  let best: number | null = null;
  for (const m of lib.keys()) {
    if (Math.abs(m - midi) > MAX_STRING_SHIFT) continue;
    if (best === null || Math.abs(m - midi) < Math.abs(best - midi)) best = m;
  }
  if (best === null) return null;
  const takes = lib.get(best)!.filter(Boolean);
  const data = takes[take % Math.max(1, takes.length)];
  return data ? { data, sampleRate, midi: best } : null;
}

export interface GuitarNoteOptions {
  sampleRate: number;
  /** Recorded strings to use instead of Karplus-Strong synthesis. */
  source?: StringSource | null;
  /** Palm-muted chug instead of a ringing chord. */
  mute: boolean;
  /** Take variation (different pick noise and tuning) for double-tracked left/right guitars. */
  take: number;
  seconds: number;
  /** Strings played: power chord (default), single note, or root + octave. */
  voicing?: 'power' | 'single' | 'octave';
}

export interface LeadNoteOptions {
  sampleRate: number;
  source?: StringSource | null;
  take: number;
  seconds: number;
}

/** Intervals per voicing, strummed downwards. */
const VOICINGS = { power: [0, 7, 12], single: [0], octave: [0, 12] } as const;
const STRUM_SEC = 0.006;
const OPEN_T60 = 3.5;
const MUTE_T60 = 0.14;
const LEAD_T60 = 9;
const FADE_SEC = 0.08;
/** Decay time constant of a palm-muted recorded string. */
const MUTE_TAU = 0.12;
/** Palm-muted strings lose their highs: two one-pole passes (≈ −12 dB/oct) at this cutoff. */
const MUTE_TONE_HZ = 850;
/** A chug's body length before it releases, and the release time constant. */
const MUTE_HOLD_SEC = 0.08;
const MUTE_RELEASE_SEC = 0.05;
/** Palm-muted chugs sit a little below ringing chords after the amp. */
const MUTE_PEAK = 0.75;

function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** mulberry32 — deterministic pick noise per take. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Adds one plucked string into `out` starting at `offset` samples.
 * `brightness` 0..1 shapes the pick (low = thumb/muted, high = hard pick);
 * `t60` is the time for the string to fade by 60 dB.
 */
export function pluck(
  out: Float32Array,
  sampleRate: number,
  freq: number,
  offset: number,
  gain: number,
  brightness: number,
  t60: number,
  random: () => number,
): void {
  const period = sampleRate / freq;
  // The 2-tap loop average adds half a sample of delay; compensate for accurate tuning.
  const delay = period - 0.5;
  const len = out.length - offset;
  if (len <= 0) return;
  const y = new Float32Array(len);
  const exciteLen = Math.min(len, Math.ceil(period) + 2);
  let lp = 0;
  let mean = 0;
  for (let i = 0; i < exciteLen; i++) {
    lp += brightness * (random() * 2 - 1 - lp);
    y[i] = lp;
    mean += lp;
  }
  mean /= exciteLen;
  for (let i = 0; i < exciteLen; i++) y[i]! -= mean;
  // Energy lost per trip around the loop (one trip per period).
  const loss = 10 ** (-3 / (freq * t60));
  for (let t = exciteLen; t < len; t++) {
    const pos = t - delay;
    const i = Math.floor(pos);
    const fr = pos - i;
    const a = y[i]! * (1 - fr) + y[i + 1]! * fr;
    const b = y[i - 1]! * (1 - fr) + y[i]! * fr;
    y[t] = loss * 0.5 * (a + b);
  }
  for (let t = 0; t < len; t++) out[offset + t]! += gain * y[t]!;
}

/**
 * Adds a recorded string into `out` at `offset`, pitched from its recorded note to `freq` by
 * resampling (linear interpolation; recordings sit within a few semitones of every target).
 */
export function addRecorded(out: Float32Array, sampleRate: number, freq: number, offset: number, gain: number, rec: RecordedString): void {
  const step = (freq / hz(rec.midi)) * (rec.sampleRate / sampleRate);
  const data = rec.data;
  for (let t = offset, pos = 0; t < out.length; t++, pos += step) {
    const i = Math.floor(pos);
    if (i + 1 >= data.length) break;
    const fr = pos - i;
    out[t]! += gain * (data[i]! * (1 - fr) + data[i + 1]! * fr);
  }
}

/** Palm mute on a recorded string: the hand stops the ring within a fraction of a second. */
function dampen(x: Float32Array, sampleRate: number, tau: number): void {
  for (let i = 0; i < x.length; i++) x[i] = x[i]! * Math.exp(-i / (tau * sampleRate));
}

/** Post-amp palm-mute envelope: full level for MUTE_HOLD_SEC, then a fast exponential release. */
function chugEnvelope(x: Float32Array, sampleRate: number): void {
  const hold = Math.round(MUTE_HOLD_SEC * sampleRate);
  for (let i = hold; i < x.length; i++) x[i] = x[i]! * Math.exp(-(i - hold) / (MUTE_RELEASE_SEC * sampleRate));
}

/** One-pole high-pass, in place. */
function highpass(x: Float32Array, sampleRate: number, cutoff: number): void {
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = rc / (rc + 1 / sampleRate);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    prevY = a * (prevY + v - prevX);
    prevX = v;
    x[i] = prevY;
  }
}

/** One-pole low-pass, in place. */
function lowpass(x: Float32Array, sampleRate: number, cutoff: number): void {
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += k * (x[i]! - y);
    x[i] = y;
  }
}

/** Oversampling factor of the amp: distortion harmonics above Nyquist would otherwise fold back as harsh aliasing. */
const OVERSAMPLE = 4;
/** Half-length of the windowed-sinc decimation filter, in oversampled taps. */
const DECIMATE_TAPS = 24;

/** Windowed-sinc low-pass taps at the base Nyquist × 0.9, for decimating by OVERSAMPLE. */
const DECIMATE_KERNEL: Float32Array = (() => {
  const n = DECIMATE_TAPS * 2 + 1;
  const k = new Float32Array(n);
  const cutoff = 0.9 / OVERSAMPLE / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const m = i - DECIMATE_TAPS;
    const sinc = m === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * m) / (Math.PI * m);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
    k[i] = sinc * w;
    sum += k[i]!;
  }
  for (let i = 0; i < n; i++) k[i]! /= sum;
  return k;
})();

/**
 * High-gain amp: tighten lows, asymmetric first stage (even harmonics like a biased tube), tame
 * the fizz between stages, symmetric second stage, then normalize and fade the tail. The two gain
 * stages run at OVERSAMPLE× the sample rate and are low-passed before decimating back.
 */
function drive(x: Float32Array, sampleRate: number, gain1: number, gain2: number, peak: number): void {
  highpass(x, sampleRate, 140);
  const hiRate = sampleRate * OVERSAMPLE;
  const up = new Float32Array(x.length * OVERSAMPLE);
  for (let i = 0; i < x.length; i++) {
    const a = x[i]!;
    const b = x[i + 1] ?? a;
    for (let k = 0; k < OVERSAMPLE; k++) up[i * OVERSAMPLE + k] = a + ((b - a) * k) / OVERSAMPLE;
  }
  const bias = 0.25;
  const off = Math.tanh(bias);
  for (let i = 0; i < up.length; i++) up[i] = Math.tanh(gain1 * up[i]! + bias) - off;
  lowpass(up, hiRate, 6500);
  highpass(up, hiRate, 30);
  for (let i = 0; i < up.length; i++) up[i] = Math.tanh(gain2 * up[i]!);
  for (let i = 0; i < x.length; i++) {
    const c = i * OVERSAMPLE;
    let acc = 0;
    for (let t = -DECIMATE_TAPS; t <= DECIMATE_TAPS; t++) acc += (up[c + t] ?? 0) * DECIMATE_KERNEL[t + DECIMATE_TAPS]!;
    x[i] = acc;
  }
  let max = 0;
  for (let i = 0; i < x.length; i++) max = Math.max(max, Math.abs(x[i]!));
  const norm = max > 0 ? peak / max : 0;
  const fade = Math.min(x.length, Math.round(FADE_SEC * sampleRate));
  for (let i = 0; i < x.length; i++) {
    const tail = x.length - i;
    x[i] = x[i]! * norm * (tail < fade ? tail / fade : 1);
  }
}

/** Distorted rhythm-guitar note on `midi` (power chord by default; palm-muted chug if `mute`), mono. */
export function renderPowerChord(midi: number, o: GuitarNoteOptions): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.max(1, Math.round(o.seconds * o.sampleRate)));
  const voicing = o.voicing ?? 'power';
  // Chugs are played on the two lowest strings only; the octave string just adds buzz when muted.
  const intervals = o.mute && voicing === 'power' ? [0, 7] : VOICINGS[voicing];
  const random = rng(midi * 7919 + o.take * 104729 + (o.mute ? 1 : 0) + voicing.length * 13);
  // Each take is tuned a hair differently so the two tracks beat against each other.
  const detune = 2 ** ((o.take % 2 === 0 ? -4 : 4) / 1200);
  let recorded = false;
  intervals.forEach((interval, s) => {
    const offset = Math.round(s * STRUM_SEC * o.sampleRate * (0.7 + 0.6 * random()));
    const gain = interval === 12 ? 0.6 : 1;
    const rec = o.source?.(midi + interval, o.take) ?? null;
    if (rec) {
      addRecorded(out, o.sampleRate, hz(midi + interval) * detune, offset, gain, rec);
      recorded = true;
      return;
    }
    pluck(
      out,
      o.sampleRate,
      hz(midi + interval) * detune,
      offset,
      gain,
      o.mute ? 0.3 : 0.75,
      o.mute ? MUTE_T60 : OPEN_T60,
      random,
    );
  });
  // Palm mutes: the heel of the hand darkens the strings before the amp (and stops recorded ones ringing).
  if (o.mute && recorded) dampen(out, o.sampleRate, MUTE_TAU);
  if (o.mute) {
    lowpass(out, o.sampleRate, MUTE_TONE_HZ);
    lowpass(out, o.sampleRate, MUTE_TONE_HZ);
  }
  drive(out, o.sampleRate, o.mute ? 18 : 30, 2.5, o.mute ? MUTE_PEAK : 0.9);
  // The amp would re-amplify the damped tail into a buzz; a real chug drops out of saturation
  // almost at once. Hold the body, then let it die fast.
  if (o.mute) chugEnvelope(out, o.sampleRate);
  return out;
}

/** Sustained single-note lead (vibrato and pitch are applied at playback). */
export function renderLeadNote(midi: number, o: LeadNoteOptions): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.max(1, Math.round(o.seconds * o.sampleRate)));
  const random = rng(midi * 31337 + o.take * 7);
  const rec = o.source?.(midi, o.take) ?? null;
  if (rec) addRecorded(out, o.sampleRate, hz(midi), 0, 1, rec);
  else pluck(out, o.sampleRate, hz(midi), 0, 1, 0.8, LEAD_T60, random);
  drive(out, o.sampleRate, 45, 3, 0.9);
  return out;
}
