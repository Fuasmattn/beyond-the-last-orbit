import { ELITE, ENEMY } from '../data/balance';
import { aimVelocity, spawnBomb, spawnEnemyBullet } from './bullets';
import { worldAt } from '../data/worlds';
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

/**
 * Elite stages: on every bar line a formation enemy fires the world's volley. The shooter is picked
 * one beat early and flashes (`charging`) as a telegraph.
 */
export function updateEliteVolleys(state: SimState, beats: number, events: SimEvent[]): void {
  const end = state.beat.count;
  for (let beat = end - beats + 1; beat <= end; beat++) {
    const phase = ((beat % ELITE.ringEvery) + ELITE.ringEvery) % ELITE.ringEvery;
    if (phase === ELITE.ringEvery - 1) chargeShooter(state);
    else if (phase === 0) fireVolley(state, Math.floor(beat / ELITE.ringEvery), events);
  }
}

function chargeShooter(state: SimState): void {
  const candidates = state.enemies.filter((e) => canShoot(e) && !e.charging);
  const shooter = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
  if (shooter) shooter.charging = true;
}

function fireVolley(state: SimState, bar: number, events: SimEvent[]): void {
  let shooter = state.enemies.find((e) => e.charging && canShoot(e));
  for (const e of state.enemies) e.charging = false;
  // The telegraphed shooter died or left the formation: fire from anyone rather than skip the bar.
  if (!shooter) {
    const candidates = state.enemies.filter(canShoot);
    shooter = candidates[Math.floor(nextRandom(state.rng) * candidates.length)];
  }
  if (!shooter) return;
  const cx = shooter.x + shooter.w / 2;
  const cy = shooter.y + shooter.h;
  const ring = () => fireRing(state, cx, cy, ELITE.ringCount, nextRandom(state.rng) * Math.PI, ELITE.ringSpeed);
  switch (worldAt(state.world).id) {
    case 'earth':
      fireWall(state, cy);
      break;
    case 'moon':
      ring();
      break;
    case 'mars':
      if (bar % 2 === 0) fireAimedBurst(state, cx, cy, ELITE.fanCount, ELITE.fanSpread, state.diff.bulletSpeed);
      else ring();
      break;
  }
  events.push({ type: 'enemyShot', x: cx, y: cy });
}

/** A row of slow bullets across the field with one gap at a random spot. */
function fireWall(state: SimState, y: number): void {
  const gapCenter = ELITE.wallGap / 2 + nextRandom(state.rng) * (state.fieldW - ELITE.wallGap);
  for (let x = ELITE.wallSpacing / 2; x < state.fieldW; x += ELITE.wallSpacing) {
    if (Math.abs(x - gapCenter) < ELITE.wallGap / 2) continue;
    spawnEnemyBullet(state, x, y, 0, ELITE.wallSpeed);
  }
}
