import { describe, expect, it } from 'vitest';
import { makeSoftClipCurve } from '../../src/audio/synth';

describe('makeSoftClipCurve', () => {
  it('is linear below the knee and stays below 1 at full scale', () => {
    const c = makeSoftClipCurve(0.8);
    const at = (x: number) => c[Math.round(((x + 1) / 2) * (c.length - 1))]!;
    expect(at(0.5)).toBeCloseTo(0.5, 2);
    expect(at(-0.5)).toBeCloseTo(-0.5, 2);
    expect(at(1)).toBeLessThan(1);
    expect(at(1)).toBeGreaterThan(0.9);
    expect(at(-1)).toBeGreaterThan(-1);
  });
});
