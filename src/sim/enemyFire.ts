import { aimVelocity, spawnBomb, spawnEnemyBullet } from './bullets';
import { inFormation } from './formation';
import { nextRandom } from './rng';
import type { Enemy, SimEvent, SimState } from './types';

const canShoot = (e: Enemy) => inFormation(e) && !e.phased;

/** Bottom-most shooter of each column, plus every gunner. */
function shooters(enemies: readonly Enemy[]): Enemy[] {
  const bottomByCol = new Map<number, Enemy>();
  for (const e of enemies) {
    if (!canShoot(e)) continue;
    const cur = bottomByCol.get(e.col);
    if (!cur || e.row > cur.row) bottomByCol.set(e.col, e);
  }
  const result = [...bottomByCol.values()];
  for (const e of enemies) if (e.kind === 'gunner' && canShoot(e) && !result.includes(e)) result.push(e);
  return result;
}

export function updateEnemyFire(state: SimState, dt: number, events: SimEvent[]): void {
  if (state.enemies.length === 0) return;
  state.enemyFireTimer -= dt;
  if (state.enemyFireTimer > 0) return;
  state.enemyFireTimer = (0.5 + nextRandom(state.rng)) / state.diff.fireRate;

  const candidates = shooters(state.enemies);
  const shooter = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
  if (!shooter) return;

  const cx = shooter.x + shooter.w / 2;
  const y = shooter.y + shooter.h;
  if (shooter.kind === 'bomber') {
    spawnBomb(state, cx, y);
  } else {
    const speed = state.diff.bulletSpeed;
    const v = shooter.kind === 'gunner' ? aimVelocity(state, cx, y, speed) : { vx: 0, vy: speed };
    spawnEnemyBullet(state, cx, y, v.vx, v.vy);
  }
  events.push({ type: 'enemyShot', x: cx, y });
}
