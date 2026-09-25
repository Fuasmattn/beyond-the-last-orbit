import { ELITE, ENEMY } from '../data/balance';
import { aimVelocity, spawnBomb, spawnEnemyBullet } from './bullets';
import { inFormation } from './formation';
import { fireAimedBurst, fireRing } from './patterns';
import { nextRandom } from './rng';
import type { Enemy, SimEvent, SimState } from './types';

const canShoot = (e: Enemy) => inFormation(e) && !e.phased;

/** Bottom-most shooter of each vertical lane, plus every gunner. */
function shooters(enemies: readonly Enemy[]): Enemy[] {
  const bottomByLane = new Map<number, Enemy>();
  for (const e of enemies) {
    if (!canShoot(e)) continue;
    const lane = Math.round((e.x + e.w / 2) / ENEMY.spacingX);
    const cur = bottomByLane.get(lane);
    if (!cur || e.y > cur.y) bottomByLane.set(lane, e);
  }
  const result = [...bottomByLane.values()];
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
  } else if (state.diff.elite && shooter.kind === 'gunner') {
    fireAimedBurst(state, cx, y, ELITE.burstCount, ELITE.burstSpread, state.diff.bulletSpeed);
  } else {
    const speed = state.diff.bulletSpeed;
    const v = shooter.kind === 'gunner' ? aimVelocity(state, cx, y, speed) : { vx: 0, vy: speed };
    spawnEnemyBullet(state, cx, y, v.vx, v.vy);
  }
  events.push({ type: 'enemyShot', x: cx, y });
}

/** Elite stages: every `ELITE.ringEvery` beats a random formation enemy fires a slow ring. */
export function updateEliteVolleys(state: SimState, beats: number, events: SimEvent[]): void {
  if (beats === 0) return;
  const count = state.beat.count;
  // Did we cross a multiple of ringEvery during this step?
  if (Math.floor(count / ELITE.ringEvery) === Math.floor((count - beats) / ELITE.ringEvery)) return;
  const candidates = state.enemies.filter(canShoot);
  const shooter = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
  if (!shooter) return;
  const cx = shooter.x + shooter.w / 2;
  const cy = shooter.y + shooter.h;
  fireRing(state, cx, cy, ELITE.ringCount, nextRandom(state.rng) * Math.PI, ELITE.ringSpeed);
  events.push({ type: 'enemyShot', x: cx, y: cy });
}
