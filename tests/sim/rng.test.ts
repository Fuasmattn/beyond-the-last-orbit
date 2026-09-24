import { describe, expect, it } from 'vitest';
import { nextRandom } from '../../src/sim/rng';

describe('nextRandom', () => {
  it('is deterministic for the same seed', () => {
    const a = { seed: 42 };
    const b = { seed: 42 };
    const seqA = Array.from({ length: 5 }, () => nextRandom(a));
    const seqB = Array.from({ length: 5 }, () => nextRandom(b));
    expect(seqA).toEqual(seqB);
  });

  it('differs for different seeds', () => {
    expect(nextRandom({ seed: 1 })).not.toEqual(nextRandom({ seed: 2 }));
  });

  it('returns values in [0, 1)', () => {
    const rng = { seed: 7 };
    for (let i = 0; i < 1000; i++) {
      const v = nextRandom(rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
