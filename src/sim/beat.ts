import { bpmFor } from '../data/worlds';
import type { SimState } from './types';

const MAX_BEATS_PER_STEP = 4;

/** Beat position from the audio clock when available, else from sim time and the world/loop BPM. */
export function currentBeat(state: SimState, external: number | null): number {
  return external ?? (state.time * bpmFor(state.world, state.loop)) / 60;
}

/**
 * Whole beats crossed since the previous call (0 on the first call / after a resync,
 * never negative). Also advances `state.beat.count`.
 */
export function beatsCrossed(state: SimState, external: number | null): number {
  const b = Math.floor(currentBeat(state, external));
  const last = state.beat.last;
  state.beat.last = last === null ? b : Math.max(last, b);
  if (last === null) return 0;
  const n = Math.min(MAX_BEATS_PER_STEP, Math.max(0, b - last));
  state.beat.count += n;
  return n;
}
