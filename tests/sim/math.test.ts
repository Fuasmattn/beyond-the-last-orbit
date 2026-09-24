import { describe, expect, it } from 'vitest';
import { clamp } from '../../src/sim/math';

describe('clamp', () => {
  it('clamps below, inside, above', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
