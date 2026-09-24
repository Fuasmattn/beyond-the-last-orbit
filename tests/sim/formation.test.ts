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
    const cols = s.diff.cols;
    expect(s.enemies).toHaveLength(ENEMY.rows * cols);
    expect(s.formation.total).toBe(ENEMY.rows * cols);
    const left = s.formation.x;
    const right = FIELD_W - (left + formationWidth(cols));
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('puts gunners in the top row and grunts below on stage 1', () => {
    const s = createInitialState(1);
    expect(s.enemies.filter((e) => e.row === 0).every((e) => e.kind === 'gunner')).toBe(true);
    expect(s.enemies.filter((e) => e.row > 0).every((e) => e.kind === 'grunt')).toBe(true);
  });

  it('spawns enemies at full hp and not diving', () => {
    const s = createInitialState(1);
    expect(s.enemies.every((e) => e.hp === e.maxHp && e.dive === null)).toBe(true);
  });

  it('marches in its direction and moves enemies with it', () => {
    const s = createInitialState(1);
    const x0 = s.enemies[0]!.x;
    updateFormation(s, 0.1);
    expect(s.enemies[0]!.x).toBeGreaterThan(x0);
  });

  it('reverses and drops when hitting the right edge', () => {
    const s = createInitialState(1);
    s.formation.x = FIELD_W - formationWidth(s.diff.cols) - FORMATION.edgeMargin - 0.1;
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
    expect(formationSpeed(40, 40, 10, 90)).toBe(10);
    expect(formationSpeed(1, 40, 10, 90)).toBeGreaterThan(formationSpeed(20, 40, 10, 90));
    expect(formationSpeed(0, 40, 10, 90)).toBe(90);
  });

  it('reports formation bottom', () => {
    const s = createInitialState(1);
    const expected = s.formation.y + (ENEMY.rows - 1) * ENEMY.spacingY + ENEMY.h;
    expect(formationBottom(s)).toBe(expected);
    s.enemies = [];
    expect(formationBottom(s)).toBe(-Infinity);
  });
});
