import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/app/layout';

describe('computeLayout', () => {
  it('uses integer scale on a desktop window', () => {
    expect(computeLayout(1280, 960, 1)).toEqual({ scale: 3, offsetX: 280, offsetY: 0 });
  });

  it('uses integer device-pixel scale on a hi-dpi phone', () => {
    const l = computeLayout(390, 844, 3);
    expect(l.scale * 3).toBe(4);
    expect(l.offsetX).toBe(Math.round((390 - 240 * l.scale) / 2));
  });

  it('falls back to fractional scale on tiny viewports', () => {
    const l = computeLayout(300, 300, 1);
    expect(l.scale).toBeCloseTo(300 / 320);
  });
});
