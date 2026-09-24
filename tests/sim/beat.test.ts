import { describe, expect, it } from 'vitest';
import { worldAt } from '../../src/data/worlds';
import { beatsCrossed } from '../../src/sim/beat';
import { createInitialState } from '../../src/sim/state';

describe('beatsCrossed', () => {
  it('returns 0 on the first call, then counts whole-beat crossings', () => {
    const s = createInitialState(1);
    expect(beatsCrossed(s, 0.5)).toBe(0);
    expect(beatsCrossed(s, 0.9)).toBe(0);
    expect(beatsCrossed(s, 1.1)).toBe(1);
    expect(beatsCrossed(s, 3.2)).toBe(2);
  });

  it('caps large jumps', () => {
    const s = createInitialState(1);
    beatsCrossed(s, 0);
    expect(beatsCrossed(s, 100)).toBe(4);
  });

  it('never runs backwards', () => {
    const s = createInitialState(1);
    beatsCrossed(s, 5);
    expect(beatsCrossed(s, 2)).toBe(0);
    expect(beatsCrossed(s, 5.5)).toBe(0);
    expect(beatsCrossed(s, 6)).toBe(1);
  });

  it('falls back to sim time and world BPM without audio', () => {
    const s = createInitialState(1);
    s.time = 0;
    beatsCrossed(s, null);
    s.time = 60 / worldAt(0).bpm + 0.001;
    expect(beatsCrossed(s, null)).toBe(1);
  });
});
