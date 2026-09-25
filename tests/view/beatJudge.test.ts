import { describe, expect, it } from 'vitest';
import { RHYTHM } from '../../src/data/balance';
import { judgeLabel, LOOKAHEAD_BEATS, markerOffset, upcomingBeats } from '../../src/view/beatJudge';

describe('judgeLabel', () => {
  it('grades by distance from the beat', () => {
    expect(judgeLabel(0, true)).toBe('PERFECT');
    expect(judgeLabel(-RHYTHM.perfectSec, true)).toBe('PERFECT');
    expect(judgeLabel(RHYTHM.perfectSec + 0.005, true)).toBe('GOOD');
    expect(judgeLabel(-RHYTHM.windowSec, true)).toBe('GOOD');
    expect(judgeLabel(RHYTHM.windowSec + 0.02, false)).toBe('OFF');
  });

  it('falls back to the sim verdict without a delta', () => {
    expect(judgeLabel(null, true)).toBe('GOOD');
    expect(judgeLabel(null, false)).toBe('OFF');
  });
});

describe('markerOffset', () => {
  it('is zero on the beat and the full half-width at the lookahead', () => {
    expect(markerOffset(8, 8, 100)).toBe(0);
    expect(markerOffset(8 + LOOKAHEAD_BEATS, 8, 100)).toBe(100);
    expect(markerOffset(9, 8, 100)).toBeCloseTo(100 / LOOKAHEAD_BEATS);
  });

  it('goes negative once the beat has passed', () => {
    expect(markerOffset(8, 8.2, 100)).toBeLessThan(0);
  });
});

describe('upcomingBeats', () => {
  it('lists whole beats from just behind the gate up to the lookahead', () => {
    expect(upcomingBeats(4.5)).toEqual([5, 6]);
    expect(upcomingBeats(4.05)).toEqual([4, 5, 6]);
  });
});
