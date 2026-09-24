import { ENEMY, FIELD_W, FORMATION } from '../data/balance';
import { enemyHp, kindForRow } from './difficulty';
import { allocId } from './ids';
import type { Enemy, SimState } from './types';

export function formationWidth(cols: number): number {
  return (cols - 1) * ENEMY.spacingX + ENEMY.w;
}

export function spawnFormation(state: SimState): void {
  const { cols, d } = state.diff;
  const x = Math.round((FIELD_W - formationWidth(cols)) / 2);
  const y = ENEMY.startY;
  state.formation = { x, y, dir: 1, total: ENEMY.rows * cols };
  state.enemies = [];
  for (let row = 0; row < ENEMY.rows; row++) {
    const kind = kindForRow(row, d);
    const hp = enemyHp(kind, state.diff);
    for (let col = 0; col < cols; col++) {
      state.enemies.push({
        id: allocId(state),
        kind,
        row,
        col,
        hp,
        maxHp: hp,
        flash: 0,
        dive: null,
        x: x + col * ENEMY.spacingX,
        y: y + row * ENEMY.spacingY,
        w: ENEMY.w,
        h: ENEMY.h,
      });
    }
  }
}

/** Classic rule: fewer survivors → faster march. Quadratic ease-in between min and max. */
export function formationSpeed(alive: number, total: number, min: number, max: number): number {
  if (total <= 0) return min;
  const t = 1 - alive / total;
  return min + (max - min) * t * t;
}

export function slotPosition(state: SimState, e: Enemy): { x: number; y: number } {
  return {
    x: state.formation.x + e.col * ENEMY.spacingX,
    y: state.formation.y + e.row * ENEMY.spacingY,
  };
}

export function updateFormation(state: SimState, dt: number): void {
  const f = state.formation;
  const enemies = state.enemies;
  if (enemies.length === 0) return;

  f.x += f.dir * formationSpeed(enemies.length, f.total, state.diff.marchMin, state.diff.marchMax) * dt;

  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const e of enemies) {
    if (e.col < minCol) minCol = e.col;
    if (e.col > maxCol) maxCol = e.col;
  }
  const left = f.x + minCol * ENEMY.spacingX;
  const right = f.x + maxCol * ENEMY.spacingX + ENEMY.w;
  const rightLimit = FIELD_W - FORMATION.edgeMargin;

  if (f.dir === 1 && right > rightLimit) {
    f.x -= right - rightLimit;
    f.dir = -1;
    f.y += FORMATION.dropStep;
  } else if (f.dir === -1 && left < FORMATION.edgeMargin) {
    f.x += FORMATION.edgeMargin - left;
    f.dir = 1;
    f.y += FORMATION.dropStep;
  }

  for (const e of enemies) {
    if (!e.dive) {
      e.x = f.x + e.col * ENEMY.spacingX;
      e.y = f.y + e.row * ENEMY.spacingY;
    }
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  }
}

/** Lowest edge of enemies still in formation (divers excluded). */
export function formationBottom(state: SimState): number {
  let bottom = -Infinity;
  for (const e of state.enemies) if (!e.dive) bottom = Math.max(bottom, e.y + e.h);
  return bottom;
}
