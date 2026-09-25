import { RHYTHM } from '../data/balance';
import type { BeatClock } from './beatClock';

/** Rhythm verdict for one press. `perfect` implies `onBeat`. */
export interface ShotJudgement {
  onBeat: boolean;
  perfect: boolean;
}

/**
 * Judges a press at `heardTime` (audio clock minus output latency); null without a clock.
 * `offsetMs` > 0 compensates a player who presses late.
 */
export function gradeShot(clock: BeatClock | null, heardTime: number, offsetMs = 0): ShotJudgement | null {
  if (!clock) return null;
  const t = heardTime - offsetMs / 1000;
  const window = onBeatWindow(clock);
  if (t < clock.startTime - window) return { onBeat: false, perfect: false };
  const d = Math.abs(clock.gridDelta(t, RHYTHM.subdivision));
  return { onBeat: d <= window, perfect: d <= Math.min(window, RHYTHM.perfectSec) };
}

/** Was the press on the beat? See `gradeShot`. */
export function judgeShot(clock: BeatClock | null, heardTime: number, offsetMs = 0): boolean | null {
  return gradeShot(clock, heardTime, offsetMs)?.onBeat ?? null;
}

/** ± seconds that count as on-beat at this clock's tempo. */
export function onBeatWindow(clock: BeatClock): number {
  return Math.min(RHYTHM.windowSec, (clock.beatDur / RHYTHM.subdivision) * RHYTHM.maxWindowBeats);
}
