import { describe, expect, it } from 'vitest';
import { beatPulse, lerpColor } from '../../src/view/beatPulse';

describe('beatPulse', () => {
  it('peaks on the downbeat and halves on other beats', () => {
    expect(beatPulse(0)).toBe(1);
    expect(beatPulse(4)).toBe(1);
    expect(beatPulse(1)).toBe(0.5);
  });

  it('decays within the beat', () => {
    expect(beatPulse(0.5)).toBeCloseTo(0.0625);
    expect(beatPulse(0.99)).toBeLessThan(0.001);
  });

  it('is zero before the song and without audio', () => {
    expect(beatPulse(-0.5)).toBe(0);
    expect(beatPulse(null)).toBe(0);
  });
});

describe('lerpColor', () => {
  it('interpolates per channel', () => {
    expect(lerpColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(lerpColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(lerpColor(0x000000, 0x204060, 0.5)).toBe(0x102030);
  });
});
