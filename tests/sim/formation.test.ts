import { describe, expect, it } from 'vitest';
import { ENEMY, FORMATION, SIM_DT } from '../../src/data/balance';
import { advanceBars, formationBottom, inFormation, slotPosition, updateFormation } from '../../src/sim/formation';
import { stageShapes } from '../../src/sim/shapes';
import { createInitialState } from '../../src/sim/state';
import type { SimState } from '../../src/sim/types';

/** Runs the formation for `seconds`, crossing a beat every `beatSec`. */
function run(s: SimState, seconds: number, beatSec = 0.4): void {
  let acc = 0;
  for (let t = 0; t < seconds; t += SIM_DT) {
    acc += SIM_DT;
    let beats = 0;
    while (acc >= beatSec) {
      acc -= beatSec;
      beats++;
    }
    updateFormation(s, SIM_DT, beats);
  }
}

function settle(s: SimState): void {
  run(s, 6, 1e9);
}

describe('formation spawn and entry', () => {
  it('spawns rows × cols enemies that all fly in', () => {
    const s = createInitialState(1);
    expect(s.enemies).toHaveLength(s.diff.rows * s.diff.cols);
    expect(s.formation.total).toBe(s.diff.rows * s.diff.cols);
    expect(s.enemies.every((e) => e.entry !== null && !inFormation(e))).toBe(true);
  });

  it('puts gunners in the top row, divers in row 2 and grunts elsewhere on stage 1', () => {
    const s = createInitialState(1);
    expect(s.enemies.filter((e) => e.row === 0).every((e) => e.kind === 'gunner')).toBe(true);
    expect(s.enemies.filter((e) => e.row === 2).every((e) => e.kind === 'diver')).toBe(true);
    expect(s.enemies.filter((e) => e.row === 1 || e.row === 3).every((e) => e.kind === 'grunt')).toBe(true);
  });

  it('lands every enemy in its slot', () => {
    const s = createInitialState(1);
    settle(s);
    for (const e of s.enemies) {
      expect(e.entry).toBeNull();
      const slot = slotPosition(s, e);
      expect(e.x).toBeCloseTo(slot.x);
      expect(e.y).toBeCloseTo(slot.y);
    }
  });

  it('starts enemies outside the field', () => {
    const s = createInitialState(1);
    for (const e of s.enemies) expect(e.x + e.w < 0 || e.x > s.fieldW || e.y + e.h < 0).toBe(true);
  });
});

describe('beat motion', () => {
  it('flips sway direction on every beat', () => {
    const s = createInitialState(1);
    settle(s);
    const dir = s.formation.swayDir;
    updateFormation(s, SIM_DT, 1);
    expect(s.formation.swayDir).toBe(-dir);
    updateFormation(s, SIM_DT, 2);
    expect(s.formation.swayDir).toBe(-dir);
  });

  it('advances and morphs after four bars', () => {
    const s = createInitialState(1);
    settle(s);
    const y0 = s.formation.y;
    updateFormation(s, SIM_DT, 15);
    expect(s.formation.y).toBe(y0);
    updateFormation(s, SIM_DT, 1);
    expect(s.formation.y).toBeCloseTo(y0 + s.diff.advanceStep);
    expect(s.formation.shapeIdx).toBe(1 % stageShapes(0, 1).length);
    expect(s.formation.morph).toBeLessThan(1);
  });

  it('advances faster as the formation thins out', () => {
    expect(advanceBars(1)).toBe(4);
    expect(advanceBars(0.4)).toBe(2);
    expect(advanceBars(0.1)).toBe(1);
    const s = createInitialState(1);
    settle(s);
    s.enemies = s.enemies.slice(0, 3);
    const y0 = s.formation.y;
    updateFormation(s, SIM_DT, 4);
    expect(s.formation.y).toBeCloseTo(y0 + s.diff.advanceStep);
  });

  for (const fieldW of [140, 600]) {
    it(`keeps every slot inside a ${fieldW}px field while swaying`, () => {
      const s = createInitialState(3, fieldW);
      for (let i = 0; i < 40; i++) {
        run(s, 0.5);
        for (const e of s.enemies) {
          if (!inFormation(e)) continue;
          expect(e.x).toBeGreaterThanOrEqual(FORMATION.edgeMargin - 1e-6);
          expect(e.x + e.w).toBeLessThanOrEqual(fieldW - FORMATION.edgeMargin + 1e-6);
        }
      }
    });
  }
});

describe('formationBottom', () => {
  it('ignores enemies still flying in', () => {
    const s = createInitialState(1);
    expect(formationBottom(s)).toBe(-Infinity);
    settle(s);
    expect(formationBottom(s)).toBeGreaterThan(s.formation.y);
    s.enemies = [];
    expect(formationBottom(s)).toBe(-Infinity);
  });
});
