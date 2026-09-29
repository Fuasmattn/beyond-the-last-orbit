import { afterEach, describe, expect, it } from 'vitest';
import { viewport } from '../../src/app/viewport';
import { MENU_W, MENU_W_TOUCH, TOUCH_VIEW } from '../../src/data/balance';
import { LASERS, SKINS } from '../../src/data/cosmetics';
import { textWidth } from '../../src/data/font';
import { UPGRADES } from '../../src/data/upgrades';
import { centerX, menuListLayout, narrowMenu } from '../../src/scenes/ui';
import { BOONS } from '../../src/sim/boons';
import { hueToRgb } from '../../src/view/color';
import { formatHighscoreLine, highscoreTableX } from '../../src/view/highscoreTable';
import { menuIndexAt } from '../../src/view/menuList';
import { charsThatFit, wrapText } from '../../src/view/pixelText';
import { EVENTS } from '../../src/data/events';

afterEach(() => {
  viewport.menuW = MENU_W;
});

describe('menu frame', () => {
  const desktop = { x: 28, y: 60, lineH: 16, width: 184 };

  it('keeps desktop coordinates on the full frame', () => {
    expect(narrowMenu()).toBe(false);
    expect(centerX(32)).toBe(104);
    expect(menuListLayout(desktop)).toEqual(desktop);
    expect(highscoreTableX()).toBe(57);
  });

  it('fits lists and tables into the narrow touch frame', () => {
    viewport.menuW = MENU_W_TOUCH;
    expect(narrowMenu()).toBe(true);
    const l = menuListLayout(desktop);
    expect(l).toMatchObject({ y: 60, lineH: 16 });
    expect(l.x - 8).toBeGreaterThanOrEqual(4);
    expect(l.x + l.width).toBeLessThanOrEqual(MENU_W_TOUCH - 4);
    const longest = formatHighscoreLine(10, { initials: 'WWW', score: 9999999, world: 2, stage: 5, loop: 9, date: '' });
    expect(highscoreTableX()).toBeGreaterThanOrEqual(4);
    expect(highscoreTableX() + textWidth(longest)).toBeLessThanOrEqual(MENU_W_TOUCH - 4);
  });

  it('fits hangar and shop rows next to their values on the narrow frame', () => {
    viewport.menuW = MENU_W_TOUCH;
    const { width } = menuListLayout(desktop);
    const fits = (label: string, value: string) => textWidth(label) + 4 + textWidth(value) <= width;
    for (const u of UPGRADES) {
      expect(fits(u.name, `${Math.max(...u.costs)} CR`), u.name).toBe(true);
      expect(textWidth(u.desc), u.desc).toBeLessThanOrEqual(MENU_W_TOUCH - 8);
    }
    for (const c of [...SKINS, ...LASERS]) expect(fits(c.name, c.price > 0 ? `${c.price} CR` : 'EQUIPPED'), c.name).toBe(true);
  });

  it('fits draft cards on the narrowest touch view', () => {
    const panel = Math.min(200, TOUCH_VIEW.minW - 8);
    // Line 1 shares the card with a 16 px icon (3 px inset, 3 px gap); lines 2–3 may wrap once.
    const nameW = panel - (3 + 16 + 3) - 2;
    const maxChars = charsThatFit(panel - 4);
    for (const b of BOONS) {
      expect(textWidth(`${b.name} LV${Math.min(b.max, 9)}`), b.name).toBeLessThanOrEqual(nameW);
      const lines = wrapText(b.desc, maxChars);
      expect(lines.length, b.desc).toBeLessThanOrEqual(2);
      for (const l of lines) expect(textWidth(l), b.desc).toBeLessThanOrEqual(panel - 4);
    }
  });

  it('fits event text on the narrowest touch view', () => {
    const panel = Math.min(150, TOUCH_VIEW.minW - 8);
    const maxChars = charsThatFit(panel - 4);
    for (const e of EVENTS) {
      for (const s of [...e.lines, ...e.choices]) {
        const lines = wrapText(s, maxChars);
        expect(lines.length, s).toBeLessThanOrEqual(2);
        for (const l of lines) expect(textWidth(l), s).toBeLessThanOrEqual(panel - 4);
      }
    }
  });

  it('wraps at spaces and leaves short text alone', () => {
    expect(wrapText('SIDE BOLTS BOUNCE ONCE', 20)).toEqual(['SIDE BOLTS BOUNCE', 'ONCE']);
    expect(wrapText('SHORT', 20)).toEqual(['SHORT']);
  });
});

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
