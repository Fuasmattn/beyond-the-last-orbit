import { ENEMY, FIELD_W, FORMATION } from '../data/balance';
import { allocId } from './ids';
import type { EnemyKind, SimState } from './types';

function kindForRow(row: number): EnemyKind {
  return row === 0 ? 'gunner' : 'grunt';
}

export function formationWidth(): number {
  return (ENEMY.cols - 1) * ENEMY.spacingX + ENEMY.w;
}

export function spawnFormation(state: SimState): void {
  const x = Math.round((FIELD_W - formationWidth()) / 2);
  const y = ENEMY.startY;
  state.formation = { x, y, dir: 1, total: ENEMY.rows * ENEMY.cols };
  state.enemies = [];
  for (let row = 0; row < ENEMY.rows; row++) {
    for (let col = 0; col < ENEMY.cols; col++) {
      state.enemies.push({
        id: allocId(state),
        kind: kindForRow(row),
        row,
        col,
        hp: 1,
        flash: 0,
        x: x + col * ENEMY.spacingX,
        y: y + row * ENEMY.spacingY,
        w: ENEMY.w,
        h: ENEMY.h,
      });
    }
  }
}

/** Classic rule: fewer survivors → faster march. Quadratic ease-in. */
export function formationSpeed(alive: number, total: number): number {
  if (total <= 0) return FORMATION.minSpeed;
  const t = 1 - alive / total;
  return FORMATION.minSpeed + (FORMATION.maxSpeed - FORMATION.minSpeed) * t * t;
}

export function updateFormation(state: SimState, dt: number): void {
  const f = state.formation;
  const enemies = state.enemies;
  if (enemies.length === 0) return;

  f.x += f.dir * formationSpeed(enemies.length, f.total) * dt;

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
    e.x = f.x + e.col * ENEMY.spacingX;
    e.y = f.y + e.row * ENEMY.spacingY;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  }
}

export function formationBottom(state: SimState): number {
  let bottom = -Infinity;
  for (const e of state.enemies) bottom = Math.max(bottom, e.y + e.h);
  return bottom;
}
