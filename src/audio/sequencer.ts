import { SOUR } from '../data/balance';
import type { BeatClock } from './beatClock';
import {
  nextBarStep,
  resolveStep,
  STEPS_PER_BEAT,
  stepsInWindow,
  type CompiledArrangement,
  type CompiledSong,
} from './song';
import { createRig, type Rig } from './synth';

const MIN_NOTE = 0.04;
const TWIN_PAN = 0.4;

interface Cursor {
  arr: CompiledArrangement;
  startStep: number;
}

export class Sequencer {
  private readonly rig: Rig;
  private readonly stepDur: number;
  private current: Cursor;
  private pending: Cursor | null = null;
  /** 0..1 — random per-note detune for off-beat "sour" playing. */
  sour = 0;

  constructor(
    ctx: BaseAudioContext,
    out: AudioNode,
    private readonly song: CompiledSong,
    private readonly clock: BeatClock,
  ) {
    this.rig = createRig(ctx, out);
    this.stepDur = clock.beatDur / STEPS_PER_BEAT;
    this.current = { arr: this.arrangement('main'), startStep: 0 };
  }

  /** Switch to arrangement `name` at the first bar line at or after `fromTime`. */
  queue(name: string, fromTime: number): void {
    this.pending = { arr: this.arrangement(name), startStep: nextBarStep(this.clock, fromTime) };
  }

  /** Schedules every 16th step whose time falls in [from, to). */
  scheduleRange(from: number, to: number): void {
    for (const { index, time } of stepsInWindow(this.clock, from, to)) {
      if (this.pending && index >= this.pending.startStep) {
        this.current = this.pending;
        this.pending = null;
      }
      const r = resolveStep(this.current.arr, index - this.current.startStep);
      if (!r) continue;
      const { section: s, step } = r;

      const g = s.guitar[step];
      if (g) {
        const dur = Math.max(MIN_NOTE, g.mute ? this.stepDur * 0.8 : g.len * this.stepDur);
        this.rig.guitar(time, g.midi, dur, g.mute, this.detune());
        this.rig.bass(time, g.midi - 12, dur, g.mute, this.detune());
      }
      const l = s.lead[step];
      const l2 = s.lead2[step];
      const twin = s.lead2.some((e) => e !== undefined);
      if (l) this.rig.lead(time, l.midi, Math.max(MIN_NOTE, l.len * this.stepDur), twin ? -TWIN_PAN : 0, this.detune());
      if (l2) this.rig.lead(time, l2.midi, Math.max(MIN_NOTE, l2.len * this.stepDur), TWIN_PAN, this.detune());

      const kick = s.kick[step] ?? 0;
      if (kick) this.rig.kick(time, kick);
      const snare = s.snare[step] ?? 0;
      if (snare) this.rig.snare(time, snare);
      const hat = s.hat[step] ?? 0;
      if (hat) this.rig.hat(time, hat);
      if (s.crash[step]) this.rig.crash(time);
    }
  }

  private detune(): number {
    return this.sour * SOUR.maxDetuneCents * (Math.random() * 2 - 1);
  }

  private arrangement(name: string): CompiledArrangement {
    const a = this.song.arrangements[name];
    if (!a) throw new Error(`unknown arrangement "${name}" in song "${this.song.name}"`);
    return a;
  }
}
