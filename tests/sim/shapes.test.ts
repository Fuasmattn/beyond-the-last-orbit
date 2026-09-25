import { describe, expect, it } from 'vitest';
import { ENEMY, FORMATION } from '../../src/data/balance';
import { SHAPE_KINDS, shapeWidth, slotOffset, stageShapes } from '../../src/sim/shapes';

const ROWS = ENEMY.rows;

describe('slotOffset', () => {
  for (const kind of SHAPE_KINDS) {
    for (const fieldW of [140, 240, 600]) {
      for (const cols of [8, 9, 10]) {
        it(`${kind} ${cols} cols fits a ${fieldW}px field without overlaps`, () => {
          const width = shapeWidth(cols, fieldW);
          const slots: { dx: number; dy: number }[] = [];
          for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < cols; col++) slots.push(slotOffset(kind, row, col, cols, width));
          }
          for (const s of slots) {
            expect(s.dy).toBeGreaterThanOrEqual(0);
            expect(Math.abs(s.dx) + ENEMY.w / 2).toBeLessThanOrEqual(fieldW / 2 - FORMATION.edgeMargin + 1e-9);
          }
          for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
              const a = slots[i]!;
              const b = slots[j]!;
              const apart = Math.abs(a.dx - b.dx) >= ENEMY.w || Math.abs(a.dy - b.dy) >= ENEMY.h;
              expect(apart, `slots ${i} and ${j} overlap`).toBe(true);
            }
          }
        });
      }
    }
  }
});

describe('shapeWidth', () => {
  it('grows with wider fields but never beyond 1.5x spacing', () => {
    expect(shapeWidth(8, 600)).toBeGreaterThan(shapeWidth(8, 240));
    expect(shapeWidth(8, 600)).toBeCloseTo(7 * ENEMY.spacingX * 1.5);
  });

  it('shrinks to fit narrow fields', () => {
    expect(shapeWidth(10, 140)).toBeLessThan(9 * ENEMY.spacingX);
  });
});

describe('stageShapes', () => {
  it('gives every formation stage at least two shapes', () => {
    for (let world = 0; world < 3; world++) {
      for (let stage = 1; stage <= 4; stage++) expect(stageShapes(world, stage).length).toBeGreaterThanOrEqual(2);
    }
  });
});
