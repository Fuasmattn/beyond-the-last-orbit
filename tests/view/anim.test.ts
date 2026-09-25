import { describe, expect, it } from 'vitest';
import { blink } from '../../src/view/anim';

describe('blink', () => {
  it('alternates at the given rate', () => {
    expect(blink(0, 5)).toBe(true);
    expect(blink(0.1, 5)).toBe(false);
    expect(blink(0.2, 5)).toBe(true);
  });
});
