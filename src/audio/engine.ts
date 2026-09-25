import { SOUR } from '../data/balance';
import { BeatClock } from './beatClock';
import { AudioClockSync } from './clockSync';
import { judgeShot } from './rhythmJudge';
import { Sequencer } from './sequencer';
import { Sfx } from './sfx';
import type { CompiledSong } from './song';
import { createBuses, type Buses } from './synth';

const SCHEDULE_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.1;
const START_DELAY_SEC = 0.1;
const FADE_SEC = 0.5;
/** Fixed delay of the warble line; music is heard this much later than scheduled. */
const WARBLE_BASE_SEC = 0.012;
const WARBLE_RATE_HZ = 5.5;
/** Presses whose event timestamp is older than this are judged at handler time instead. */
const MAX_PRESS_AGE_MS = 150;
/** Typical render-to-display delay: visuals are drawn for when they will be seen, not for now. */
const VISUAL_LEAD_SEC = 0.02;
/** Bus levels at volume 1 (match createBuses). */
const MUSIC_LEVEL = 0.7;
const SFX_LEVEL = 0.8;

interface Playing {
  seq: Sequencer;
  clock: BeatClock;
  gain: GainNode;
  scheduledTo: number;
  arrangement: string;
}

export class AudioEngine {
  readonly sfx: Sfx;
  private playing: Playing | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlocked = false;
  private readonly warbleIn: GainNode;
  private readonly warbleDepth: GainNode;
  private sour = 0;
  private readonly sync = new AudioClockSync();
  private visualOffsetSec = 0;

  private constructor(
    private readonly ctx: AudioContext,
    private readonly buses: Buses,
  ) {
    this.sfx = new Sfx(ctx, buses.sfx);
    // Music → modulated delay line → music bus. Modulating the delay time bends the pitch
    // of everything passing through (tape warble); depth 0 = clean.
    this.warbleIn = ctx.createGain();
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = WARBLE_BASE_SEC;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = WARBLE_RATE_HZ;
    this.warbleDepth = ctx.createGain();
    this.warbleDepth.gain.value = 0;
    lfo.connect(this.warbleDepth).connect(delay.delayTime);
    lfo.start();
    this.warbleIn.connect(delay).connect(buses.music);
  }

  static create(): AudioEngine | null {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      return new AudioEngine(ctx, createBuses(ctx));
    } catch (err) {
      console.warn('Audio unavailable', err);
      return null;
    }
  }

  /** Call from inside a user-gesture handler. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    void this.ctx.resume();
  }

  /**
   * Musical time the listener hears at `perfMs` (a `performance.now()` / event timestamp; default now),
   * with output latency and warble delay removed. Smoothed across the audio clock's buffer steps.
   */
  private heardTime(perfMs?: number): number {
    const now = performance.now();
    this.sync.sample(this.ctx.currentTime, now);
    const age = perfMs === undefined ? 0 : now - perfMs;
    const at = age >= 0 && age <= MAX_PRESS_AGE_MS ? now - age : now;
    return this.sync.at(at) - (this.ctx.outputLatency || 0) - WARBLE_BASE_SEC;
  }

  startSong(song: CompiledSong): void {
    this.stopSong();
    const gain = this.ctx.createGain();
    gain.connect(this.warbleIn);
    const start = this.ctx.currentTime + START_DELAY_SEC;
    const clock = new BeatClock(song.bpm, start);
    const seq = new Sequencer(this.ctx, gain, song, clock);
    seq.sour = this.sour;
    this.playing = { seq, clock, gain, scheduledTo: start, arrangement: 'main' };
    this.tick();
    this.timer = setInterval(() => this.tick(), SCHEDULE_INTERVAL_MS);
  }

  /** Switch arrangement at the next bar line; no-op if it is already playing or queued. */
  queueArrangement(name: string): void {
    const p = this.playing;
    if (!p || p.arrangement === name) return;
    p.arrangement = name;
    p.seq.queue(name, p.scheduledTo);
  }

  /** 0 = clean … 1 = fully sour (warble + per-note detune). */
  setSour(value: number): void {
    if (Math.abs(value - this.sour) < 0.005) return;
    this.sour = value;
    this.warbleDepth.gain.setTargetAtTime(value * SOUR.warbleDepth, this.ctx.currentTime, 0.05);
    if (this.playing) this.playing.seq.sour = value;
  }

  stopSong(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const p = this.playing;
    if (!p) return;
    this.playing = null;
    const t = this.ctx.currentTime;
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, t + FADE_SEC);
    setTimeout(() => p.gain.disconnect(), (FADE_SEC + LOOKAHEAD_SEC) * 1000 + 100);
  }

  /** 0..1 each; applied on top of the fixed bus mix levels. */
  setVolumes(music: number, sfx: number): void {
    const t = this.ctx.currentTime;
    this.buses.music.gain.setTargetAtTime(MUSIC_LEVEL * music, t, 0.02);
    this.buses.sfx.gain.setTargetAtTime(SFX_LEVEL * sfx, t, 0.02);
  }

  /** Signed seconds from the nearest heard beat at `perfMs` (default now; no calibration offset); null if silent. */
  beatDelta(perfMs?: number): number | null {
    return this.playing ? this.playing.clock.gridDelta(this.heardTime(perfMs), 1) : null;
  }

  setPaused(paused: boolean): void {
    if (!this.unlocked) return;
    void (paused ? this.ctx.suspend() : this.ctx.resume());
  }

  /** Beat the listener hears when the frame being drawn now reaches the screen. */
  currentBeat(): number | null {
    if (!this.playing) return null;
    return this.playing.clock.beatAt(this.heardTime() + VISUAL_LEAD_SEC + this.visualOffsetSec);
  }

  /** User trim for beat visuals (+ = earlier), from Settings → Visual offset. */
  setVisualOffset(ms: number): void {
    this.visualOffsetSec = ms / 1000;
  }

  /** `perfMs`: the press event's timestamp, so handler delay does not count against the player. */
  judgeFire(offsetMs = 0, perfMs?: number): boolean | null {
    return judgeShot(this.playing?.clock ?? null, this.heardTime(perfMs), offsetMs);
  }

  private tick(): void {
    const p = this.playing;
    if (!p) return;
    const to = this.ctx.currentTime + LOOKAHEAD_SEC;
    if (to <= p.scheduledTo) return;
    p.seq.scheduleRange(p.scheduledTo, to);
    p.scheduledTo = to;
  }
}
