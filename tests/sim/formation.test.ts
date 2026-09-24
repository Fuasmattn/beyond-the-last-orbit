import { describe, expect, it } from 'vitest';
import { ENEMY, FIELD_W, FORMATION } from '../../src/data/balance';
import {
  formationBottom,
  formationSpeed,
  formationWidth,
  updateFormation,
} from '../../src/sim/formation';
import { createInitialState } from '../../src/sim/state';

describe('formation', () => {
  it('spawns rows × cols enemies centered horizontally', () => {
    const s = createInitialState(1);
    expect(s.enemies).toHaveLength(ENEMY.rows * ENEMY.cols);
    expect(s.formation.total).toBe(ENEMY.rows * ENEMY.cols);
    const left = s.formation.x;
    const right = FIELD_W - (left + formationWidth());
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('puts gunners in the top row and grunts below', () => {
    const s = createInitialState(1);
    expect(s.enemies.filter((e) => e.row === 0).every((e) => e.kind === 'gunner')).toBe(true);
    expect(s.enemies.filter((e) => e.row > 0).every((e) => e.kind === 'grunt')).toBe(true);
  });

  it('marches in its direction and moves enemies with it', () => {
    const s = createInitialState(1);
    const x0 = s.enemies[0]!.x;
    updateFormation(s, 0.1);
    expect(s.enemies[0]!.x).toBeGreaterThan(x0);
  });

  it('reverses and drops when hitting the right edge', () => {
    const s = createInitialState(1);
    s.formation.x = FIELD_W - formationWidth() - FORMATION.edgeMargin - 0.1;
    const y0 = s.formation.y;
    updateFormation(s, 0.5);
    expect(s.formation.dir).toBe(-1);
    expect(s.formation.y).toBe(y0 + FORMATION.dropStep);
    const maxRight = Math.max(...s.enemies.map((e) => e.x + e.w));
    expect(maxRight).toBeLessThanOrEqual(FIELD_W - FORMATION.edgeMargin + 1e-9);
  });

  it('uses only surviving columns for edge detection', () => {
    const s = createInitialState(1);
    s.enemies = s.enemies.filter((e) => e.col < 2);
    s.formation.x = 100;
    updateFormation(s, 0.1);
    expect(s.formation.dir).toBe(1);
  });

  it('speeds up as enemies die', () => {
    expect(formationSpeed(40, 40)).toBe(FORMATION.minSpeed);
    expect(formationSpeed(1, 40)).toBeGreaterThan(formationSpeed(20, 40));
    expect(formationSpeed(0, 40)).toBe(FORMATION.maxSpeed);
  });

  it('reports formation bottom', () => {
    const s = createInitialState(1);
    const expected = s.formation.y + (ENEMY.rows - 1) * ENEMY.spacingY + ENEMY.h;
    expect(formationBottom(s)).toBe(expected);
    s.enemies = [];
    expect(formationBottom(s)).toBe(-Infinity);
  });
});
