import { describe, expect, it } from 'vitest';
import { GLYPH_H, GLYPHS, textWidth } from '../../src/data/font';
import { SPRITES } from '../../src/data/sprites';

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

describe('sprites', () => {
  it('animation frames share dimensions', () => {
    for (const frames of [SPRITES.grunt, SPRITES.gunner, SPRITES.diver, SPRITES.shield, SPRITES.shieldCracked]) {
      expect(frames[0].rows.length).toBe(frames[1].rows.length);
      expect(frames[0].rows[0]!.length).toBe(frames[1].rows[0]!.length);
    }
  });

  it('draws the Warden at its hitbox size', () => {
    expect(SPRITES.wardenBody.rows).toHaveLength(20);
    expect(SPRITES.wardenBody.rows.every((r) => r.length === 56)).toBe(true);
  });
});
