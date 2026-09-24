import { describe, expect, it } from 'vitest';
import { FIRE_BUTTON, isInFireButton } from '../../src/input/touch';

describe('isInFireButton', () => {
  it('hits the center and misses the left side', () => {
    expect(isInFireButton(FIRE_BUTTON.x, FIRE_BUTTON.y)).toBe(true);
    expect(isInFireButton(20, FIRE_BUTTON.y)).toBe(false);
  });
});
