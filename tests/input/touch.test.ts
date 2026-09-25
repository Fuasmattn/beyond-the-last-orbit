import { describe, expect, it } from 'vitest';
import { fireButton, isInFireButton } from '../../src/input/touch';

describe('isInFireButton', () => {
  it('hits the center and misses the left side', () => {
    const b = fireButton(300);
    expect(isInFireButton(b.x, b.y, 300)).toBe(true);
    expect(isInFireButton(20, b.y, 300)).toBe(false);
  });
});
