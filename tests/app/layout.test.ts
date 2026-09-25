import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/app/layout';

describe('computeLayout', () => {
  it('fits height and derives width on desktop', () => {
    const l = computeLayout(1280, 800);
    expect(l.fieldW).toBe(512);
    expect(l.scale).toBeCloseTo(2.5);
    expect(l.offsetX).toBe(0);
    expect(l.offsetY).toBe(0);
  });

  it('clamps ultra-wide to 600 and centers', () => {
    const l = computeLayout(3200, 800);
    expect(l.fieldW).toBe(600);
    expect(l.offsetX).toBe(Math.round((3200 - 600 * 2.5) / 2));
  });

  it('clamps very tall screens to 140 and fits width', () => {
    const l = computeLayout(300, 900);
    expect(l.fieldW).toBe(140);
    expect(l.scale).toBeCloseTo(300 / 140);
    expect(l.offsetY).toBe(Math.round((900 - 320 * l.scale) / 2));
  });

  it('fills a typical phone exactly', () => {
    const l = computeLayout(390, 844);
    expect(l.fieldW).toBe(Math.round((320 * 390) / 844));
    expect(l.offsetY).toBe(0);
  });
});
