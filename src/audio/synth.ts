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

export interface Rig {
  guitar(t: number, midi: number, dur: number, mute: boolean): void;
  bass(t: number, midi: number, dur: number, mute: boolean): void;
  lead(t: number, midi: number, dur: number): void;
  kick(t: number, level: number): void;
  snare(t: number, level: number): void;
  hat(t: number, level: number): void;
  crash(t: number): void;
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

export function createRig(ctx: BaseAudioContext, out: AudioNode): Rig {
  const noise = makeNoiseBuffer(ctx);
  const amps = [guitarAmp(ctx, out, -0.6), guitarAmp(ctx, out, 0.6)];

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
  leadBus.connect(leadShaper).connect(leadTone).connect(out);
  leadTone.connect(echo).connect(echoFb).connect(echo);
  echoFb.connect(out);

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

  return {
    guitar(t, midi, dur, mute) {
      amps.forEach((amp, side) => {
        const env = envelope(ctx, t, dur, 0.5);
        const tone = filter(ctx, 'lowpass', mute ? 900 : 6000);
        tone.connect(env).connect(amp);
        for (const interval of [0, 7, 12]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = midiToHz(midi + interval);
          osc.detune.value = side === 0 ? -8 : 8;
          osc.connect(tone);
          osc.start(t);
          osc.stop(t + dur + 0.01);
        }
      });
    },

    bass(t, midi, dur, mute) {
      const env = envelope(ctx, t, dur, 0.8);
      const tone = filter(ctx, 'lowpass', mute ? 400 : 800);
      tone.connect(env).connect(bassBus);
      for (const type of ['sawtooth', 'triangle'] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(midi);
        osc.connect(tone);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      }
    },

    lead(t, midi, dur) {
      const env = envelope(ctx, t, dur, 0.7);
      env.connect(leadBus);
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(18, t + Math.min(0.25, dur));
      vibrato.connect(depth);
      for (const [type, detune] of [['sawtooth', 0], ['square', 6]] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = detune;
        depth.connect(osc.detune);
        osc.connect(env);
        osc.start(t);
        osc.stop(t + dur + 0.01);
      }
      vibrato.start(t);
      vibrato.stop(t + dur + 0.01);
    },

    kick(t, level) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      osc.connect(decay(ctx, t, level === 2 ? 1.2 : 1, 0.3)).connect(drums);
      osc.start(t);
      osc.stop(t + 0.32);
      const clickEnv = decay(ctx, t, 0.3, 0.012);
      clickEnv.connect(drums);
      const clickHp = filter(ctx, 'highpass', 3000);
      clickHp.connect(clickEnv);
      noiseBurst(t, 0.012, clickHp);
    },

    snare(t, level) {
      const body = decay(ctx, t, level === 2 ? 0.8 : 0.6, 0.18);
      body.connect(drums);
      const bp = filter(ctx, 'bandpass', 1800, 0.8);
      bp.connect(body);
      noiseBurst(t, 0.2, bp);
      const tone = ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.value = 190;
      tone.connect(decay(ctx, t, 0.4, 0.1)).connect(drums);
      tone.start(t);
      tone.stop(t + 0.12);
    },

    hat(t, level) {
      const open = level === 2;
      const g = decay(ctx, t, 0.16, open ? 0.25 : 0.04);
      g.connect(drums);
      const hp = filter(ctx, 'highpass', 7500);
      hp.connect(g);
      noiseBurst(t, open ? 0.26 : 0.05, hp);
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
