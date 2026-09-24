import { ENEMY } from '../data/balance';
import { allocId } from './ids';
import { nextRandom } from './rng';
import type { Enemy, SimEvent, SimState } from './types';

/** Bottom-most enemy of each column, plus every gunner. */
function shooters(enemies: readonly Enemy[]): Enemy[] {
  const bottomByCol = new Map<number, Enemy>();
  for (const e of enemies) {
    const cur = bottomByCol.get(e.col);
    if (!cur || e.row > cur.row) bottomByCol.set(e.col, e);
  }
  const result = [...bottomByCol.values()];
  for (const e of enemies) if (e.kind === 'gunner' && !result.includes(e)) result.push(e);
  return result;
}

export function updateEnemyFire(state: SimState, dt: number, events: SimEvent[]): void {
  if (state.enemies.length === 0) return;
  state.enemyFireTimer -= dt;
  if (state.enemyFireTimer > 0) return;
  state.enemyFireTimer = (0.5 + nextRandom(state.rng)) / ENEMY.firePerSec;

  const candidates = shooters(state.enemies);
  const shooter = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
  if (!shooter) return;

  const x = shooter.x + shooter.w / 2 - ENEMY.bulletW / 2;
  const y = shooter.y + shooter.h;
  let vx = 0;
  let vy = ENEMY.bulletSpeed;
  if (shooter.kind === 'gunner') {
    const p = state.player;
    const dx = p.x + p.w / 2 - (x + ENEMY.bulletW / 2);
    const dy = Math.max(1, p.y + p.h / 2 - y);
    const len = Math.hypot(dx, dy);
    vx = (dx / len) * ENEMY.bulletSpeed;
    vy = (dy / len) * ENEMY.bulletSpeed;
  }
  state.bullets.push({
    id: allocId(state),
    x,
    y,
    w: ENEMY.bulletW,
    h: ENEMY.bulletH,
    vx,
    vy,
    owner: 'enemy',
    onBeat: false,
  });
  events.push({ type: 'enemyShot', x: x + ENEMY.bulletW / 2, y });
}
