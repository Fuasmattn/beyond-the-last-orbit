import { BeatClock } from './beatClock';
import { judgeShot } from './rhythmJudge';
import { Sequencer } from './sequencer';
import { Sfx } from './sfx';
import type { CompiledSong } from './song';
import { createBuses, type Buses } from './synth';

const SCHEDULE_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.1;
const START_DELAY_SEC = 0.1;
const FADE_SEC = 0.5;

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

  private constructor(
    private readonly ctx: AudioContext,
    private readonly buses: Buses,
  ) {
    this.sfx = new Sfx(ctx, buses.sfx);
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

  /** Time the listener is hearing now (audio clock minus output latency). */
  private heardTime(): number {
    return this.ctx.currentTime - (this.ctx.outputLatency || 0);
  }

  startSong(song: CompiledSong): void {
    this.stopSong();
    const gain = this.ctx.createGain();
    gain.connect(this.buses.music);
    const start = this.ctx.currentTime + START_DELAY_SEC;
    const clock = new BeatClock(song.bpm, start);
    this.playing = {
      seq: new Sequencer(this.ctx, gain, song, clock),
      clock,
      gain,
      scheduledTo: start,
      arrangement: 'main',
    };
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

  setPaused(paused: boolean): void {
    if (!this.unlocked) return;
    void (paused ? this.ctx.suspend() : this.ctx.resume());
  }

  currentBeat(): number | null {
    return this.playing ? this.playing.clock.beatAt(this.heardTime()) : null;
  }

  judgeFire(offsetMs = 0): boolean | null {
    return judgeShot(this.playing?.clock ?? null, this.heardTime(), offsetMs);
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
