import { describe, expect, it } from 'vitest';
import { mergeInputs } from '../../src/input/inputFrame';
import { NO_INPUT } from '../../src/sim/types';

describe('mergeInputs', () => {
  it('sums and clamps axes, sums drag, ORs fire', () => {
    const merged = mergeInputs([
      { ...NO_INPUT, moveX: 1, dragX: 2 },
      { ...NO_INPUT, moveX: 1, dragX: 3, firePressed: true, fireOnBeat: true },
    ]);
    expect(merged).toEqual({
      moveX: 1, moveY: 0, dragX: 5, dragY: 0, firePressed: true, fireOnBeat: true, firePerfect: false, beat: null,
    });
  });

  it('passes the first known beat through', () => {
    expect(mergeInputs([NO_INPUT, { ...NO_INPUT, beat: 3.5 }]).beat).toBe(3.5);
  });

  it('returns neutral input for no sources', () => {
    expect(mergeInputs([])).toEqual(NO_INPUT);
  });
});
