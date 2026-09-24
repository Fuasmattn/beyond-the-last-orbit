import { describe, expect, it } from 'vitest';
import { blink, popInScale } from '../../src/view/anim';

describe('popInScale', () => {
  it('grows from 0 to 1 with a per-row delay', () => {
    expect(popInScale(0, 0)).toBe(0);
    expect(popInScale(0.25, 0)).toBeCloseTo(0.5);
    expect(popInScale(0.25, 2)).toBeCloseTo(0.1);
    expect(popInScale(1, 4)).toBe(1);
  });
});

describe('blink', () => {
  it('alternates at the given rate', () => {
    expect(blink(0, 5)).toBe(true);
    expect(blink(0.1, 5)).toBe(false);
    expect(blink(0.2, 5)).toBe(true);
  });
});
