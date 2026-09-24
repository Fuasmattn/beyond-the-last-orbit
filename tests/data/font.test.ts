import { describe, expect, it } from 'vitest';
import { GLYPH_H, GLYPHS, textWidth } from '../../src/data/font';

describe('font', () => {
  it('covers A-Z, 0-9 and HUD punctuation with 3x5 glyphs', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -:.!/%+';
    for (const c of chars) {
      const g = GLYPHS[c];
      expect(g, c).toBeDefined();
      expect(g!).toHaveLength(GLYPH_H);
      for (const row of g!) expect(row).toHaveLength(3);
    }
  });

  it('measures text width', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('AB')).toBe(7);
  });
});
