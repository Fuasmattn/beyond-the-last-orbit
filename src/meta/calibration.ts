import { CALIBRATION } from '../data/balance';

/**
 * Latency offset in ms from press-time beat deltas (seconds, + = late).
 * Ignores outliers; null when too few usable taps.
 */
export function computeLatencyOffset(deltasSec: readonly number[]): number | null {
  const ms = deltasSec.map((d) => d * 1000).filter((d) => Math.abs(d) <= CALIBRATION.maxAbsMs);
  if (ms.length < Math.ceil(CALIBRATION.taps / 2)) return null;
  const sorted = [...ms].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(Math.min(CALIBRATION.maxOffsetMs, Math.max(-CALIBRATION.maxOffsetMs, median)));
}
