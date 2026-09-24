import { describe, expect, it } from 'vitest';
import { hueToRgb } from '../../src/view/color';
import { menuIndexAt } from '../../src/view/menuList';

describe('menuIndexAt', () => {
  const layout = { x: 80, y: 200, lineH: 14, width: 80 };

  it('maps taps to rows', () => {
    expect(menuIndexAt({ x: 100, y: 202 }, layout, 3)).toBe(0);
    expect(menuIndexAt({ x: 100, y: 215 }, layout, 3)).toBe(1);
  });

  it('ignores taps outside the list', () => {
    expect(menuIndexAt({ x: 100, y: 190 }, layout, 3)).toBeNull();
    expect(menuIndexAt({ x: 10, y: 202 }, layout, 3)).toBeNull();
    expect(menuIndexAt({ x: 100, y: 260 }, layout, 3)).toBeNull();
  });
});

describe('hueToRgb', () => {
  it('hits the primaries', () => {
    expect(hueToRgb(0)).toBe(0xff0000);
    expect(hueToRgb(1 / 3)).toBe(0x00ff00);
    expect(hueToRgb(2 / 3)).toBe(0x0000ff);
    expect(hueToRgb(1)).toBe(0xff0000);
  });
});
