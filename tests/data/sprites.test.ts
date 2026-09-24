import { describe, expect, it } from 'vitest';
import { DREAD, HIVE, MINI, WARDEN } from '../../src/data/balance';
import { SPRITES } from '../../src/data/sprites';

describe('sprites', () => {
  it('animation frames share dimensions', () => {
    const pairs = [
      SPRITES.grunt,
      SPRITES.gunner,
      SPRITES.diver,
      SPRITES.shield,
      SPRITES.shieldCracked,
      SPRITES.splitter,
      SPRITES.phaser,
      SPRITES.bomber,
      SPRITES.mini,
    ];
    for (const [a, b] of pairs) {
      expect(a.rows.length).toBe(b.rows.length);
      expect(a.rows.every((r) => r.length === a.rows[0]!.length)).toBe(true);
      expect(b.rows[0]!.length).toBe(a.rows[0]!.length);
    }
  });

  it('draws the mini at its hitbox size', () => {
    expect(SPRITES.mini[0].rows).toHaveLength(MINI.h);
    expect(SPRITES.mini[0].rows[0]).toHaveLength(MINI.w);
  });

  it('draws each boss at its hitbox size', () => {
    for (const [grid, size] of [
      [SPRITES.warden, WARDEN],
      [SPRITES.hive, HIVE],
      [SPRITES.dreadnought, DREAD],
    ] as const) {
      expect(grid.rows).toHaveLength(size.h);
      expect(grid.rows.every((r) => r.length === size.w)).toBe(true);
    }
  });
});
