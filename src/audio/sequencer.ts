import type { BeatClock } from './beatClock';
import { resolveStep, STEPS_PER_BEAT, stepsInWindow, type CompiledSong } from './song';
import { createRig, type Rig } from './synth';

const MIN_NOTE = 0.04;

export class Sequencer {
  private readonly rig: Rig;
  private readonly stepDur: number;

  constructor(
    ctx: BaseAudioContext,
    out: AudioNode,
    private readonly song: CompiledSong,
    private readonly clock: BeatClock,
  ) {
    this.rig = createRig(ctx, out);
    this.stepDur = clock.beatDur / STEPS_PER_BEAT;
  }

  /** Schedules every 16th step whose time falls in [from, to). */
  scheduleRange(from: number, to: number): void {
    for (const { index, time } of stepsInWindow(this.clock, from, to)) {
      const r = resolveStep(this.song, index);
      if (!r) continue;
      const { section: s, step } = r;

      const g = s.guitar[step];
      if (g) {
        const dur = Math.max(MIN_NOTE, g.mute ? this.stepDur * 0.8 : g.len * this.stepDur);
        this.rig.guitar(time, g.midi, dur, g.mute);
        this.rig.bass(time, g.midi - 12, dur, g.mute);
      }
      const l = s.lead[step];
      if (l) this.rig.lead(time, l.midi, Math.max(MIN_NOTE, l.len * this.stepDur));

      const kick = s.kick[step] ?? 0;
      if (kick) this.rig.kick(time, kick);
      const snare = s.snare[step] ?? 0;
      if (snare) this.rig.snare(time, snare);
      const hat = s.hat[step] ?? 0;
      if (hat) this.rig.hat(time, hat);
      if (s.crash[step]) this.rig.crash(time);
    }
  }
}
