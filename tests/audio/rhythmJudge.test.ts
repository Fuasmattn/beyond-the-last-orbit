import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/audio/beatClock';
import { judgeShot } from '../../src/audio/rhythmJudge';
import { RHYTHM } from '../../src/data/balance';

describe('judgeShot', () => {
  const clock = new BeatClock(120, 0);

  it('returns null without a clock', () => {
    expect(judgeShot(null, 1)).toBeNull();
  });

  it('accepts shots inside the window and rejects outside', () => {
    expect(judgeShot(clock, 1 + RHYTHM.windowSec - 0.001)).toBe(true);
    expect(judgeShot(clock, 1 - RHYTHM.windowSec + 0.001)).toBe(true);
    expect(judgeShot(clock, 1 + RHYTHM.windowSec + 0.01)).toBe(false);
    expect(judgeShot(clock, 1.25)).toBe(false);
  });

  it('applies the calibration offset', () => {
    // player consistently 150 ms late → offset +150 ms makes it on-beat
    expect(judgeShot(clock, 1.15)).toBe(false);
    expect(judgeShot(clock, 1.15, 150)).toBe(true);
  });

  it('caps the window at a quarter beat for fast tempos', () => {
    const fast = new BeatClock(240, 0); // 250 ms beats → ±62.5 ms
    expect(judgeShot(fast, 0.25 + 0.06)).toBe(true);
    expect(judgeShot(fast, 0.25 + 0.07)).toBe(false);
  });

  it('rejects shots before the song starts', () => {
    expect(judgeShot(new BeatClock(120, 5), 1)).toBe(false);
  });
});
