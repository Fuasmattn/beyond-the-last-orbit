import { describe, expect, it } from 'vitest';
import { GLYPH_ADVANCE, GLYPH_H, GLYPH_W, GLYPHS, textWidth } from '../../src/data/font';

describe('font', () => {
  it('covers A-Z, 0-9 and HUD punctuation with 5x7 glyphs', () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -:.,'!/%+<>?";
    for (const c of chars) {
      const g = GLYPHS[c];
      expect(g, c).toBeDefined();
      expect(g!).toHaveLength(GLYPH_H);
      for (const row of g!) expect(row).toHaveLength(GLYPH_W);
    }
  });

  it('keeps look-alike glyphs distinct', () => {
    const same = (a: string, b: string) => GLYPHS[a]!.join('') === GLYPHS[b]!.join('');
    expect(same('B', '8')).toBe(false);
    expect(same('S', '5')).toBe(false);
    expect(same('O', '0')).toBe(false);
    expect(same('M', 'W')).toBe(false);
  });

  it('measures text width', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('AB')).toBe(2 * GLYPH_ADVANCE - 1);
  });
});
