import { describe, expect, it } from 'vitest';
import { Sourness } from '../../src/audio/sourness';
import { SOUR } from '../../src/data/balance';

describe('Sourness', () => {
  it('starts clean', () => {
    expect(new Sourness().value).toBe(0);
  });

  it('sours on off-beat shots up to fully sour', () => {
    const s = new Sourness();
    s.onShot(false);
    expect(s.value).toBeCloseTo(SOUR.offBeatHit);
    for (let i = 0; i < 10; i++) s.onShot(false);
    expect(s.value).toBe(1);
  });

  it('recovers on on-beat shots and over time', () => {
    const s = new Sourness();
    s.value = 1;
    s.onShot(true);
    expect(s.value).toBeCloseTo(1 - SOUR.onBeatRelief);
    s.update(1);
    expect(s.value).toBeCloseTo(1 - SOUR.onBeatRelief - SOUR.decayPerSec);
    s.update(100);
    expect(s.value).toBe(0);
  });
});
