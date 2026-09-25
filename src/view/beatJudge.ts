import { RHYTHM } from '../data/balance';

export type JudgeLabel = 'PERFECT' | 'GOOD' | 'OFF';

/** How far ahead (in beats) markers appear on the beat track. */
export const LOOKAHEAD_BEATS = 2;
/** Markers linger this many beats past the gate while fading out. */
const TRAIL_BEATS = 0.1;

/**
 * Display grade for a shot. `onBeat` is the scoring verdict, so grades always agree with scoring;
 * `deltaSec` (signed distance to the nearest beat) only splits on-beat shots into PERFECT and GOOD.
 */
export function judgeLabel(deltaSec: number | null, onBeat: boolean): JudgeLabel {
  if (!onBeat) return 'OFF';
  return deltaSec !== null && Math.abs(deltaSec) <= RHYTHM.perfectSec ? 'PERFECT' : 'GOOD';
}

/** Distance of a beat's marker from the gate: `halfWidth` at the lookahead, 0 on the beat, negative after. */
export function markerOffset(targetBeat: number, beat: number, halfWidth: number): number {
  return ((targetBeat - beat) / LOOKAHEAD_BEATS) * halfWidth;
}

/** Whole beats whose markers are on the track at `beat`. */
export function upcomingBeats(beat: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(beat - TRAIL_BEATS); k <= beat + LOOKAHEAD_BEATS; k++) out.push(k);
  return out;
}
