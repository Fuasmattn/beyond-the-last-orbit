import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/audio/beatClock';

describe('BeatClock', () => {
  const clock = new BeatClock(120, 10); // 0.5 s per beat

  it('converts time to beats and back', () => {
    expect(clock.beatDur).toBe(0.5);
    expect(clock.beatAt(10)).toBe(0);
    expect(clock.beatAt(11.25)).toBeCloseTo(2.5);
    expect(clock.timeOfBeat(4)).toBe(12);
    expect(clock.beatAt(9.5)).toBe(-1);
  });

  it('measures signed distance to the nearest grid line', () => {
    expect(clock.gridDelta(11, 1)).toBeCloseTo(0);
    expect(clock.gridDelta(11.05, 1)).toBeCloseTo(0.05);
    expect(clock.gridDelta(10.95, 1)).toBeCloseTo(-0.05);
    expect(clock.gridDelta(11.3, 2)).toBeCloseTo(0.05); // 8th grid every 0.25 s
  });

  it('reports phase within the beat', () => {
    expect(clock.beatPhase(10.25)).toBeCloseTo(0.5);
    expect(clock.beatPhase(9.75)).toBeCloseTo(0.5);
  });
});
