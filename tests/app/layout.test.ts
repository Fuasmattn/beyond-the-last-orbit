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

describe('computeLayout on touch', () => {
  it('fills a portrait phone edge to edge with a wider field', () => {
    const l = computeLayout(390, 844, true);
    expect(l.scale).toBeCloseTo(844 / 320);
    expect(l.viewW * l.scale).toBeCloseTo(390);
    expect(l.offsetX).toBe(0);
    expect(l.offsetY).toBe(0);
    expect(l.fieldW).toBe(Math.round(l.viewW * 1.3));
  });

  it('never makes the field narrower than the view', () => {
    const l = computeLayout(1024, 768, true);
    expect(l.fieldW).toBeGreaterThanOrEqual(l.viewW);
    expect(l.fieldW).toBeLessThanOrEqual(600);
  });

  it('letterboxes only extreme aspects', () => {
    const l = computeLayout(2000, 400, true);
    expect(l.viewW).toBe(600);
    expect(l.offsetX).toBeGreaterThan(0);
  });
});
