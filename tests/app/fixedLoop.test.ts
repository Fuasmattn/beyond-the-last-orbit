import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../../src/app/fixedLoop';

describe('FixedLoop', () => {
  it('runs whole steps and returns the remainder as alpha', () => {
    const loop = new FixedLoop(0.01, 5);
    let n = 0;
    const alpha = loop.advance(0.025, () => n++);
    expect(n).toBe(2);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('carries the remainder into the next frame', () => {
    const loop = new FixedLoop(0.01, 5);
    let n = 0;
    loop.advance(0.006, () => n++);
    loop.advance(0.006, () => n++);
    expect(n).toBe(1);
  });

  it('caps steps per frame and drops the backlog', () => {
    const loop = new FixedLoop(0.01, 5);
    let n = 0;
    loop.advance(1, () => n++);
    expect(n).toBe(5);
    loop.advance(0, () => n++);
    expect(n).toBe(5);
  });
});
