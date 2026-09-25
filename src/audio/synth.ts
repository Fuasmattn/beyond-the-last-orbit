import { renderLeadNote, renderPowerChord } from './guitar';
import type { Voicing } from './pattern';

const RETRO_INTERVALS: Record<Voicing, readonly number[]> = { power: [0, 7, 12], single: [0], octave: [0, 12] };

/** `amp`: plucked-string guitars through a modeled amp and cab. `retro`: the original sawtooth synth. */
export type GuitarTone = 'amp' | 'retro';

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

/** Linear below `knee`, tanh-rounded above; WaveShaper clamps input to ±1 so output stays < 1. */
export function makeSoftClipCurve(knee = 0.8): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  const room = 1 - knee;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + room * Math.tanh((ax - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

export function makeNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export interface Buses {
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
}

export function createBuses(ctx: BaseAudioContext): Buses {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.15;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const music = ctx.createGain();
  music.gain.value = 0.7;
  const sfx = ctx.createGain();
  sfx.gain.value = 0.8;
  music.connect(comp);
  sfx.connect(comp);
  const clip = ctx.createWaveShaper();
  clip.curve = makeSoftClipCurve();
  comp.connect(limiter).connect(master).connect(clip).connect(ctx.destination);
  return { master, music, sfx };
}

/** A note the amp tone may need; see `Rig.prewarm`. */
export interface WarmNote {
  kind: 'guitar' | 'lead';
  midi: number;
  mute: boolean;
  voicing: Voicing;
}

export interface Rig {
  /** Renders these notes' buffers ahead of time, a few per timer tick, so playback never stalls on one. */
  prewarm(notes: readonly WarmNote[]): void;
  guitar(t: number, midi: number, dur: number, mute: boolean, detune?: number, voicing?: Voicing): void;
  bass(t: number, midi: number, dur: number, mute: boolean, detune?: number): void;
  lead(t: number, midi: number, dur: number, pan?: number, detune?: number): void;
  kick(t: number, level: number): void;
  snare(t: number, level: number): void;
  hat(t: number, level: number): void;
  crash(t: number): void;
  china(t: number, level: number): void;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7, gain = 0): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

/** One amp: highpass → heavy tanh distortion → scooped mids → cab lowpass → pan. */
function guitarAmp(ctx: BaseAudioContext, out: AudioNode, pan: number): AudioNode {
  const input = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeDistortionCurve(30);
  shaper.oversample = '4x';
  const post = ctx.createGain();
  post.gain.value = 0.16;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  input
    .connect(filter(ctx, 'highpass', 110))
    .connect(shaper)
    .connect(filter(ctx, 'peaking', 700, 1, -4))
    .connect(filter(ctx, 'peaking', 2800, 1, 4))
    .connect(filter(ctx, 'lowpass', 4200, 0.9))
    .connect(post)
    .connect(panner)
    .connect(out);
  return input;
}

function envelope(ctx: BaseAudioContext, t: number, dur: number, peak: number): GainNode {
  const g = ctx.createGain();
  const release = Math.min(0.03, dur / 3);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.setValueAtTime(peak, t + dur - release);
  g.gain.linearRampToValueAtTime(0, t + dur);
  return g;
}

function decay(ctx: BaseAudioContext, t: number, peak: number, length: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + length);
  return g;
}

/** Speaker cabinet: tight lows, low-mid scoop, presence bump, steep roll-off above ~5 kHz (no fizz). */
function cabinet(ctx: BaseAudioContext, out: AudioNode, pan: number, level: number): AudioNode {
  const input = ctx.createGain();
  const post = ctx.createGain();
  post.gain.value = level;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  input
    .connect(filter(ctx, 'highpass', 80))
    .connect(filter(ctx, 'peaking', 120, 1, 3))
    .connect(filter(ctx, 'peaking', 500, 0.9, -3.5))
    .connect(filter(ctx, 'peaking', 1900, 1.1, 3))
    .connect(filter(ctx, 'lowpass', 5200, 0.7))
    .connect(filter(ctx, 'lowpass', 5200, 0.7))
    .connect(post)
    .connect(panner)
    .connect(out);
  return input;
}

const CHORD_SEC = { open: 2, mute: 0.35 } as const;
const LEAD_SEC = 2.2;
const AMP_GUITAR_LEVEL = 0.34;
const AMP_LEAD_LEVEL = 0.13;
const VIBRATO_DEPTH = 0.009;
const CHOKE_SEC = 0.02;
/** Pre-render budget: one note per tick keeps each tick under ~5 ms. */
const WARM_INTERVAL_MS = 12;

/** Rendered notes per audio context, shared across songs. */
const noteCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function cachedNote(ctx: BaseAudioContext, key: string, render: () => Float32Array<ArrayBuffer>): AudioBuffer {
  let cache = noteCache.get(ctx);
  if (!cache) noteCache.set(ctx, (cache = new Map()));
  let buf = cache.get(key);
  if (!buf) {
    const data = render();
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.copyToChannel(data, 0);
    cache.set(key, buf);
  }
  return buf;
}

/** Plays a rendered buffer from `t` for `dur` seconds, choking it at the end. */
function playNote(ctx: BaseAudioContext, buf: AudioBuffer, t: number, dur: number, dest: AudioNode, detune: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.detune.value = detune;
  const env = ctx.createGain();
  const end = t + Math.min(dur, buf.duration);
  env.gain.setValueAtTime(1, t);
  env.gain.setValueAtTime(1, Math.max(t, end - CHOKE_SEC));
  env.gain.linearRampToValueAtTime(0, end);
  src.connect(env).connect(dest);
  src.start(t);
  src.stop(end + 0.01);
  return src;
}

export function createRig(ctx: BaseAudioContext, out: AudioNode, tone: GuitarTone = 'amp'): Rig {
  const noise = makeNoiseBuffer(ctx);
  const amps = [guitarAmp(ctx, out, -0.6), guitarAmp(ctx, out, 0.6)];
  const cabs = tone === 'amp' ? [cabinet(ctx, out, -0.7, AMP_GUITAR_LEVEL), cabinet(ctx, out, 0.7, AMP_GUITAR_LEVEL)] : [];

  const bassBus = ctx.createGain();
  bassBus.gain.value = 0.3;
  const bassShaper = ctx.createWaveShaper();
  bassShaper.curve = makeDistortionCurve(2.5);
  bassBus.connect(bassShaper).connect(out);

  const leadBus = ctx.createGain();
  leadBus.gain.value = 0.1;
  const leadShaper = ctx.createWaveShaper();
  leadShaper.curve = makeDistortionCurve(8);
  const leadTone = filter(ctx, 'lowpass', 5000);
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.32;
  const echoFb = ctx.createGain();
  echoFb.gain.value = 0.28;
  // Amp-tone leads are already distorted; they skip the synth lead's shaper.
  if (tone === 'amp') leadBus.connect(leadTone).connect(out);
  else leadBus.connect(leadShaper).connect(leadTone).connect(out);
  leadTone.connect(echo).connect(echoFb).connect(echo);
  echoFb.connect(out);
  const leadCab = tone === 'amp' ? cabinet(ctx, leadBus, 0, AMP_LEAD_LEVEL / leadBus.gain.value) : null;

  const drums = ctx.createGain();
  drums.gain.value = 0.8;
  drums.connect(out);

  const noiseBurst = (t: number, length: number, dest: AudioNode) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length);
  };

  const chordBuffer = (midi: number, mute: boolean, voicing: Voicing, take: number) =>
    cachedNote(ctx, `chord:${midi}:${mute ? 'm' : 'o'}:${voicing}:${take}`, () =>
      renderPowerChord(midi, {
        sampleRate: ctx.sampleRate,
        mute,
        take,
        seconds: mute ? CHORD_SEC.mute : CHORD_SEC.open,
        voicing,
      }),
    );
  const leadBuffer = (midi: number) =>
    cachedNote(ctx, `lead:${midi}`, () => renderLeadNote(midi, { sampleRate: ctx.sampleRate, take: 0, seconds: LEAD_SEC }));

  return {
    prewarm(notes) {
      if (tone !== 'amp') return;
      const jobs: (() => void)[] = [];
      for (const n of notes) {
        if (n.kind === 'lead') jobs.push(() => leadBuffer(n.midi));
        else for (const take of [0, 1]) jobs.push(() => chordBuffer(n.midi, n.mute, n.voicing, take));
      }
      const next = () => {
        jobs.shift()?.();
        if (jobs.length > 0) setTimeout(next, WARM_INTERVAL_MS);
      };
      setTimeout(next, WARM_INTERVAL_MS);
    },

    guitar(t, midi, dur, mute, detune = 0, voicing = 'power') {
      if (tone === 'amp') {
        cabs.forEach((cab, take) => playNote(ctx, chordBuffer(midi, mute, voicing, take), t, dur, cab, detune));
        return;
      }
      amps.forEach((amp, side) => {
        const env = envelope(ctx, t, dur, 0.5);
        const tone = filter(ctx, 'lowpass', mute ? 900 : 6000);
        tone.connect(env).connect(amp);
        for (const interval of RETRO_INTERVALS[voicing]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = midiToHz(midi + interval);
          osc.detune.value = (side === 0 ? -8 : 8) + detune;
          osc.connect(tone);
          osc.start(t);
          osc.stop(t + dur + 0.01);
        }
      });
    },

    bass(t, midi, dur, mute, detune = 0) {
      const env = envelope(ctx, t, dur, 0.8);
      const tone = filter(ctx, 'lowpass', mute ? 400 : 800);
      tone.connect(env).connect(bassBus);
      for (const type of ['sawtooth', 'triangle'] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = detune;
        osc.connect(tone);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      }
    },

    lead(t, midi, dur, pan = 0, detune = 0) {
      if (leadCab) {
        const buf = leadBuffer(midi);
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        panner.connect(leadCab);
        const src = playNote(ctx, buf, t, dur, panner, detune);
        // Finger vibrato: eases in after the pick, like the synth lead.
        const vibrato = ctx.createOscillator();
        vibrato.frequency.value = 5.5;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(VIBRATO_DEPTH, t + Math.min(0.25, dur));
        vibrato.connect(depth).connect(src.playbackRate);
        vibrato.start(t);
        vibrato.stop(t + dur + 0.02);
        return;
      }
      const env = envelope(ctx, t, dur, 0.7);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      env.connect(panner).connect(leadBus);
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(18, t + Math.min(0.25, dur));
      vibrato.connect(depth);
      for (const [type, offset] of [['sawtooth', 0], ['square', 6]] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = offset + detune;
        depth.connect(osc.detune);
        osc.connect(env);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      }
      vibrato.start(t);
      vibrato.stop(t + dur + 0.01);
    },

    // Modern metal kick: short, tight low end plus a pronounced beater click that cuts through fast doubles.
    kick(t, level) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.06);
      osc.connect(decay(ctx, t, level === 2 ? 1.25 : 1.05, 0.2)).connect(drums);
      osc.start(t);
      osc.stop(t + 0.22);
      const clickEnv = decay(ctx, t, 0.55, 0.018);
      clickEnv.connect(drums);
      const clickBp = filter(ctx, 'bandpass', 3500, 1.2);
      clickBp.connect(clickEnv);
      noiseBurst(t, 0.02, clickBp);
    },

    // Fat snare: a pitched body under a longer, brighter wire rattle.
    snare(t, level) {
      const body = decay(ctx, t, level === 2 ? 0.95 : 0.75, 0.24);
      body.connect(drums);
      const bp = filter(ctx, 'bandpass', 2400, 0.6);
      bp.connect(body);
      noiseBurst(t, 0.26, bp);
      const tone = ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(240, t);
      tone.frequency.exponentialRampToValueAtTime(180, t + 0.05);
      tone.connect(decay(ctx, t, 0.6, 0.12)).connect(drums);
      tone.start(t);
      tone.stop(t + 0.14);
    },

    hat(t, level) {
      const open = level === 2;
      const g = decay(ctx, t, 0.16, open ? 0.25 : 0.04);
      g.connect(drums);
      const hp = filter(ctx, 'highpass', 7500);
      hp.connect(g);
      noiseBurst(t, open ? 0.26 : 0.05, hp);
    },

    // China: inharmonic square partials plus band-passed noise, a short trashy decay.
    china(t, level) {
      const g = decay(ctx, t, level === 2 ? 0.26 : 0.18, 0.55);
      g.connect(drums);
      const hp = filter(ctx, 'highpass', 2500);
      hp.connect(g);
      for (const f of [417, 587, 821, 1123]) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        const og = ctx.createGain();
        og.gain.value = 0.12;
        osc.connect(og).connect(hp);
        osc.start(t);
        osc.stop(t + 0.56);
      }
      const bp = filter(ctx, 'bandpass', 5200, 0.9);
      bp.connect(g);
      noiseBurst(t, 0.56, bp);
    },

    crash(t) {
      const g = decay(ctx, t, 0.22, 1.4);
      g.connect(drums);
      const hp = filter(ctx, 'highpass', 4000);
      hp.connect(g);
      noiseBurst(t, 1.4, hp);
    },
  };
}
