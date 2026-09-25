import { RHYTHM } from '../data/balance';
import type { BeatClock } from './beatClock';

/**
 * Was a press at `heardTime` (audio clock minus output latency) on the beat?
 * `offsetMs` > 0 compensates a player who presses late.
 */
export function judgeShot(clock: BeatClock | null, heardTime: number, offsetMs = 0): boolean | null {
  if (!clock) return null;
  const t = heardTime - offsetMs / 1000;
  const window = onBeatWindow(clock);
  if (t < clock.startTime - window) return false;
  return Math.abs(clock.gridDelta(t, RHYTHM.subdivision)) <= window;
}

/** ± seconds that count as on-beat at this clock's tempo. */
export function onBeatWindow(clock: BeatClock): number {
  return Math.min(RHYTHM.windowSec, (clock.beatDur / RHYTHM.subdivision) * RHYTHM.maxWindowBeats);
}
